"""
schemas/complaint.py — Pydantic v2 Complaint Schemas

Schemas:
  LocationCreate          — lat/lng/address for the complaint's geolocation
  ComplaintCreate         — input for POST /complaints
  ComplaintStatusUpdate   — input for PATCH /complaints/{id}/status
  CategoryResponse        — embedded category in complaint responses
  LocationResponse        — embedded location in complaint responses
  ComplaintImageResponse   — embedded image in complaint responses
  StatusHistoryResponse    — embedded status change in detail responses
  ComplaintResponse        — list-level complaint (no full history)
  ComplaintDetailResponse  — single-complaint view with images + status history
"""

from datetime import datetime

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)

from app.models.complaint import ComplaintStatus


# ═══════════════════════════════════════════════════════════════════════════════
# Input schemas
# ═══════════════════════════════════════════════════════════════════════════════

class LocationCreate(BaseModel):
    latitude: float = Field(
        ..., ge=-90.0, le=90.0,
        examples=[19.0760],
        description="WGS-84 latitude",
    )
    longitude: float = Field(
        ..., ge=-180.0, le=180.0,
        examples=[72.8777],
        description="WGS-84 longitude",
    )
    address: str | None = Field(
        default=None,
        max_length=500,
        examples=["Bandra West, Mumbai 400050"],
        description="Human-readable address (optional — can be reverse-geocoded)",
    )


class ComplaintCreate(BaseModel):
    """Payload for POST /complaints."""

    title: str = Field(
        ..., min_length=5, max_length=200,
        examples=["Pothole on SV Road near Andheri Station"],
    )
    description: str = Field(
        ..., min_length=10, max_length=5000,
        examples=["There is a large pothole near the bus stop that is causing accidents."],
    )
    category_id: int = Field(
        ..., gt=0,
        examples=[1],
        description="ID of the complaint category",
    )
    location: LocationCreate
    image_urls: list[str] = Field(
        default=[],
        max_length=10,
        description="List of image URLs/paths (max 10)",
    )

    @field_validator("title", mode="before")
    @classmethod
    def strip_title(cls, v: str) -> str:
        return v.strip()


class ComplaintStatusUpdate(BaseModel):
    """Payload for PATCH /complaints/{id}/status."""

    status: ComplaintStatus = Field(
        ...,
        examples=["under_review"],
        description="New status value",
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Response schemas
# ═══════════════════════════════════════════════════════════════════════════════

class CategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    description: str | None


class LocationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    latitude: float
    longitude: float
    address: str | None


class ComplaintImageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    image_url: str
    public_id: str | None = None
    created_at: datetime


class StatusHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    old_status: str
    new_status: str
    updated_by: str | None
    updated_at: datetime


class UserBriefResponse(BaseModel):
    """Minimal user info embedded in complaint responses."""
    model_config = ConfigDict(from_attributes=True)
    id: str
    full_name: str
    email: str


class FeedbackResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id:         str
    rating:     int
    comment:    str | None
    created_at: datetime


# ── List-level response ──────────────────────────────────────────────────────
class ComplaintResponse(BaseModel):
    """Used in GET /complaints and GET /complaints/my (list views)."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    description: str
    status: ComplaintStatus
    severity_score: float | None
    ai_category: str | None
    duplicate_group_id: str | None
    created_at: datetime
    updated_at: datetime

    # Routing fields (auto-populated)
    ward_id:             int | None = None
    jurisdiction_id:     int | None = None
    department_id:       int | None = None
    assigned_officer_id: str | None = None

    # Embedded relations
    user: UserBriefResponse
    category: CategoryResponse
    location: LocationResponse


# ── Detail-level response ────────────────────────────────────────────────────
class ComplaintDetailResponse(ComplaintResponse):
    """Used in GET /complaints/{id} — includes images, status history, and resolution data."""

    images:         list[ComplaintImageResponse] = []
    status_history: list[StatusHistoryResponse]  = []

    # Resolution / verification fields
    resolution_note:      str | None = None
    resolution_photo_url: str | None = None
    auto_close_at:        datetime | None = None
    citizen_verdict:      str | None = None
    citizen_verdict_at:   datetime | None = None
    feedback:             FeedbackResponse | None = None
