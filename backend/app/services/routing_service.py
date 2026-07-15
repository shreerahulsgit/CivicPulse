"""
services/routing_service.py — Complaint Auto-Routing Engine

Maps complaint categories to municipal departments and auto-assigns officers.

Functions:
  get_department_for_category()  — category name → Department ORM object
  assign_officer()               — pick best officer for dept+ward
  auto_route_complaint()         — full pipeline: geo-detect + dept-map + assign

Category → Department mapping (DB name must match exactly):
  Pothole            → Roads & Infrastructure
  Water Supply       → Water Supply
  Electricity        → Electricity & Street Lights
  Sanitation         → Sanitation & Waste Management
  Public Safety      → Public Safety
  Noise              → Noise & Pollution Control
  Other              → General Administration
"""

import logging
from typing import Optional

from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.department import Department
from app.models.officer_assignment import OfficerAssignment
from app.models.user import User
from app.services.geospatial_service import WardMatch, find_ward

logger = logging.getLogger(__name__)


# ── Category → Department name mapping ──────────────────────────────────────
# Keys must match Category.name exactly (case-sensitive).
# Values must match Department.name exactly.
CATEGORY_DEPARTMENT_MAP: dict[str, str] = {
    "Pothole":       "Roads & Infrastructure",
    "Water Supply":  "Water Supply",
    "Electricity":   "Electricity & Street Lights",
    "Sanitation":    "Sanitation & Waste Management",
    "Public Safety": "Public Safety",
    "Noise":         "Noise & Pollution Control",
    "Other":         "General Administration",
}

# Fallback department used when no mapping exists
DEFAULT_DEPARTMENT = "General Administration"


# ═══════════════════════════════════════════════════════════════════════════════
# Department mapping
# ═══════════════════════════════════════════════════════════════════════════════

def get_department_for_category(
    db: Session,
    category_id: int,
) -> Optional[Department]:
    """
    Resolve a complaint category ID → Department ORM object.

    Steps:
      1. Fetch the Category by ID.
      2. Look up its name in CATEGORY_DEPARTMENT_MAP.
      3. Fetch the Department by name.
      4. Fall back to DEFAULT_DEPARTMENT if no mapping exists.

    Returns None if neither the mapped nor the fallback department exists in DB.
    """
    category = db.get(Category, category_id)
    if not category:
        logger.warning("Category %s not found, cannot map to department", category_id)
        return None

    dept_name = CATEGORY_DEPARTMENT_MAP.get(category.name, DEFAULT_DEPARTMENT)
    department = (
        db.query(Department)
        .filter(Department.name == dept_name)
        .first()
    )

    if not department and dept_name != DEFAULT_DEPARTMENT:
        # Try the fallback
        logger.warning(
            "Department '%s' not found for category '%s', trying fallback '%s'",
            dept_name, category.name, DEFAULT_DEPARTMENT,
        )
        department = (
            db.query(Department)
            .filter(Department.name == DEFAULT_DEPARTMENT)
            .first()
        )

    if department:
        logger.info(
            "Category '%s' → Department '%s' (id=%s)",
            category.name, department.name, department.id,
        )
    else:
        logger.warning(
            "No department found for category '%s' — complaint will be unassigned",
            category.name,
        )

    return department


# ═══════════════════════════════════════════════════════════════════════════════
# Officer assignment
# ═══════════════════════════════════════════════════════════════════════════════

def assign_officer(
    db: Session,
    department_id: int,
    ward_id: int,
) -> Optional[User]:
    """
    Find the best officer to handle a complaint in the given ward.

    Strategy (priority order):
      1. Ward Officer directly assigned to this ward (User.ward_id == ward_id).
      2. Officer assigned to this exact department AND ward via OfficerAssignment (legacy).
      3. Officer assigned to this department in ANY ward (overflow).
      4. None — complaint will be unassigned until admin manually assigns.

    Returns the User ORM object of the selected officer, or None.
    """
    from app.models.user import UserRole

    # ── Priority 1: Ward officer with User.ward_id == ward_id ───────────────
    ward_officer = (
        db.query(User)
        .filter(
            User.role == UserRole.WARD_OFFICER,
            User.ward_id == ward_id,
            User.is_active == True,
        )
        .first()
    )
    if ward_officer:
        logger.info(
            "Assigned ward officer: user=%s ward=%s (direct ward assignment)",
            ward_officer.id, ward_id,
        )
        return ward_officer

    # ── Priority 2: Exact match via OfficerAssignment (dept + ward) ─────────
    assignment = (
        db.query(OfficerAssignment)
        .filter(
            OfficerAssignment.department_id == department_id,
            OfficerAssignment.ward_id == ward_id,
        )
        .first()
    )

    if assignment:
        officer = db.get(User, assignment.user_id)
        if officer and officer.is_active:
            logger.info(
                "Assigned officer: user=%s dept=%s ward=%s (OfficerAssignment exact match)",
                officer.id, department_id, ward_id,
            )
            return officer

    # ── Priority 3: Overflow — same dept, any ward ────────────────────────
    overflow = (
        db.query(OfficerAssignment)
        .filter(OfficerAssignment.department_id == department_id)
        .first()
    )

    if overflow:
        officer = db.get(User, overflow.user_id)
        if officer and officer.is_active:
            logger.info(
                "Assigned officer: user=%s dept=%s ward=%s (overflow — no exact ward match)",
                officer.id, department_id, ward_id,
            )
            return officer

    logger.warning(
        "No active officer found for dept=%s ward=%s — complaint will be unassigned",
        department_id, ward_id,
    )
    return None


