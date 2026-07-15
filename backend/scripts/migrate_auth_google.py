"""
scripts/migrate_auth_google.py -- Migrate users table for Google Sign-In auth

Changes:
  1. Add auth_provider ENUM column (default 'google')
  2. Add avatar_url VARCHAR(500) column
  3. Make password_hash nullable
  4. Update role ENUM: citizen, ward_officer, zonal_officer, dept_head, admin
  5. Seed a default admin account (email+password)

Run:
    cd backend
    python scripts/migrate_auth_google.py
"""

import sys
import os
import uuid
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.database.session import SessionLocal

db = SessionLocal()


def column_exists(table: str, column: str) -> bool:
    result = db.execute(text(
        "SELECT COUNT(*) FROM information_schema.columns "
        "WHERE table_schema = DATABASE() "
        "AND table_name = :table AND column_name = :column"
    ), {"table": table, "column": column})
    return result.scalar() > 0


def run_migration():
    print("=" * 60)
    print("CivicPulse -- Auth Migration (Google Sign-In)")
    print("=" * 60)

    # 1. Add auth_provider column
    if not column_exists("users", "auth_provider"):
        db.execute(text(
            "ALTER TABLE users ADD COLUMN auth_provider "
            "ENUM('google','email') NOT NULL DEFAULT 'email' "
            "COMMENT 'How this user authenticates'"
        ))
        db.commit()
        print("[OK] Added users.auth_provider")
    else:
        print("[SKIP] users.auth_provider already exists")

    # 2. Add avatar_url column
    if not column_exists("users", "avatar_url"):
        db.execute(text(
            "ALTER TABLE users ADD COLUMN avatar_url "
            "VARCHAR(500) DEFAULT NULL "
            "COMMENT 'Profile picture URL from Google'"
        ))
        db.commit()
        print("[OK] Added users.avatar_url")
    else:
        print("[SKIP] users.avatar_url already exists")

    # 3. Make password_hash nullable
    try:
        db.execute(text(
            "ALTER TABLE users MODIFY COLUMN password_hash "
            "VARCHAR(255) DEFAULT NULL "
            "COMMENT 'Nullable -- Google-auth users have no password'"
        ))
        db.commit()
        print("[OK] Made password_hash nullable")
    except Exception as e:
        db.rollback()
        print(f"[WARN] password_hash modify: {e}")

    # 4. Update role ENUM
    # MySQL requires MODIFY COLUMN to change ENUM values
    try:
        db.execute(text(
            "ALTER TABLE users MODIFY COLUMN role "
            "ENUM('citizen','ward_officer','zonal_officer','dept_head','admin','officer','super_admin') "
            "NOT NULL DEFAULT 'citizen'"
        ))
        db.commit()
        print("[OK] Updated role ENUM (added new roles, kept old for compat)")

        # Migrate old roles to new ones
        db.execute(text(
            "UPDATE users SET role = 'admin' WHERE role = 'super_admin'"
        ))
        db.execute(text(
            "UPDATE users SET role = 'ward_officer' WHERE role = 'officer'"
        ))
        db.commit()
        print("[OK] Migrated old role values (super_admin -> admin, officer -> ward_officer)")
    except Exception as e:
        db.rollback()
        print(f"[WARN] Role ENUM update: {e}")

    # 5. Mark existing users with email auth provider
    try:
        db.execute(text(
            "UPDATE users SET auth_provider = 'email' "
            "WHERE password_hash IS NOT NULL AND auth_provider = 'google'"
        ))
        db.commit()
        print("[OK] Marked existing password users as auth_provider='email'")
    except Exception as e:
        db.rollback()
        print(f"[WARN] auth_provider update: {e}")

    # 6. Seed default admin account
    seed_admin()


def seed_admin():
    """Create a default admin account if none exists."""
    result = db.execute(text(
        "SELECT COUNT(*) FROM users WHERE role = 'admin'"
    ))
    admin_count = result.scalar()

    if admin_count > 0:
        print(f"[SKIP] {admin_count} admin account(s) already exist")
        return

    import bcrypt
    admin_id = str(uuid.uuid4())
    password = "Admin@123"
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

    db.execute(text(
        "INSERT INTO users (id, full_name, email, password_hash, role, auth_provider, is_active) "
        "VALUES (:id, :name, :email, :hash, 'admin', 'email', TRUE)"
    ), {
        "id": admin_id,
        "name": "CivicPulse Admin",
        "email": "admin@civicpulse.in",
        "hash": hashed,
    })
    db.commit()
    print(f"[OK] Created default admin account:")
    print(f"     Email:    admin@civicpulse.in")
    print(f"     Password: {password}")
    print(f"     ID:       {admin_id}")
    print(f"     ** CHANGE THIS PASSWORD IN PRODUCTION **")


if __name__ == "__main__":
    run_migration()
    db.close()
    print("\n[DONE] Auth migration complete!")
