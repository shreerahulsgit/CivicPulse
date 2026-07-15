"""
models/user.py — SQLAlchemy 2.0 User ORM Model

Table: users

Columns:
  id            — CHAR(36) UUID primary key
  full_name     — VARCHAR(100), required
  email         — VARCHAR(255), unique, indexed, required
  phone         — VARCHAR(20), optional
  password_hash — VARCHAR(255), nullable (Google users don't have passwords)
  auth_provider — ENUM: google | email (default: google)
  avatar_url    — VARCHAR(500), optional (Google profile picture)
  role          — ENUM: citizen | ward_officer | zonal_officer | dept_head | admin
  is_active     — BOOLEAN, soft-delete flag
  zone_id       — INT FK → zones.id (zonal_officer only)
  ward_id       — INT FK → wards.id (ward_officer only)
  created_at    — DATETIME
  updated_at    — DATETIME
"""

import uuid
import enum

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


# ── Role Enum ───────────────────────────────────────────────────────────────────
class UserRole(str, enum.Enum):
    CITIZEN        = "citizen"
    WARD_OFFICER   = "ward_officer"
    ZONAL_OFFICER  = "zonal_officer"
    DEPT_HEAD      = "dept_head"
    ADMIN          = "admin"


# ── Auth Provider Enum ──────────────────────────────────────────────────────────
class AuthProvider(str, enum.Enum):
    GOOGLE = "google"
    EMAIL  = "email"


# ── ORM Model ───────────────────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    # Primary key
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True,
    )

    # Identity
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email:     Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    phone:     Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Auth
    password_hash: Mapped[str | None] = mapped_column(
        String(255), nullable=True,
        comment="Nullable — Google-auth users have no password",
    )
    auth_provider: Mapped[AuthProvider] = mapped_column(
        SAEnum(AuthProvider, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=AuthProvider.GOOGLE,
        comment="How this user authenticates: google or email",
    )
    avatar_url: Mapped[str | None] = mapped_column(
        String(500), nullable=True,
        comment="Profile picture URL from Google",
    )

    # Authorisation
    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=UserRole.CITIZEN,
    )

    # Account state
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Zone scope (Zonal Officers only — NULL for all other roles)
    zone_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("zones.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Set for zonal_officer — defines which zone they manage",
    )

    # Ward scope (Ward Officers only — NULL for all other roles)
    ward_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("wards.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Set for ward_officer — defines which ward they manage",
    )

    # Timestamps
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<User id={self.id!r} email={self.email!r} role={self.role} provider={self.auth_provider}>"