# ═══════════════════════════════════════════════════════════════════════════════
# Full auto-routing pipeline
# ═══════════════════════════════════════════════════════════════════════════════

class RoutingResult:
    """
    Result of auto_route_complaint(). All fields are nullable — routing is
    best-effort and should never block complaint creation.
    """
    __slots__ = (
        "ward_id", "ward_name", "ward_number", "zone_number",
        "zone_id", "zone_name",
        "jurisdiction_id", "department_id", "assigned_officer_id",
    )

    def __init__(
        self,
        ward_id:             int | None = None,
        ward_name:           str | None = None,
        ward_number:         str | None = None,
        zone_number:         str | None = None,
        zone_id:             int | None = None,
        zone_name:           str | None = None,
        jurisdiction_id:     int | None = None,
        department_id:       int | None = None,
        assigned_officer_id: str | None = None,
    ):
        self.ward_id             = ward_id
        self.ward_name           = ward_name
        self.ward_number         = ward_number
        self.zone_number         = zone_number
        self.zone_id             = zone_id
        self.zone_name           = zone_name
        self.jurisdiction_id     = jurisdiction_id
        self.department_id       = department_id
        self.assigned_officer_id = assigned_officer_id

    def __repr__(self) -> str:
        return (
            f"<RoutingResult ward={self.ward_id} zone={self.zone_id} "
            f"jurisdiction={self.jurisdiction_id} "
            f"dept={self.department_id} officer={self.assigned_officer_id}>"
        )


def auto_route_complaint(
    db: Session,
    latitude: float,
    longitude: float,
    category_id: int,
) -> RoutingResult:
    """
    Full routing pipeline for a newly created complaint.

    Steps:
      1. Geo-detect ward + jurisdiction from GPS coordinates.
      2. Map category → department.
      3. Auto-assign officer for dept + ward.

    This function NEVER raises — all errors are caught and logged.
    The complaint is always created, even if routing partially fails.

    Returns RoutingResult with all detected values (some may be None).
    """
    result = RoutingResult()

    # ── Step 1: Geo-detect ward ──────────────────────────────────────────────
    try:
        ward_match: WardMatch | None = find_ward(db, latitude, longitude)
        if ward_match:
            result.ward_id         = ward_match.ward_id
            result.ward_name       = ward_match.ward_name
            result.ward_number     = ward_match.ward_number
            result.zone_number     = ward_match.zone_number
            result.zone_id         = ward_match.zone_id
            result.zone_name       = ward_match.zone_name
            result.jurisdiction_id = ward_match.jurisdiction_id
    except Exception as exc:
        logger.error("Geo-detection failed for (%.6f, %.6f): %s", latitude, longitude, exc)

    # ── Step 2: Map category → department ───────────────────────────────────
    try:
        department = get_department_for_category(db, category_id)
        if department:
            result.department_id = department.id
    except Exception as exc:
        logger.error("Department mapping failed for category %s: %s", category_id, exc)

    # ── Step 3: Assign officer ───────────────────────────────────────────────
    try:
        if result.department_id and result.ward_id:
            officer = assign_officer(db, result.department_id, result.ward_id)
            if officer:
                result.assigned_officer_id = officer.id
    except Exception as exc:
        logger.error(
            "Officer assignment failed for dept=%s ward=%s: %s",
            result.department_id, result.ward_id, exc,
        )

    logger.info(
        "Routing complete: ward=%s zone=%s jurisdiction=%s dept=%s officer=%s",
        result.ward_id, result.zone_id, result.jurisdiction_id,
        result.department_id, result.assigned_officer_id,
    )
    return result
