"""
schemas/admin.py — Admin Control Center Pydantic v2 Schemas
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, EmailStr


# ═══════════════════════════════════════════════════════════════════════════════
# Officer management
# ═══════════════════════════════════════════════════════════════════════════════

class OfficerCreateRequest(BaseModel):
    """Body for creating a new officer account (admin only)."""
    full_name: str  = Field(..., min_length=2, max_length=100)
    email:     EmailStr
    phone:     str | None = Field(None, min_length=7, max_length=15)
    password:  str  = Field(..., min_length=8, max_length=100)
    role:      str  = Field("ward_officer", description="ward_officer | zonal_officer | dept_head")
    zone_id:   int | None = Field(None, description="Required for zonal_officer role")
    ward_id:   int | None = Field(None, description="Required for ward_officer role")


class OfficerResponse(BaseModel):
    id:        str
    full_name: str
    email:     str
    phone:     str | None
    role:      str
    is_active: bool
    zone_id:   int | None = None
    ward_id:   int | None = None
    created_at: datetime

    model_config = {"from_attributes": True}



# ═══════════════════════════════════════════════════════════════════════════════
# Request schemas
# ═══════════════════════════════════════════════════════════════════════════════

class ComplaintReassignRequest(BaseModel):
    """Body for reassigning a complaint to a different officer."""
    officer_id: str = Field(
        ...,
        description="UUID of the officer to assign the complaint to",
    )
    reason: str = Field(
        ...,
        min_length=10,
        max_length=500,
        description="Reason for reassignment (audit trail)",
    )


class ComplaintDepartmentOverrideRequest(BaseModel):
    """Body for manually overriding the department."""
    department_id: int = Field(
        ...,
        description="ID of the target department",
    )
    reason: str = Field(
        ...,
        min_length=10,
        max_length=500,
        description="Reason for department override",
    )


class ComplaintEscalationCreate(BaseModel):
    """Body for escalating a complaint."""
    reason: str = Field(
        ...,
        min_length=10,
        max_length=1000,
        description="Detailed reason for escalation",
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Escalation response
# ═══════════════════════════════════════════════════════════════════════════════

class ComplaintEscalationResponse(BaseModel):
    id:           str
    complaint_id: str
    escalated_by: Optional[str]
    reason:       str
    created_at:   datetime

    model_config = {"from_attributes": True}


# ═══════════════════════════════════════════════════════════════════════════════
# Workload responses
# ═══════════════════════════════════════════════════════════════════════════════

class OfficerWorkloadResponse(BaseModel):
    """Per-officer workload summary."""
    officer_id:      str
    officer_name:    str
    email:           str
    assigned_total:  int        # all non-resolved complaints
    pending:         int        # submitted / under_review
    in_progress:     int
    resolved_today:  int
    avg_resolution_hours: Optional[float]


class DepartmentWorkloadResponse(BaseModel):
    """Per-department workload summary."""
    department_id:   int
    department_name: str
    total:           int
    open:            int        # not resolved / rejected
    resolved:        int
    avg_resolution_hours: Optional[float]


# ═══════════════════════════════════════════════════════════════════════════════
# Audit view response
# ═══════════════════════════════════════════════════════════════════════════════

class AuditStatusEntry(BaseModel):
    event:      str             # "status_change" | "escalation" | "reassignment" | "progress"
    actor_id:   Optional[str]
    actor_name: Optional[str]
    detail:     str             # human-readable description
    timestamp:  datetime


class ComplaintAuditResponse(BaseModel):
    complaint_id:    str
    title:           str
    current_status:  str
    department_id:   Optional[int]
    department_name: Optional[str]
    assigned_officer_id:   Optional[str]
    assigned_officer_name: Optional[str]
    duplicate_group_id:    Optional[str]
    matched_complaint_id:  Optional[str]
    similarity_score:      Optional[float]
    ai_category:           Optional[str]
    escalation_count:      int
    total_events:          int
    audit_trail:           list[AuditStatusEntry]


# ═══════════════════════════════════════════════════════════════════════════════
# Officer Ward Assignment schemas
# ═══════════════════════════════════════════════════════════════════════════════

class OfficerAssignmentCreate(BaseModel):
    """Body for assigning an officer to a ward + department."""
    department_id: int = Field(..., description="Department ID")
    ward_id:       int = Field(..., description="Ward ID")


class OfficerAssignmentResponse(BaseModel):
    id:            str
    user_id:       str
    department_id: int
    department_name: str
    ward_id:       int
    ward_name:     str
    ward_number:   str
    assigned_at:   datetime

    model_config = {"from_attributes": True}


class DepartmentItem(BaseModel):
    id:   int
    name: str
    model_config = {"from_attributes": True}


class WardItem(BaseModel):
    id:          int
    name:        str
    ward_number: str
    zone_name:   str
    model_config = {"from_attributes": True}


# ═══════════════════════════════════════════════════════════════════════════════
# User CRUD schemas (admin → manage all users)
# ═══════════════════════════════════════════════════════════════════════════════

class UserListItem(BaseModel):
    """Compact user row for the admin users table."""
    id:            str
    full_name:     str
    email:         str
    phone:         str | None
    role:          str
    auth_provider: str
    is_active:     bool
    zone_id:       int | None
    created_at:    datetime

    model_config = {"from_attributes": True}


class UserCreateRequest(BaseModel):
    """Admin creates a new user (any role, email-auth only)."""
    full_name: str      = Field(..., min_length=2, max_length=100)
    email:     str      = Field(..., description="Must be unique")
    phone:     str | None = Field(None)
    password:  str      = Field(..., min_length=8, max_length=100)
    role:      str      = Field("citizen", description="citizen | ward_officer | zonal_officer | dept_head | admin")
    zone_id:   int | None = Field(None, description="Required for zonal_officer")


class UserUpdateRequest(BaseModel):
    """Admin updates an existing user. All fields optional."""
    full_name:  str | None = Field(None, min_length=2, max_length=100)
    phone:      str | None = None
    role:       str | None = None
    zone_id:    int | None = None
    is_active:  bool | None = None
    password:   str | None = Field(None, min_length=8, description="If provided, resets password")
