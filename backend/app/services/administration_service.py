"""
services/administration_service.py — Municipal Administration Business Logic

CRUD operations for departments, jurisdictions, wards, and officer assignments.
Routes never call db.query() directly — they always go through this service.
"""

import uuid
import logging

from sqlalchemy.orm import Session

from app.models.department import Department
from app.models.jurisdiction import Jurisdiction
from app.models.ward import Ward
from app.models.officer_assignment import OfficerAssignment
from app.models.user import User
from app.schemas.administration import (
    DepartmentCreate,
    JurisdictionCreate,
    WardCreate,
    OfficerAssignCreate,
)

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# Departments
# ═══════════════════════════════════════════════════════════════════════════════

def create_department(db: Session, payload: DepartmentCreate) -> Department:
    """Create a new department. Raises ValueError if name is duplicate."""
    existing = db.query(Department).filter(Department.name == payload.name).first()
    if existing:
        raise ValueError(f"Department '{payload.name}' already exists.")

    department = Department(name=payload.name, description=payload.description)
    db.add(department)
    db.flush()
    db.refresh(department)
    logger.info("Department created: id=%s name=%s", department.id, department.name)
    return department


def get_departments(db: Session, skip: int = 0, limit: int = 50) -> list[Department]:
    """List all departments, paginated."""
    limit = min(limit, 100)
    return (
        db.query(Department)
        .order_by(Department.name.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Jurisdictions
# ═══════════════════════════════════════════════════════════════════════════════

def create_jurisdiction(db: Session, payload: JurisdictionCreate) -> Jurisdiction:
    """Create a new jurisdiction. Raises ValueError if name is duplicate."""
    existing = db.query(Jurisdiction).filter(Jurisdiction.name == payload.name).first()
    if existing:
        raise ValueError(f"Jurisdiction '{payload.name}' already exists.")

    jurisdiction = Jurisdiction(name=payload.name, type=payload.type)
    db.add(jurisdiction)
    db.flush()
    db.refresh(jurisdiction)
    logger.info("Jurisdiction created: id=%s name=%s", jurisdiction.id, jurisdiction.name)
    return jurisdiction


def get_jurisdictions(db: Session, skip: int = 0, limit: int = 50) -> list[Jurisdiction]:
    """List all jurisdictions, paginated."""
    limit = min(limit, 100)
    return (
        db.query(Jurisdiction)
        .order_by(Jurisdiction.name.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Wards
# ═══════════════════════════════════════════════════════════════════════════════

def create_ward(db: Session, payload: WardCreate) -> Ward:
    """
    Create a new ward under a jurisdiction.
    Validates that the jurisdiction exists.
    """
    jurisdiction = db.get(Jurisdiction, payload.jurisdiction_id)
    if not jurisdiction:
        raise ValueError(f"Jurisdiction with id {payload.jurisdiction_id} does not exist.")

    ward = Ward(
        jurisdiction_id = payload.jurisdiction_id,
        ward_number     = payload.ward_number,
        zone_number     = payload.zone_number,
        ward_name       = payload.ward_name,
        polygon_geojson = payload.polygon_geojson,
    )
    db.add(ward)
    db.flush()
    db.refresh(ward)
    logger.info(
        "Ward created: id=%s ward_number=%s jurisdiction=%s",
        ward.id, ward.ward_number, payload.jurisdiction_id,
    )
    return ward


def get_wards(
    db: Session,
    skip: int = 0,
    limit: int = 50,
    jurisdiction_id: int | None = None,
) -> list[Ward]:
    """List wards, optionally filtered by jurisdiction, paginated."""
    limit = min(limit, 100)
    query = db.query(Ward)

    if jurisdiction_id:
        query = query.filter(Ward.jurisdiction_id == jurisdiction_id)

    return (
        query
        .order_by(Ward.ward_number.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Officer Assignments
# ═══════════════════════════════════════════════════════════════════════════════

def assign_officer(db: Session, payload: OfficerAssignCreate) -> OfficerAssignment:
    """
    Assign a user as an officer for a department in a ward.
    Validates that the user, department, and ward all exist.
    """
    # Validate user exists
    user = db.get(User, payload.user_id)
    if not user:
        raise ValueError(f"User with id '{payload.user_id}' does not exist.")

    # Validate department exists
    department = db.get(Department, payload.department_id)
    if not department:
        raise ValueError(f"Department with id {payload.department_id} does not exist.")

    # Validate ward exists
    ward = db.get(Ward, payload.ward_id)
    if not ward:
        raise ValueError(f"Ward with id {payload.ward_id} does not exist.")

    # Check for duplicate assignment
    existing = (
        db.query(OfficerAssignment)
        .filter(
            OfficerAssignment.user_id == payload.user_id,
            OfficerAssignment.department_id == payload.department_id,
            OfficerAssignment.ward_id == payload.ward_id,
        )
        .first()
    )
    if existing:
        raise ValueError(
            f"User '{user.full_name}' is already assigned to "
            f"department '{department.name}' in ward '{ward.ward_name}'."
        )

    assignment = OfficerAssignment(
        id            = str(uuid.uuid4()),
        user_id       = payload.user_id,
        department_id = payload.department_id,
        ward_id       = payload.ward_id,
    )
    db.add(assignment)
    db.flush()
    db.refresh(assignment)

    logger.info(
        "Officer assigned: id=%s user=%s dept=%s ward=%s",
        assignment.id, payload.user_id, payload.department_id, payload.ward_id,
    )
    return assignment


def get_officer_assignments(
    db: Session,
    skip: int = 0,
    limit: int = 50,
    department_id: int | None = None,
    ward_id: int | None = None,
) -> list[OfficerAssignment]:
    """List officer assignments, optionally filtered by department or ward."""
    limit = min(limit, 100)
    query = db.query(OfficerAssignment)

    if department_id:
        query = query.filter(OfficerAssignment.department_id == department_id)
    if ward_id:
        query = query.filter(OfficerAssignment.ward_id == ward_id)

    return (
        query
        .order_by(OfficerAssignment.assigned_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
