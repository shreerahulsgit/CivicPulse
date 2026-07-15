"""
api/administration.py — Municipal Administration Routes

Endpoints:
  POST /departments              Create a department (admin only)
  GET  /departments              List all departments (public)

  POST /jurisdictions            Create a jurisdiction (admin only)
  GET  /jurisdictions            List all jurisdictions (public)

  POST /wards                    Create a ward (admin only)
  GET  /wards                    List wards, filterable by jurisdiction (public)

  POST /officers/assign          Assign an officer to a department+ward (admin only)
  GET  /officers                 List officer assignments (public)

Access control:
  - All POST endpoints require admin/super_admin role.
  - All GET endpoints are public (used by dashboards and maps).
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.api.deps import require_admin
from app.models.user import User
from app.schemas.administration import (
    DepartmentCreate,
    DepartmentResponse,
    JurisdictionCreate,
    JurisdictionResponse,
    WardCreate,
    WardResponse,
    OfficerAssignCreate,
    OfficerAssignmentResponse,
)
from app.services.administration_service import (
    create_department,
    get_departments,
    create_jurisdiction,
    get_jurisdictions,
    create_ward,
    get_wards,
    assign_officer,
    get_officer_assignments,
)

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# Department routes
# ═══════════════════════════════════════════════════════════════════════════════
dept_router = APIRouter(prefix="/departments", tags=["Departments"])


@dept_router.post(
    "",
    response_model=DepartmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a department (Admin only)",
)
def create_dept(
    payload: DepartmentCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> DepartmentResponse:
    try:
        department = create_department(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return DepartmentResponse.model_validate(department)


@dept_router.get(
    "",
    response_model=list[DepartmentResponse],
    status_code=status.HTTP_200_OK,
    summary="List all departments",
)
def list_depts(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
) -> list[DepartmentResponse]:
    departments = get_departments(db, skip=skip, limit=limit)
    return [DepartmentResponse.model_validate(d) for d in departments]


# ═══════════════════════════════════════════════════════════════════════════════
# Jurisdiction routes
# ═══════════════════════════════════════════════════════════════════════════════
jurisdiction_router = APIRouter(prefix="/jurisdictions", tags=["Jurisdictions"])


@jurisdiction_router.post(
    "",
    response_model=JurisdictionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a jurisdiction (Admin only)",
)
def create_juris(
    payload: JurisdictionCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> JurisdictionResponse:
    try:
        jurisdiction = create_jurisdiction(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return JurisdictionResponse.model_validate(jurisdiction)


@jurisdiction_router.get(
    "",
    response_model=list[JurisdictionResponse],
    status_code=status.HTTP_200_OK,
    summary="List all jurisdictions",
)
def list_jurisdictions(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
) -> list[JurisdictionResponse]:
    jurisdictions = get_jurisdictions(db, skip=skip, limit=limit)
    return [JurisdictionResponse.model_validate(j) for j in jurisdictions]


# ═══════════════════════════════════════════════════════════════════════════════
# Ward routes
# ═══════════════════════════════════════════════════════════════════════════════
ward_router = APIRouter(prefix="/wards", tags=["Wards"])


@ward_router.post(
    "",
    response_model=WardResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a ward (Admin only)",
)
def create_ward_endpoint(
    payload: WardCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> WardResponse:
    try:
        ward = create_ward(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return WardResponse.model_validate(ward)


@ward_router.get(
    "",
    response_model=list[WardResponse],
    status_code=status.HTTP_200_OK,
    summary="List wards (filterable by jurisdiction)",
)
def list_wards(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    jurisdiction_id: int | None = Query(None, gt=0, description="Filter by jurisdiction"),
    db: Session = Depends(get_db),
) -> list[WardResponse]:
    wards = get_wards(db, skip=skip, limit=limit, jurisdiction_id=jurisdiction_id)
    return [WardResponse.model_validate(w) for w in wards]


# ═══════════════════════════════════════════════════════════════════════════════
# Officer Assignment routes
# ═══════════════════════════════════════════════════════════════════════════════
officer_router = APIRouter(prefix="/officers", tags=["Officers"])


@officer_router.post(
    "/assign",
    response_model=OfficerAssignmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Assign an officer to a department+ward (Admin only)",
)
def assign_officer_endpoint(
    payload: OfficerAssignCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> OfficerAssignmentResponse:
    try:
        assignment = assign_officer(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return OfficerAssignmentResponse.model_validate(assignment)


@officer_router.get(
    "",
    response_model=list[OfficerAssignmentResponse],
    status_code=status.HTTP_200_OK,
    summary="List officer assignments",
)
def list_officers(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    department_id: int | None = Query(None, gt=0, description="Filter by department"),
    ward_id: int | None = Query(None, gt=0, description="Filter by ward"),
    db: Session = Depends(get_db),
) -> list[OfficerAssignmentResponse]:
    assignments = get_officer_assignments(
        db, skip=skip, limit=limit,
        department_id=department_id, ward_id=ward_id,
    )
    return [OfficerAssignmentResponse.model_validate(a) for a in assignments]
