import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.database.session import SessionLocal
from sqlalchemy import text

db = SessionLocal()
rows = db.execute(text("SELECT email, role, auth_provider FROM users WHERE role='admin'")).fetchall()
for r in rows:
    print(r)
db.close()
