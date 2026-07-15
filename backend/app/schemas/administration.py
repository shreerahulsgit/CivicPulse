"""
schemas/administration.py — Municipal Administration Pydantic Schemas

Schemas for departments, jurisdictions, wards, and officer assignments.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.jurisdiction import JurisdictionType


# ═══════════════════════════════════════════════════════════════════════════════
# Department
# ═══════════════════════════════════════════════════════════════════════════════

class DepartmentCreate(BaseModel):
    name: str = Field(
        ..., min_length=2, max_length=150,
        examples=["Roads & Infrastructure"],
    )
    description: str | None = Field(
        default=None, max_length=500,
        examples=["Handles road maintenance, potholes, and footpath repairs"],
    )


class DepartmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None


# ═══════════════════════════════════════════════════════════════════════════════
# Jurisdiction
# ═══════════════════════════════════════════════════════════════════════════════

class JurisdictionCreate(BaseModel):
    name: str = Field(
        ..., min_length=2, max_length=200,
        examples=["Brihanmumbai Municipal Corporation"],
    )
    type: JurisdictionType = Field(
        ..., examples=["corporation"],
    )


class JurisdictionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    type: JurisdictionType


# ═══════════════════════════════════════════════════════════════════════════════
# Ward
# ═══════════════════════════════════════════════════════════════════════════════

class WardCreate(BaseModel):
    jurisdiction_id: int = Field(..., gt=0, examples=[1])
    ward_number: str = Field(
        ..., min_length=1, max_length=20,
        examples=["W-14"],
    )
    zone_number: str | None = Field(
        default=None, max_length=20,
        examples=["Z-3"],
    )
    ward_name: str = Field(
        ..., min_length=2, max_length=200,
        examples=["Andheri West"],
    )
    polygon_geojson: str | None = Field(
        default=None,
        description="GeoJSON polygon boundary for map rendering",
    )


class WardResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    jurisdiction_id: int
    ward_number: str
    zone_number: str | None
    ward_name: str
    polygon_geojson: str | None

    # Embedded
    jurisdiction: JurisdictionResponse | None = None


# ═══════════════════════════════════════════════════════════════════════════════
# Officer Assignment
# ═══════════════════════════════════════════════════════════════════════════════

class UserBriefResponse(BaseModel):
    """Minimal user info for embedding in assignment responses."""
    model_config = ConfigDict(from_attributes=True)
    id: str
    full_name: str
    email: str


class OfficerAssignCreate(BaseModel):
    user_id: str = Field(
        ..., min_length=36, max_length=36,
        examples=["a6d3049e-f0e6-4cf8-aa78-36b2ace38202"],
        description="UUID of the user to assign as officer",
    )
    department_id: int = Field(..., gt=0, examples=[1])
    ward_id: int = Field(..., gt=0, examples=[1])


class OfficerAssignmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    department_id: int
    ward_id: int
    assigned_at: datetime

    # Embedded relations
    user: UserBriefResponse | None = None
    department: DepartmentResponse | None = None
    ward: WardResponse | None = None
