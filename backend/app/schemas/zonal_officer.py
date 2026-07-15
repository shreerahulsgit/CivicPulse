"""
schemas/zonal_officer.py — Pydantic schemas for Zonal Officer API
"""

from datetime import datetime
from pydantic import BaseModel, EmailStr, Field

from app.models.complaint import ComplaintStatus


# ── Dashboard ─────────────────────────────────────────────────────────────────

class ZonalDashboardStats(BaseModel):
    zone_id: int
    zone_name: str
    total_complaints: int
    submitted: int
    in_progress: int
    resolved: int
    total_wards: int


# ── Complaints ────────────────────────────────────────────────────────────────

class ZonalComplaintItem(BaseModel):
    id: str
    title: str
    status: ComplaintStatus
    ward_id: int | None
    ward_number: str | None  # human-readable, e.g. "W-14"
    ward_name: str | None    # e.g. "Thiruvottiyur"
    category_id: int | None
    severity_score: int | None
    created_at: datetime
    assigned_officer_id: str | None

    model_config = {"from_attributes": True}


# ── Ward Officer ──────────────────────────────────────────────────────────────

class WardOfficerCreate(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8, description="Initial login password")
    phone: str | None = Field(None, max_length=20)
    ward_id: int = Field(..., description="Ward this officer is responsible for")


class WardOfficerResponse(BaseModel):
    id: str
    full_name: str
    email: str
    phone: str | None
    is_active: bool
    zone_id: int | None
    ward_id: int | None
    ward_number: str | None   # human-readable ward number
    ward_name: str | None     # human-readable ward name
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Zone Wards ──────────────────────────────────────────────────────────────────────────────────

class ZoneWardItem(BaseModel):
    id: int
    ward_number: str
    ward_name: str | None
    has_officer: bool  # True if a ward_officer with ward_id=this ward exists

    model_config = {"from_attributes": True}
