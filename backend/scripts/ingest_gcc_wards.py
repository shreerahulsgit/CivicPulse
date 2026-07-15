"""
scripts/ingest_gcc_wards.py — Load GCC ward GeoJSON into MySQL

Reads: backend/data/gcc_wards.geojson
Writes to: wards table (ward rows) + ward_geometries table (GEOMETRY column)

Steps for each feature:
  1. Extract ward_no from GeoJSON properties
  2. Determine zone from ward number
  3. Create/update Ward row (jurisdiction_id=GCC, zone_id from zones table)
  4. Convert GeoJSON polygon → MySQL GEOMETRY via ST_GeomFromGeoJSON()
  5. Insert into ward_geometries with centroid
  6. Store raw GeoJSON in wards.polygon_geojson for frontend rendering

Run:
    cd backend
    python scripts/ingest_gcc_wards.py
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.database.session import SessionLocal

# ── Ward → Zone mapping ─────────────────────────────────────────────────────
WARD_ZONE_MAP: dict[int, int] = {}
_zone_ward_ranges = {
    1:  range(1, 15),
    2:  range(15, 22),
    3:  range(22, 34),
    4:  range(34, 49),
    5:  range(49, 64),
    6:  range(64, 79),
    7:  range(79, 94),
    8:  range(94, 109),
    9:  range(109, 127),
    10: range(127, 143),
    11: range(143, 156),
    12: range(156, 168),
    13: range(170, 183),
    14: list(range(168, 170)) + list(range(183, 192)),
    15: range(192, 201),
}
for zone_no, wards in _zone_ward_ranges.items():
    for w in wards:
        WARD_ZONE_MAP[w] = zone_no


def ingest():
    data_file = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "data", "gcc_wards.geojson"
    )

    if not os.path.exists(data_file):
        print(f"[ERROR] GeoJSON file not found: {data_file}")
        print("        Run: python scripts/download_gcc_wards.py first")
        sys.exit(1)

    with open(data_file, "r", encoding="utf-8") as f:
        geojson = json.load(f)

    features = geojson.get("features", [])
    print(f"[INFO] Loaded {len(features)} features from {data_file}")

    db = SessionLocal()

    # ── Get GCC jurisdiction ID ──────────────────────────────────────────────
    result = db.execute(text(
        "SELECT id FROM jurisdictions WHERE name = 'Greater Chennai Corporation'"
    ))
    row = result.first()
    if not row:
        print("[ERROR] GCC jurisdiction not found. Run migrate_spatial.py first.")
        sys.exit(1)
    gcc_id = row[0]

    # ── Load zone lookup ─────────────────────────────────────────────────────
    zones = db.execute(text(
        "SELECT id, zone_number FROM zones WHERE jurisdiction_id = :jid"
    ), {"jid": gcc_id}).fetchall()
    zone_lookup = {z[1]: z[0] for z in zones}  # zone_number → zone_id
    print(f"[INFO] Loaded {len(zone_lookup)} zones")

    # ── Detect ward number property key ──────────────────────────────────────
    sample_props = features[0].get("properties", {}) if features else {}
    ward_key = None
    for candidate in ["Ward_No", "ward_no", "WARD_NO", "ward_number", "Ward_Number"]:
        if candidate in sample_props:
            ward_key = candidate
            break

    if not ward_key:
        print(f"[ERROR] Cannot find ward number property. Available: {list(sample_props.keys())}")
        sys.exit(1)

    print(f"[INFO] Using ward number property: '{ward_key}'")

    # ── Process features ─────────────────────────────────────────────────────
    created = 0
    updated = 0
    skipped = 0
    errors  = 0

    for i, feature in enumerate(features):
        props = feature.get("properties", {})
        geom  = feature.get("geometry", {})

        ward_no_raw = props.get(ward_key)
        if ward_no_raw is None:
            print(f"  [WARN] Feature {i}: no ward number, skipping")
            skipped += 1
            continue

        try:
            ward_no = int(ward_no_raw)
        except (ValueError, TypeError):
            print(f"  [WARN] Feature {i}: invalid ward_no={ward_no_raw!r}, skipping")
            skipped += 1
            continue

        if ward_no < 1 or ward_no > 200:
            print(f"  [WARN] Feature {i}: ward_no={ward_no} out of range, skipping")
            skipped += 1
            continue

        zone_no = WARD_ZONE_MAP.get(ward_no)
        zone_id = zone_lookup.get(zone_no) if zone_no else None
        ward_name = f"Ward {ward_no}"

        geojson_str = json.dumps(geom)

        try:
            # ── Check if ward exists ─────────────────────────────────────────
            existing = db.execute(text(
                "SELECT id FROM wards "
                "WHERE jurisdiction_id = :jid AND ward_number = :wn"
            ), {"jid": gcc_id, "wn": str(ward_no)}).first()

            if existing:
                ward_id = existing[0]
                # Update polygon_geojson and zone_id
                db.execute(text(
                    "UPDATE wards SET polygon_geojson = :geojson, zone_id = :zid, "
                    "zone_number = :znum "
                    "WHERE id = :wid"
                ), {
                    "geojson": geojson_str,
                    "zid": zone_id,
                    "znum": f"Z-{zone_no}" if zone_no else None,
                    "wid": ward_id,
                })
                updated += 1
            else:
                # Insert new ward
                db.execute(text(
                    "INSERT INTO wards (jurisdiction_id, ward_number, zone_number, "
                    "ward_name, polygon_geojson, zone_id) "
                    "VALUES (:jid, :wn, :znum, :wname, :geojson, :zid)"
                ), {
                    "jid": gcc_id,
                    "wn": str(ward_no),
                    "znum": f"Z-{zone_no}" if zone_no else None,
                    "wname": ward_name,
                    "geojson": geojson_str,
                    "zid": zone_id,
                })
                db.flush()
                # Get the inserted ward ID
                ward_id = db.execute(text(
                    "SELECT id FROM wards "
                    "WHERE jurisdiction_id = :jid AND ward_number = :wn"
                ), {"jid": gcc_id, "wn": str(ward_no)}).scalar()
                created += 1

            # ── Insert/update ward_geometries ────────────────────────────────
            # Delete existing geometry if any
            db.execute(text(
                "DELETE FROM ward_geometries WHERE ward_id = :wid"
            ), {"wid": ward_id})

            # Insert geometry using ST_GeomFromGeoJSON
            # MySQL 8 ST_Centroid doesn't support SRID 4326 (geographic),
            # so compute centroid on SRID 0 (Cartesian) — fine for small areas like wards
            db.execute(text(
                "INSERT INTO ward_geometries (ward_id, boundary, centroid_lat, centroid_lng) "
                "VALUES ("
                "  :wid, "
                "  ST_GeomFromGeoJSON(:geojson, 1, 4326), "
                "  ST_Y(ST_Centroid(ST_GeomFromGeoJSON(:geojson2, 1, 0))), "
                "  ST_X(ST_Centroid(ST_GeomFromGeoJSON(:geojson3, 1, 0)))"
                ")"
            ), {
                "wid": ward_id,
                "geojson": geojson_str,
                "geojson2": geojson_str,
                "geojson3": geojson_str,
            })

            if (created + updated) % 25 == 0:
                db.commit()
                print(f"  [PROGRESS] {created + updated}/{len(features)} wards processed")

        except Exception as e:
            db.rollback()
            print(f"  [ERROR] Ward {ward_no}: {e}")
            errors += 1

    db.commit()
    db.close()

    print(f"\n{'=' * 50}")
    print(f"[DONE] GCC Ward Ingest Complete")
    print(f"  Created:  {created}")
    print(f"  Updated:  {updated}")
    print(f"  Skipped:  {skipped}")
    print(f"  Errors:   {errors}")
    print(f"  Total:    {created + updated + skipped + errors}")

    # Validate
    expected = 200
    actual = created + updated
    if actual < expected:
        missing = set(range(1, 201)) - {
            int(f["properties"].get(ward_key, 0))
            for f in features
            if f["properties"].get(ward_key) is not None
        }
        if missing:
            print(f"\n[WARN] Missing ward numbers: {sorted(missing)}")
    else:
        print(f"\n[OK] All {expected} wards ingested successfully!")


if __name__ == "__main__":
    ingest()
