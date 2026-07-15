"""
schemas/user.py — Pydantic v2 User Schemas

Schemas:
  GoogleAuthRequest — Input for POST /auth/google (Firebase ID token)
  UserLogin         — Input for POST /auth/login (admin email+password)
  UserResponse      — Outbound user representation (no secrets)
  TokenResponse     — JWT + user returned after successful auth
"""

from datetime import datetime
from typing import Optional

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
)

from app.models.user import UserRole, AuthProvider


# ── Google Auth ─────────────────────────────────────────────────────────────────
class GoogleAuthRequest(BaseModel):
    """Payload for POST /auth/google — just the Firebase ID token."""
    id_token: str = Field(
        ...,
        min_length=20,
        description="Firebase ID token from Google Sign-In popup",
    )


# ── Admin Login (email + password) ──────────────────────────────────────────────
class UserLogin(BaseModel):
    """Payload for POST /auth/login — admin email+password only."""
    email:    EmailStr = Field(..., examples=["admin@civicpulse.in"])
    password: str      = Field(..., min_length=8, examples=["AdminPass@123"])


# ── Admin Account Creation (internal use) ───────────────────────────────────────
class AdminCreate(BaseModel):
    """Used by seed scripts to create admin accounts."""
    full_name: str = Field(..., min_length=2, max_length=100)
    email:     EmailStr
    password:  str = Field(..., min_length=8, max_length=64)

    @field_validator("password", mode="after")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter.")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit.")
        return v


# ── Response ────────────────────────────────────────────────────────────────────
class UserResponse(BaseModel):
    """Safe outbound representation of a User. password_hash never included."""

    model_config = ConfigDict(from_attributes=True)

    id:            str
    full_name:     str
    email:         EmailStr
    phone:         Optional[str]          = None
    role:          UserRole
    auth_provider: AuthProvider
    avatar_url:    Optional[str]          = None
    is_active:     bool
    created_at:    datetime
    updated_at:    datetime


# ── Token ───────────────────────────────────────────────────────────────────────
class TokenResponse(BaseModel):
    """Returned by /auth/google and /auth/login on success."""
    access_token: str
    token_type:   str          = "bearer"
    user:         UserResponse
