"""Seed a fresh admin account after clearing users."""
import sys, os, uuid
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import bcrypt
from sqlalchemy import text
from app.database.session import SessionLocal

db = SessionLocal()

# Check if admin already exists
result = db.execute(text("SELECT COUNT(*) FROM users WHERE email='admin@civicpulse.in'"))
if result.scalar() > 0:
    print("[SKIP] admin@civicpulse.in already exists")
else:
    aid = str(uuid.uuid4())
    pw = bcrypt.hashpw(b"Admin@123", bcrypt.gensalt(12)).decode()
    db.execute(text(
        "INSERT INTO users (id, full_name, email, password_hash, role, auth_provider, is_active) "
        "VALUES (:id, 'CivicPulse Admin', 'admin@civicpulse.in', :pw, 'admin', 'email', 1)"
    ), {"id": aid, "pw": pw})
    db.commit()
    print(f"[OK] Admin created!")
    print(f"     Email:    admin@civicpulse.in")
    print(f"     Password: Admin@123")

db.close()
