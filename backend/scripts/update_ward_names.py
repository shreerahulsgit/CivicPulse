"""
update_ward_names.py — Update all generic ward names to real locality names
using the chennai_zones_wards.py reference file.

Strategy:
  - Match by ward_number (which we set during seeding)
  - Also fix zone_id if missing, by matching ward_number to zone boundary
"""
import sys; sys.path.insert(0, '.')
from app.database.session import SessionLocal
from sqlalchemy import text
from scripts.chennai_zones_wards import CHENNAI_ZONES_AND_WARDS

db = SessionLocal()

updated_name = 0
updated_zone = 0

for zone in CHENNAI_ZONES_AND_WARDS:
    zone_id = zone["zone_id"]
    for w in zone["wards"]:
        wnum = w["ward_number"]
        wname = w["ward_name"]

        # First try: match by ward_number + zone_id (already assigned)
        r = db.execute(
            text("UPDATE wards SET ward_name = :name WHERE ward_number = :num AND zone_id = :zid"),
            {"name": wname, "num": wnum, "zid": zone_id}
        )
        if r.rowcount > 0:
            updated_name += r.rowcount
            continue

        # Second try: match by ward_number alone (zone_id might be wrong or missing)
        r2 = db.execute(
            text("UPDATE wards SET ward_name = :name, zone_id = :zid WHERE ward_number = :num"),
            {"name": wname, "zid": zone_id, "num": wnum}
        )
        if r2.rowcount > 0:
            updated_name += r2.rowcount
            updated_zone += r2.rowcount

db.commit()

# Final status
generic = db.execute(text("SELECT COUNT(*) FROM wards WHERE ward_name LIKE 'Ward %'")).scalar()
total   = db.execute(text("SELECT COUNT(*) FROM wards")).scalar()
print(f"\nDone!")
print(f"  Updated names: {updated_name}")
print(f"  Also fixed zone_id: {updated_zone}")
print(f"  Still generic: {generic} / {total}")

# Show a sample
sample = db.execute(text("""
    SELECT z.zone_name, w.ward_number, w.ward_name
    FROM wards w JOIN zones z ON z.id = w.zone_id
    ORDER BY z.zone_number, CAST(w.ward_number AS UNSIGNED)
    LIMIT 20
""")).fetchall()
print("\nSample (first 20):")
for r in sample:
    print(f"  {r[0]:25s} | Ward {r[1]:>3} | {r[2]}")

db.close()
