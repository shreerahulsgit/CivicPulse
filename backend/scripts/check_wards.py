import sys; sys.path.insert(0, '.')
from app.database.session import SessionLocal
from sqlalchemy import text

db = SessionLocal()
generic = db.execute(text("SELECT COUNT(*) FROM wards WHERE ward_name LIKE 'Ward %'")).scalar()
no_zone = db.execute(text("SELECT COUNT(*) FROM wards WHERE zone_id IS NULL")).scalar()
total   = db.execute(text("SELECT COUNT(*) FROM wards")).scalar()
print(f"Total: {total}  |  Generic names: {generic}  |  No zone_id: {no_zone}")

orphans = db.execute(text("SELECT id, ward_number, ward_name FROM wards WHERE zone_id IS NULL ORDER BY CAST(ward_number AS UNSIGNED)")).fetchall()
print(f"Orphan wards ({len(orphans)}):")
for r in orphans[:15]:
    print(f"  id={r[0]} num={r[1]} name={r[2]}")
db.close()
