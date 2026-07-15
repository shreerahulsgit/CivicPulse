"""
services/geospatial_service.py — GeoSpatial Ward Detection (MySQL Spatial)

Determines which ward and zone a GPS coordinate belongs to by running
ST_Contains queries against ward_geometries (MySQL 8 GEOMETRY + SPATIAL INDEX).

Functions:
  find_ward()          — lat/lng → WardMatch (ward + zone + jurisdiction)
  get_nearest_ward()   — Fallback: nearest ward centroid when no polygon matches

Architecture note:
  Previous version used Shapely (Python-side ray-casting) with in-memory polygon
  cache. This version pushes the spatial query to MySQL, leveraging the SPATIAL INDEX
  on ward_geometries.boundary for O(log n) point-in-polygon lookup.
"""

import logging
import math
from dataclasses import dataclass
from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


# ── Result dataclass ──────────────────────────────────────────────────────────

@dataclass
class WardMatch:
    """Result returned by find_ward()."""
    ward_id:         int
    ward_name:       str
    ward_number:     str
    zone_number:     str | None
    zone_id:         int | None
    zone_name:       str | None
    jurisdiction_id: int


# ═══════════════════════════════════════════════════════════════════════════════
# Point-in-polygon detection (MySQL ST_Contains)
# ═══════════════════════════════════════════════════════════════════════════════

def find_ward(
    db: Session,
    latitude: float,
    longitude: float,
) -> Optional[WardMatch]:
    """
    Find which ward a GPS coordinate belongs to using MySQL spatial functions.

    Query strategy:
      1. Build a POINT geometry from (longitude, latitude) with SRID 4326.
      2. Run ST_Contains against ward_geometries.boundary (SPATIAL INDEX used).
      3. If no exact match, try ST_Contains with a small buffer (~10m) to
         handle boundary edge cases.
      4. Fall back to nearest centroid if still no match.

    Returns WardMatch or None if no ward can be determined.
    """
    # ── Exact match ──────────────────────────────────────────────────────────
    # MySQL 8 SRID 4326 uses (lat, lng) axis order but GeoJSON stores (lng, lat).
    # Cast to SRID 0 (Cartesian) to avoid the mismatch — accurate at city scale.
    result = db.execute(text("""
        SELECT w.id, w.ward_number, w.ward_name, w.zone_number,
               w.zone_id, w.jurisdiction_id,
               z.zone_name
        FROM ward_geometries wg
        JOIN wards w ON w.id = wg.ward_id
        LEFT JOIN zones z ON z.id = w.zone_id
        WHERE ST_Contains(
            ST_SRID(wg.boundary, 0),
            ST_GeomFromText(:point, 0)
        )
        LIMIT 1
    """), {"point": f"POINT({longitude} {latitude})"})

    row = result.first()
    if row:
        logger.info(
            "Ward detected: ward=%s zone=%s for (%.6f, %.6f)",
            row[1], row[4], latitude, longitude,
        )
        return WardMatch(
            ward_id         = row[0],
            ward_number     = row[1],
            ward_name       = row[2],
            zone_number     = row[3],
            zone_id         = row[4],
            jurisdiction_id = row[5],
            zone_name       = row[6],
        )

    # ── Buffer match (for boundary edge cases, ~10m buffer) ──────────────────
    # 0.0001 degrees ≈ 11 meters at Chennai's latitude
    logger.info(
        "No exact match for (%.6f, %.6f), trying buffer fallback", latitude, longitude
    )
    result = db.execute(text("""
        SELECT w.id, w.ward_number, w.ward_name, w.zone_number,
               w.zone_id, w.jurisdiction_id,
               z.zone_name
        FROM ward_geometries wg
        JOIN wards w ON w.id = wg.ward_id
        LEFT JOIN zones z ON z.id = w.zone_id
        WHERE ST_Contains(
            ST_Buffer(ST_SRID(wg.boundary, 0), 0.0001),
            ST_GeomFromText(:point, 0)
        )
        LIMIT 1
    """), {"point": f"POINT({longitude} {latitude})"})

    row = result.first()
    if row:
        logger.info(
            "Ward detected (buffer): ward=%s zone=%s for (%.6f, %.6f)",
            row[1], row[4], latitude, longitude,
        )
        return WardMatch(
            ward_id         = row[0],
            ward_number     = row[1],
            ward_name       = row[2],
            zone_number     = row[3],
            zone_id         = row[4],
            jurisdiction_id = row[5],
            zone_name       = row[6],
        )

    # ── Fallback: nearest centroid ───────────────────────────────────────────
    logger.info(
        "No polygon contains (%.6f, %.6f), falling back to nearest centroid",
        latitude, longitude,
    )
    return get_nearest_ward(db, latitude, longitude)


def find_jurisdiction(
    db: Session,
    latitude: float,
    longitude: float,
) -> Optional[WardMatch]:
    """Alias for find_ward() — jurisdiction_id is embedded in WardMatch."""
    return find_ward(db, latitude, longitude)


# ═══════════════════════════════════════════════════════════════════════════════
# Nearest centroid fallback
# ═══════════════════════════════════════════════════════════════════════════════

def _haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in km using the Haversine formula."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def get_nearest_ward(
    db: Session,
    latitude: float,
    longitude: float,
    max_distance_km: float = 5.0,
) -> Optional[WardMatch]:
    """
    Fallback: returns the ward whose centroid is nearest to the given coordinate.

    If the nearest centroid is more than max_distance_km away, returns None
    (point is likely outside the jurisdiction entirely — flag for admin review).
    """
    # Use MySQL spatial distance for ordering, but still filter by centroid
    result = db.execute(text("""
        SELECT w.id, w.ward_number, w.ward_name, w.zone_number,
               w.zone_id, w.jurisdiction_id,
               z.zone_name,
               wg.centroid_lat, wg.centroid_lng
        FROM ward_geometries wg
        JOIN wards w ON w.id = wg.ward_id
        LEFT JOIN zones z ON z.id = w.zone_id
        WHERE wg.centroid_lat IS NOT NULL
        ORDER BY ST_Distance_Sphere(
            POINT(wg.centroid_lng, wg.centroid_lat),
            POINT(:lng, :lat)
        )
        LIMIT 1
    """), {"lat": latitude, "lng": longitude})

    row = result.first()
    if not row:
        logger.warning("No ward centroids available for nearest-ward fallback")
        return None

    dist_km = _haversine_distance(latitude, longitude, row[7], row[8])

    if dist_km > max_distance_km:
        logger.warning(
            "Nearest ward centroid is %.2f km away (max=%.1f km) — "
            "point (%.6f, %.6f) is likely outside jurisdiction. "
            "Flagging for admin review.",
            dist_km, max_distance_km, latitude, longitude,
        )
        return None

    logger.info(
        "Nearest ward centroid: ward=%s (%.2f km away)",
        row[1], dist_km,
    )
    return WardMatch(
        ward_id         = row[0],
        ward_number     = row[1],
        ward_name       = row[2],
        zone_number     = row[3],
        zone_id         = row[4],
        jurisdiction_id = row[5],
        zone_name       = row[6],
    )


# ── Cache invalidation (no-op — no longer using in-memory cache) ─────────────

def invalidate_cache() -> None:
    """Legacy no-op. MySQL spatial queries don't use an in-memory cache."""
    pass
