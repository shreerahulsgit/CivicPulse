"""Test SRID and axis order for MySQL 8 spatial."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.database.session import SessionLocal

db = SessionLocal()

# Check MySQL version
ver = db.execute(text("SELECT VERSION()")).scalar()
print(f"MySQL version: {ver}")

# Check SRID 4326 axis order
try:
    result = db.execute(text(
        "SELECT SRS_NAME, DEFINITION FROM INFORMATION_SCHEMA.ST_SPATIAL_REFERENCE_SYSTEMS "
        "WHERE SRS_ID = 4326"
    ))
    row = result.first()
    if row:
        print(f"SRID 4326 name: {row[0]}")
        # Check axis order from definition
        defn = row[1]
        if "Lat" in defn.split("AXIS")[1] if "AXIS" in defn else "":
            print("Axis order: latitude first (geographic)")
        print(f"Definition (first 300 chars): {defn[:300]}")
except Exception as e:
    print(f"SRID check error: {e}")

# Test with SRID 4326 and lat-first point (MySQL 8 geographic expects lat,lng)
print("\n--- Test: POINT(lat lng) with SRID 4326 ---")
try:
    result = db.execute(text(
        "SELECT w.ward_number, w.ward_name "
        "FROM ward_geometries wg "
        "JOIN wards w ON w.id = wg.ward_id "
        "WHERE ST_Contains(wg.boundary, ST_SRID(ST_GeomFromText('POINT(13.0827 80.2707)'), 4326)) "
        "LIMIT 1"
    ))
    row = result.first()
    print(f"Result: {row}")
except Exception as e:
    print(f"Error: {e}")

# Test with ST_Within instead
print("\n--- Test: ST_Within (inverse of ST_Contains) ---")
try:
    result = db.execute(text(
        "SELECT w.ward_number, w.ward_name "
        "FROM ward_geometries wg "
        "JOIN wards w ON w.id = wg.ward_id "
        "WHERE ST_Within(ST_GeomFromText('POINT(80.2707 13.0827)', 4326), wg.boundary) "
        "LIMIT 1"
    ))
    row = result.first()
    print(f"Result: {row}")
except Exception as e:
    print(f"Error: {e}")

# Test with SRID 0 (Cartesian)
print("\n--- Test: SRID 0 (Cartesian, no axis swap) ---")
try:
    result = db.execute(text(
        "SELECT w.ward_number, w.ward_name "
        "FROM ward_geometries wg "
        "JOIN wards w ON w.id = wg.ward_id "
        "WHERE ST_Contains(ST_SRID(wg.boundary, 0), ST_GeomFromText('POINT(80.2707 13.0827)', 0)) "
        "LIMIT 1"
    ))
    row = result.first()
    print(f"Result: {row}")
except Exception as e:
    print(f"Error: {e}")

db.close()
