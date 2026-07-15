import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.database.session import SessionLocal
from sqlalchemy import text

db = SessionLocal()
tables = ['jurisdictions','zones','wards','ward_geometries','departments','categories','zone_departments']
for t in tables:
    count = db.execute(text(f"SELECT COUNT(*) FROM {t}")).scalar()
    print(f"  {t}: {count}")
db.close()