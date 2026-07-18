"""
api/admin.py — Admin Control Center Endpoints

All endpoints require Admin role (enforced via require_admin dependency).

Endpoints:
  PATCH /admin/complaints/{id}/reassign    — Reassign to different officer
  PATCH /admin/complaints/{id}/department  — Override department
  PATCH /admin/complaints/{id}/officer     — Force-assign officer
  POST  /admin/complaints/{id}/escalate    — Escalate complaint
  GET   /admin/workloads/officers          — Officer workload summary
  GET   /admin/workloads/departments       — Department workload summary
  GET   /admin/complaints/{id}/audit       — Full audit trail
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.complaint import Complaint
from app.models.user import User, UserRole, AuthProvider
from app.schemas.admin import (
    ComplaintAuditResponse,
    ComplaintDepartmentOverrideRequest,
    ComplaintEscalationCreate,
    ComplaintEscalationResponse,
    ComplaintReassignRequest,
    DepartmentWorkloadResponse,
    OfficerCreateRequest,
    OfficerResponse,
    OfficerWorkloadResponse,
)
from app.services.admin_service import (
    escalate_complaint,
    get_complaint_audit,
    get_department_workloads,
    get_officer_workloads,
    override_department,
    override_officer,
    reassign_complaint,
)
from app.services.auth_service import get_user_by_email, hash_password

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["Admin"])


# ── Auth dependency ───────────────────────────────────────────────────────────

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Dependency: raises 403 if user is not an admin."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )
    return current_user


# ── Error wrapper ─────────────────────────────────────────────────────────────

def _handle(fn, *args, **kwargs):
    """Run service call and convert ValueError → 400/404."""
    try:
        return fn(*args, **kwargs)
    except ValueError as exc:
        msg = str(exc)
        code = status.HTTP_404_NOT_FOUND if "not found" in msg.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=msg)


# ═══════════════════════════════════════════════════════════════════════════════
# Complaint Management
# ═══════════════════════════════════════════════════════════════════════════════

@router.patch(
    "/complaints/{complaint_id}/reassign",
    status_code=status.HTTP_200_OK,
    summary="Reassign complaint to a different officer",
)
def admin_reassign(
    complaint_id: str,
    payload:      ComplaintReassignRequest,
    admin:        User    = Depends(require_admin),
    db:           Session = Depends(get_db),
) -> dict:
    complaint = _handle(reassign_complaint, db, admin, complaint_id, payload)
    return {
        "message": "Complaint reassigned successfully.",
        "complaint_id": complaint.id,
        "assigned_officer_id": complaint.assigned_officer_id,
    }


@router.patch(
    "/complaints/{complaint_id}/department",
    status_code=status.HTTP_200_OK,
    summary="Manually override department",
)
def admin_override_department(
    complaint_id: str,
    payload:      ComplaintDepartmentOverrideRequest,
    admin:        User    = Depends(require_admin),
    db:           Session = Depends(get_db),
) -> dict:
    complaint = _handle(override_department, db, admin, complaint_id, payload)
    return {
        "message": "Department overridden successfully.",
        "complaint_id": complaint.id,
        "department_id": complaint.department_id,
    }


@router.patch(
    "/complaints/{complaint_id}/officer",
    status_code=status.HTTP_200_OK,
    summary="Force-assign a specific officer (bypasses routing engine)",
)
def admin_override_officer(
    complaint_id: str,
    payload:      ComplaintReassignRequest,
    admin:        User    = Depends(require_admin),
    db:           Session = Depends(get_db),
) -> dict:
    complaint = _handle(override_officer, db, admin, complaint_id, payload)
    return {
        "message": "Officer assignment overridden successfully.",
        "complaint_id": complaint.id,
        "assigned_officer_id": complaint.assigned_officer_id,
    }


@router.post(
    "/complaints/{complaint_id}/escalate",
    response_model=ComplaintEscalationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Escalate a complaint",
)
def admin_escalate(
    complaint_id: str,
    payload:      ComplaintEscalationCreate,
    admin:        User    = Depends(require_admin),
    db:           Session = Depends(get_db),
) -> ComplaintEscalationResponse:
    escalation = _handle(escalate_complaint, db, admin, complaint_id, payload)
    return ComplaintEscalationResponse.model_validate(escalation)


@router.get(
    "/complaints/{complaint_id}/audit",
    response_model=ComplaintAuditResponse,
    summary="Full audit trail for a complaint",
)
def admin_audit(
    complaint_id: str,
    admin:        User    = Depends(require_admin),
    db:           Session = Depends(get_db),
) -> ComplaintAuditResponse:
    return _handle(get_complaint_audit, db, complaint_id)


# ═══════════════════════════════════════════════════════════════════════════════
# Workloads
# ═══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/workloads/officers",
    response_model=list[OfficerWorkloadResponse],
    summary="Officer workload summary (admin only)",
)
def admin_officer_workloads(
    admin: User    = Depends(require_admin),
    db:    Session = Depends(get_db),
) -> list[OfficerWorkloadResponse]:
    return get_officer_workloads(db)


@router.get(
    "/workloads/departments",
    response_model=list[DepartmentWorkloadResponse],
    summary="Department workload summary (admin only)",
)
def admin_department_workloads(
    admin: User    = Depends(require_admin),
    db:    Session = Depends(get_db),
) -> list[DepartmentWorkloadResponse]:
    return get_department_workloads(db)


# ═══════════════════════════════════════════════════════════════════════════════
# Officer Management
# ═══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/officers",
    response_model=OfficerResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new officer account (admin only)",
)
def admin_create_officer(
    payload: OfficerCreateRequest,
    admin:   User    = Depends(require_admin),
    db:      Session = Depends(get_db),
) -> OfficerResponse:
    import uuid

    # Validate role
    allowed_roles = {UserRole.WARD_OFFICER, UserRole.ZONAL_OFFICER, UserRole.DEPT_HEAD}
    try:
        chosen_role = UserRole(payload.role)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role '{payload.role}'. Must be one of: ward_officer, zonal_officer, dept_head.",
        )
    if chosen_role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Officers can only be: ward_officer, zonal_officer, or dept_head.",
        )

    # Zonal officer must have a zone
    if chosen_role == UserRole.ZONAL_OFFICER and not payload.zone_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="zone_id is required when role is zonal_officer.",
        )

    # Ward officer must have a ward
    if chosen_role == UserRole.WARD_OFFICER and not payload.ward_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="ward_id is required when role is ward_officer.",
        )

    # Check for duplicate email
    if get_user_by_email(db, payload.email.lower().strip()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"An account with email '{payload.email}' already exists.",
        )

    officer = User(
        id            = str(uuid.uuid4()),
        full_name     = payload.full_name,
        email         = payload.email.lower().strip(),
        phone         = payload.phone,
        password_hash = hash_password(payload.password) if payload.password else None,
        auth_provider = AuthProvider.EMAIL if payload.password else AuthProvider.GOOGLE,
        role          = chosen_role,
        zone_id       = payload.zone_id if chosen_role == UserRole.ZONAL_OFFICER else None,
        ward_id       = payload.ward_id if chosen_role == UserRole.WARD_OFFICER else None,
        is_active     = True,
    )
    db.add(officer)
    db.commit()
    db.refresh(officer)

    logger.info(
        "Admin %s created officer: id=%s email=%s role=%s zone_id=%s ward_id=%s",
        admin.id, officer.id, officer.email, officer.role.value, officer.zone_id, officer.ward_id,
    )
    return OfficerResponse.model_validate(officer)


@router.get(
    "/officers",
    response_model=list[OfficerResponse],
    status_code=status.HTTP_200_OK,
    summary="List all officers (admin only)",
)
def admin_list_officers(
    admin: User    = Depends(require_admin),
    db:    Session = Depends(get_db),
) -> list[OfficerResponse]:
    officers = (
        db.query(User)
        .filter(User.role.in_([
            UserRole.WARD_OFFICER,
            UserRole.ZONAL_OFFICER,
            UserRole.DEPT_HEAD,
        ]))
        .order_by(User.created_at.desc())
        .all()
    )
    return [OfficerResponse.model_validate(o) for o in officers]


# ═══════════════════════════════════════════════════════════════════════════════
# Officer Ward Assignments
# ═══════════════════════════════════════════════════════════════════════════════

from app.models.officer_assignment import OfficerAssignment
from app.models.department import Department
from app.models.ward import Ward
from app.schemas.admin import (
    OfficerAssignmentCreate, OfficerAssignmentResponse,
    DepartmentItem, WardItem,
)
import uuid as _uuid


@router.get(
    "/officers/{officer_id}/assignments",
    response_model=list[OfficerAssignmentResponse],
    summary="List ward+department assignments for an officer",
)
def admin_list_officer_assignments(
    officer_id: str,
    admin: User    = Depends(require_admin),
    db:    Session = Depends(get_db),
) -> list[OfficerAssignmentResponse]:
    assignments = (
        db.query(OfficerAssignment)
        .filter(OfficerAssignment.user_id == officer_id)
        .all()
    )
    result = []
    for a in assignments:
        dept = db.get(Department, a.department_id)
        ward = db.get(Ward, a.ward_id)
        result.append(OfficerAssignmentResponse(
            id=a.id,
            user_id=a.user_id,
            department_id=a.department_id,
            department_name=dept.name if dept else "Unknown",
            ward_id=a.ward_id,
            ward_name=ward.name if ward else "Unknown",
            ward_number=ward.ward_number if ward else "?",
            assigned_at=a.assigned_at,
        ))
    return result


@router.post(
    "/officers/{officer_id}/assignments",
    response_model=OfficerAssignmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Assign officer to a ward + department",
)
def admin_assign_officer(
    officer_id: str,
    payload:    OfficerAssignmentCreate,
    admin:      User    = Depends(require_admin),
    db:         Session = Depends(get_db),
) -> OfficerAssignmentResponse:
    # Check officer exists
    officer = db.get(User, officer_id)
    if not officer:
        raise HTTPException(status_code=404, detail="Officer not found.")

    # Check duplicate
    existing = (
        db.query(OfficerAssignment)
        .filter(
            OfficerAssignment.user_id == officer_id,
            OfficerAssignment.department_id == payload.department_id,
            OfficerAssignment.ward_id == payload.ward_id,
        ).first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Officer already assigned to this ward + department.")

    assignment = OfficerAssignment(
        id=str(_uuid.uuid4()),
        user_id=officer_id,
        department_id=payload.department_id,
        ward_id=payload.ward_id,
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)

    dept = db.get(Department, assignment.department_id)
    ward = db.get(Ward, assignment.ward_id)
    return OfficerAssignmentResponse(
        id=assignment.id,
        user_id=assignment.user_id,
        department_id=assignment.department_id,
        department_name=dept.name if dept else "Unknown",
        ward_id=assignment.ward_id,
        ward_name=ward.name if ward else "Unknown",
        ward_number=ward.ward_number if ward else "?",
        assigned_at=assignment.assigned_at,
    )


@router.delete(
    "/officers/{officer_id}/assignments/{assignment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a ward assignment from an officer",
)
def admin_delete_officer_assignment(
    officer_id:    str,
    assignment_id: str,
    admin: User    = Depends(require_admin),
    db:    Session = Depends(get_db),
):
    assignment = (
        db.query(OfficerAssignment)
        .filter(
            OfficerAssignment.id == assignment_id,
            OfficerAssignment.user_id == officer_id,
        ).first()
    )
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found.")
    db.delete(assignment)
    db.commit()


# ── Lookup helpers for dropdowns ─────────────────────────────────────────────

@router.get("/departments", response_model=list[DepartmentItem], summary="List all departments")
def admin_list_departments(
    admin: User    = Depends(require_admin),
    db:    Session = Depends(get_db),
) -> list[DepartmentItem]:
    return db.query(Department).order_by(Department.name).all()


@router.get("/wards", response_model=list[WardItem], summary="List all wards (for assignment dropdown)")
def admin_list_wards(
    admin: User    = Depends(require_admin),
    db:    Session = Depends(get_db),
) -> list[WardItem]:
    wards = db.query(Ward).order_by(Ward.ward_number).all()
    result = []
    for w in wards:
        zone_name = w.zone.zone_name if w.zone else "Unknown"
        result.append(WardItem(
            id=w.id,
            name=w.ward_name,
            ward_number=w.ward_number,
            zone_name=zone_name,
        ))
    return result


# ═══════════════════════════════════════════════════════════════════════════════
# Admin — All Complaints (with full filters)
# ═══════════════════════════════════════════════════════════════════════════════

from app.models.complaint import Complaint, ComplaintStatus
from app.schemas.complaint import ComplaintResponse
from fastapi import Query as FQuery
from sqlalchemy import or_


@router.get(
    "/complaints",
    response_model=list[ComplaintResponse],
    summary="List all complaints (admin — full filters)",
)
def admin_list_complaints(
    skip:        int = FQuery(0, ge=0),
    limit:       int = FQuery(50, ge=1, le=200),
    status_f:    str | None = FQuery(None, alias="status"),
    category_id: int | None = FQuery(None),
    ward_id:     int | None = FQuery(None),
    officer_id:  str | None = FQuery(None),
    dept_id:     int | None = FQuery(None),
    search:      str | None = FQuery(None),
    admin: User    = Depends(require_admin),
    db:    Session = Depends(get_db),
) -> list[ComplaintResponse]:
    q = db.query(Complaint)

    if status_f:
        try:
            q = q.filter(Complaint.status == ComplaintStatus(status_f))
        except ValueError:
            pass
    if category_id:
        q = q.filter(Complaint.category_id == category_id)
    if ward_id:
        q = q.filter(Complaint.ward_id == ward_id)
    if officer_id:
        q = q.filter(Complaint.assigned_officer_id == officer_id)
    if dept_id:
        q = q.filter(Complaint.department_id == dept_id)
    if search:
        like = f"%{search}%"
        q = q.filter(or_(
            Complaint.title.ilike(like),
            Complaint.description.ilike(like),
        ))

    complaints = q.order_by(Complaint.created_at.desc()).offset(skip).limit(limit).all()
    return [ComplaintResponse.model_validate(c) for c in complaints]


# ═══════════════════════════════════════════════════════════════════════════════
# Admin — AI Status
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/ai/status", summary="Check Gemini AI availability")
def ai_status(admin: User = Depends(require_admin)):
    from app.services.gemini_service import is_available
    return {
        "gemini_available": is_available(),
        "model": "gemini-1.5-flash",
        "features": ["complaint_classification", "duplicate_detection"],
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Admin — User CRUD
# ═══════════════════════════════════════════════════════════════════════════════

from app.schemas.admin import (
    UserListItem,
    UserCreateRequest,
    UserUpdateRequest,
)


@router.get("/users", response_model=list[UserListItem], summary="List all users")
def admin_list_users(
    skip:        int         = 0,
    limit:       int         = 100,
    role_filter: str | None  = None,
    search:      str | None  = None,
    admin: User = Depends(require_admin),
    db:    Session = Depends(get_db),
):
    """Return paginated list of all users. Optionally filter by role or search by name/email."""
    q = db.query(User)
    if role_filter:
        try:
            q = q.filter(User.role == UserRole(role_filter))
        except ValueError:
            pass
    if search:
        like = f"%{search}%"
        from sqlalchemy import or_
        q = q.filter(or_(User.full_name.ilike(like), User.email.ilike(like)))
    users = q.order_by(User.created_at.desc()).offset(skip).limit(limit).all()
    return [UserListItem.model_validate(u) for u in users]


@router.get("/users/{user_id}", response_model=UserListItem, summary="Get a user by ID")
def admin_get_user(
    user_id: str,
    admin: User = Depends(require_admin),
    db:    Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return UserListItem.model_validate(user)


@router.post("/users", response_model=UserListItem, status_code=201, summary="Create a user")
def admin_create_user(
    body: UserCreateRequest,
    admin: User = Depends(require_admin),
    db:    Session = Depends(get_db),
):
    """Admin creates any kind of user account (email-auth only)."""
    if get_user_by_email(db, body.email):
        raise HTTPException(status_code=409, detail="Email already registered.")

    # Validate role
    try:
        role = UserRole(body.role)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid role: {body.role}")

    if role == UserRole.ZONAL_OFFICER and not body.zone_id:
        raise HTTPException(status_code=422, detail="zone_id is required for zonal_officer role.")

    user = User(
        full_name=body.full_name,
        email=body.email.lower().strip(),
        phone=body.phone,
        password_hash=hash_password(body.password),
        auth_provider=AuthProvider.EMAIL,
        role=role,
        zone_id=body.zone_id if role == UserRole.ZONAL_OFFICER else None,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info("Admin %s created user %s (%s)", admin.email, user.email, role)
    return UserListItem.model_validate(user)


@router.put("/users/{user_id}", response_model=UserListItem, summary="Update a user")
def admin_update_user(
    user_id: str,
    body: UserUpdateRequest,
    admin: User = Depends(require_admin),
    db:    Session = Depends(get_db),
):
    """Admin updates user details — name, phone, role, zone, active status, or password."""
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    # Prevent self-demotion
    if user.id == admin.id and body.role and body.role != "admin":
        raise HTTPException(status_code=400, detail="Cannot change your own admin role.")

    if body.full_name is not None:
        user.full_name = body.full_name
    if body.phone is not None:
        user.phone = body.phone
    if body.role is not None:
        try:
            user.role = UserRole(body.role)
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Invalid role: {body.role}")
    if body.zone_id is not None:
        user.zone_id = body.zone_id
    if body.is_active is not None:
        user.is_active = body.is_active
    if body.password:
        user.password_hash = hash_password(body.password)

    db.commit()
    db.refresh(user)
    logger.info("Admin %s updated user %s", admin.email, user.email)
    return UserListItem.model_validate(user)


@router.delete("/users/{user_id}", status_code=204, summary="Deactivate or delete a user")
def admin_delete_user(
    user_id:     str,
    hard_delete: bool = False,
    admin: User = Depends(require_admin),
    db:    Session = Depends(get_db),
):
    """
    Soft-delete (deactivate) by default. Pass ?hard_delete=true to permanently remove.
    Cannot delete the logged-in admin.
    """
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account.")

    if hard_delete:
        db.delete(user)
        logger.info("Admin %s hard-deleted user %s", admin.email, user.email)
    else:
        user.is_active = False
        logger.info("Admin %s deactivated user %s", admin.email, user.email)

    db.commit()


# ═══════════════════════════════════════════════════════════════════════════════
# GET /admin/escalated — All escalated complaints
# ═══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/escalated",
    summary="List all auto-escalated complaints",
)
def admin_get_escalated(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Returns all complaints with escalation_level >= 1, sorted by urgency."""
    from app.models.ward import Ward
    from app.models.zone import Zone

    complaints = (
        db.query(Complaint)
        .filter(Complaint.escalation_level >= 1)
        .filter(Complaint.status.notin_(["resolved", "rejected"]))
        .order_by(Complaint.escalation_level.desc(), Complaint.escalated_at.asc())
        .limit(200)
        .all()
    )

    result = []
    for c in complaints:
        ward = db.get(Ward, c.ward_id) if c.ward_id else None
        zone = db.get(Zone, c.zone_id) if c.zone_id else None
        officer = db.get(User, c.assigned_officer_id) if c.assigned_officer_id else None

        result.append({
            "id":               c.id,
            "title":            c.title,
            "status":           c.status.value if hasattr(c.status, "value") else c.status,
            "severity_score":   c.severity_score,
            "escalation_level": c.escalation_level,
            "escalated_at":     c.escalated_at.isoformat() if c.escalated_at else None,
            "created_at":       c.created_at.isoformat(),
            "ward_number":      ward.ward_number if ward else None,
            "ward_name":        ward.ward_name if ward else None,
            "zone_name":        zone.name if zone else None,
            "assigned_officer": officer.full_name if officer else None,
        })

    return result
