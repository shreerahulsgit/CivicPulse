"""
seed_users.py — Create test officer and admin accounts
Run: python seed_users.py
"""

import uuid
from sqlalchemy import text
from app.database.session import SessionLocal
from app.models.user import User, UserRole
from app.services.auth_service import hash_password

db = SessionLocal()

# 1. Update MySQL ENUM to include 'officer'
try:
    db.execute(text(
        "ALTER TABLE users MODIFY COLUMN `role` "
        "ENUM('citizen','officer','admin','super_admin') "
        "NOT NULL DEFAULT 'citizen'"
    ))
    db.commit()
    print("[OK] MySQL role column updated to include 'officer'")
except Exception as e:
    db.rollback()
    print(f"[SKIP] Column alter: {e}")

# 2. Update existing officer@test.com to role=officer
officer = db.query(User).filter(User.email == "officer@test.com").first()
if officer:
    officer.role = UserRole.OFFICER
    db.commit()
    print("[OK] officer@test.com -> role=officer")
else:
    officer = User(
        id=str(uuid.uuid4()),
        full_name="Test Officer",
        email="officer@test.com",
        phone="9999999999",
        password_hash=hash_password("Test1234!"),
        role=UserRole.OFFICER,
        is_active=True,
    )
    db.add(officer)
    db.commit()
    print(f"[OK] Created officer@test.com (role=officer)")

# 3. Create admin user
admin = db.query(User).filter(User.email == "admin@test.com").first()
if admin:
    admin.role = UserRole.ADMIN
    db.commit()
    print("[OK] admin@test.com -> role=admin")
else:
    admin = User(
        id=str(uuid.uuid4()),
        full_name="Test Admin",
        email="admin@test.com",
        phone="8888888888",
        password_hash=hash_password("Test1234!"),
        role=UserRole.ADMIN,
        is_active=True,
    )
    db.add(admin)
    db.commit()
    print(f"[OK] Created admin@test.com (role=admin)")

# 4. Verify
for u in db.query(User).all():
    print(f"  - {u.email:30s} role={u.role.value}")

db.close()
print("\nDone! Login credentials:")
print("  Officer: officer@test.com / Test1234!")
print("  Admin:   admin@test.com  / Test1234!")
