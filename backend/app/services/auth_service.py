"""
services/auth_service.py -- Password Hashing + JWT Utilities

Sections:
  1. Config       -- JWT settings from .env
  2. Password     -- bcrypt hash / verify (admin-only login)
  3. JWT          -- create_access_token with role-based expiry
  4. User queries -- get_user_by_email
"""

import os
from datetime import datetime, timedelta, timezone

import bcrypt
from dotenv import load_dotenv
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.models.user import User, UserRole

# ── Load config ──────────────────────────────────────────────────────────────────
_BASE_DIR = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)
load_dotenv(os.path.join(_BASE_DIR, ".env"))

SECRET_KEY: str = os.getenv("SECRET_KEY", "")
ALGORITHM:  str = os.getenv("ALGORITHM", "HS256")

if not SECRET_KEY:
    raise EnvironmentError("SECRET_KEY is not set. Add it to your .env file.")

# ── Role-based token expiry ──────────────────────────────────────────────────────
# Citizens: 90 days (they hate re-logging on mobile)
# Officers: 8 hours (per-shift, security)
# Admin:    4 hours (sensitive access)
TOKEN_EXPIRY_MINUTES: dict[str, int] = {
    UserRole.CITIZEN.value:        129600,   # 90 days
    UserRole.WARD_OFFICER.value:   480,      # 8 hours
    UserRole.ZONAL_OFFICER.value:  480,      # 8 hours
    UserRole.DEPT_HEAD.value:      480,      # 8 hours
    UserRole.ADMIN.value:          240,      # 4 hours
}
_DEFAULT_EXPIRY = 480  # fallback: 8 hours

# ── bcrypt cost factor ────────────────────────────────────────────────────────────
_BCRYPT_ROUNDS: int = 12


# 1. Password utilities
# ═══════════════════════════════════════════════════════════════════════════════

def hash_password(plain: str) -> str:
    """Return a bcrypt hash of *plain* text password."""
    salt = bcrypt.gensalt(rounds=_BCRYPT_ROUNDS)
    return bcrypt.hashpw(plain.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Compare *plain* against *hashed* using constant-time bcrypt check."""
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


# 2. JWT utilities
# ═══════════════════════════════════════════════════════════════════════════════

def create_access_token(payload: dict) -> str:
    """
    Sign and return a JWT access token with role-based expiry.

    The 'role' key in payload determines token lifetime:
      citizen  -> 90 days
      officers -> 8 hours
      admin    -> 4 hours
    """
    now  = datetime.now(tz=timezone.utc)
    role = payload.get("role", "")
    expire_mins = TOKEN_EXPIRY_MINUTES.get(role, _DEFAULT_EXPIRY)

    data = payload.copy()
    data.update({
        "iat": now,
        "exp": now + timedelta(minutes=expire_mins),
    })
    return jwt.encode(data, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str) -> dict:
    """
    Decode and validate a JWT access token.
    Raises JWTError if the token is expired, tampered, or invalid.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise


# 3. Database helpers
# ═══════════════════════════════════════════════════════════════════════════════

def get_user_by_email(db: Session, email: str) -> User | None:
    """Fetch a single User by email address, case-insensitively."""
    return db.query(User).filter(User.email == email.lower().strip()).first()
