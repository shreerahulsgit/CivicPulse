"""
schemas/officer.py — Officer Operations Pydantic v2 Schemas

Schemas:
  ProgressCreate              — POST /officer/complaints/{id}/progress
  ProgressResponse            — response for a single progress update
  ResolutionImageResponse     — response for a single resolution image
  ComplaintTimelineEntry      — a single event in the complaint timeline
  ComplaintTimelineResponse   — full timeline for GET /complaints/{id}/timeline
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.complaint_resolution_image import ResolutionImageType


# ═══════════════════════════════════════════════════════════════════════════════
# Progress Update
# ═══════════════════════════════════════════════════════════════════════════════

class ProgressCreate(BaseModel):
    """Input for POST /officer/complaints/{id}/progress."""
    message: str = Field(
        ..., min_length=5, max_length=2000,
        examples=["Arrived on site. Assessment underway."],
        description="Officer progress note (min 5 chars)",
    )


class ProgressResponse(BaseModel):
    """Response for a single progress update."""
    model_config = ConfigDict(from_attributes=True)

    id:           str
    complaint_id: str
    officer_id:   str
    message:      str
    created_at:   datetime


# ═══════════════════════════════════════════════════════════════════════════════
# Resolution Image
# ═══════════════════════════════════════════════════════════════════════════════

class ResolutionImageResponse(BaseModel):
    """Response for a single resolution image."""
    model_config = ConfigDict(from_attributes=True)

    id:           str
    complaint_id: str
    uploaded_by:  str | None
    public_id:    str
    secure_url:   str
    image_type:   ResolutionImageType
    uploaded_at:  datetime


# ═══════════════════════════════════════════════════════════════════════════════
# Timeline
# ═══════════════════════════════════════════════════════════════════════════════

class ComplaintTimelineEntry(BaseModel):
    """A single chronological event in the complaint timeline."""
    model_config = ConfigDict(from_attributes=True)

    event_type: Literal[
        "status_change", "progress_update", "resolution_image"
    ]
    timestamp:  datetime
    actor_id:   str | None = None
    actor_name: str | None = None

    # Status change fields
    old_status: str | None = None
    new_status: str | None = None

    # Progress update fields
    message: str | None = None

    # Resolution image fields
    secure_url:  str | None = None
    public_id:   str | None = None
    image_type:  str | None = None


class ComplaintTimelineResponse(BaseModel):
    """Full timeline for GET /complaints/{id}/timeline."""
    complaint_id: str
    total_events: int
    timeline:     list[ComplaintTimelineEntry]
