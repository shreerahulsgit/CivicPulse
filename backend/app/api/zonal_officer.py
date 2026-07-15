"""
api/zonal_officer.py — Zonal Officer Routes

Endpoints:
  GET  /zonal/dashboard         — Zone stats summary
  GET  /zonal/complaints        — All complaints in zone (all statuses)
  GET  /zonal/complaints/{id}   — Complaint detail
  GET  /zonal/ward-officers     — Ward officers in this zone
  POST /zonal/ward-officers     — Create a Ward Officer (scoped to zone's wards)
  PUT  /zonal/ward-officers/{id}/deactivate — Deactivate a ward officer

Access: zonal_officer role only
"""

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.api.deps import get_current_user, get_db
from app.models.complaint import Complaint, ComplaintStatus
from app.models.user import User, UserRole, AuthProvider
from app.models.ward import Ward
from app.models.zone import Zone
from app.schemas.zonal_officer import (
    WardOfficerCreate,
    WardOfficerResponse,
    ZonalComplaintItem,
    ZonalDashboardStats,
    ZoneWardItem,
)
from app.services.auth_service import hash_password

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/zonal", tags=["Zonal Officer"])


# ── Dependency: require zonal_officer role ────────────────────────────────────

def require_zonal_officer(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.ZONAL_OFFICER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Zonal Officer access required.",
        )
    if not current_user.zone_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has no zone assigned. Contact Admin.",
        )
    return current_user


# ═══════════════════════════════════════════════════════════════════════════════
# GET /zonal/dashboard
# ═══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/dashboard",
    response_model=ZonalDashboardStats,
    summary="Zonal Officer Dashboard Stats",
)
def get_dashboard(
    zo: User = Depends(require_zonal_officer),
    db: Session = Depends(get_db),
) -> ZonalDashboardStats:
    """Returns stats for the zonal officer's zone."""
    # Get ward IDs in this zone
    ward_ids = [w.id for w in db.query(Ward.id).filter(Ward.zone_id == zo.zone_id).all()]

    base_q = db.query(Complaint).filter(Complaint.ward_id.in_(ward_ids))

    total      = base_q.count()
    submitted  = base_q.filter(Complaint.status == ComplaintStatus.SUBMITTED).count()
    in_progress = base_q.filter(Complaint.status == ComplaintStatus.IN_PROGRESS).count()
    resolved   = base_q.filter(Complaint.status == ComplaintStatus.RESOLVED).count()

    # Officers in this zone
    officer_count = (
        db.query(func.count(User.id))
        .join(Ward, Ward.id == User.id)  # via officer_assignments
        .filter(User.role == UserRole.WARD_OFFICER)
        .scalar() or 0
    )
    # Simpler: count users whose assigned wards fall in this zone
    ward_officer_count = (
        db.query(func.count(User.id))
        .filter(User.role == UserRole.WARD_OFFICER)
        .join(Ward, Ward.zone_id == zo.zone_id, isouter=True)
        .scalar() or 0
    )

    # Get zone name
    zone = db.get(Zone, zo.zone_id)
    zone_name = zone.zone_name if zone else f"Zone {zo.zone_id}"

    return ZonalDashboardStats(
        zone_id=zo.zone_id,
        zone_name=zone_name,
        total_complaints=total,
        submitted=submitted,
        in_progress=in_progress,
        resolved=resolved,
        total_wards=len(ward_ids),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# GET /zonal/complaints
# ═══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/complaints",
    response_model=list[ZonalComplaintItem],
    summary="All complaints in zone",
)
def get_zone_complaints(
    skip: int = 0,
    limit: int = 50,
    status_filter: ComplaintStatus | None = None,
    zo: User = Depends(require_zonal_officer),
    db: Session = Depends(get_db),
) -> list[ZonalComplaintItem]:
    """Returns all complaints across all wards in the zonal officer's zone.
    Matches on EITHER:
      - complaint.ward_id is in this zone's wards, OR
      - complaint.zone_id == this zone's id (for complaints without a ward yet)
    Enriches each complaint with human-readable ward_number and ward_name.
    """
    from sqlalchemy import or_

    wards = db.query(Ward).filter(Ward.zone_id == zo.zone_id).all()
    ward_ids = [w.id for w in wards]
    # Build lookup: ward_id → (ward_number, ward_name)
    ward_lookup: dict[int, tuple[str, str | None]] = {
        w.id: (w.ward_number, w.ward_name) for w in wards
    }

    q = db.query(Complaint).filter(
        or_(
            Complaint.ward_id.in_(ward_ids),
            Complaint.zone_id == zo.zone_id,
        )
    )
    if status_filter:
        q = q.filter(Complaint.status == status_filter)
    q = q.order_by(Complaint.created_at.desc()).offset(skip).limit(limit)

    complaints = q.all()
    return [
        ZonalComplaintItem(
            id=c.id,
            title=c.title,
            status=c.status,
            ward_id=c.ward_id,
            ward_number=ward_lookup.get(c.ward_id, (None, None))[0] if c.ward_id else None,
            ward_name=ward_lookup.get(c.ward_id, (None, None))[1] if c.ward_id else None,
            category_id=c.category_id,
            severity_score=c.severity_score,
            created_at=c.created_at,
            assigned_officer_id=c.assigned_officer_id,
        )
        for c in complaints
    ]


# ═══════════════════════════════════════════════════════════════════════════════
# GET /zonal/ward-officers
# ═══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/ward-officers",
    response_model=list[WardOfficerResponse],
    summary="List Ward Officers in this zone",
)
def list_ward_officers(
    zo: User = Depends(require_zonal_officer),
    db: Session = Depends(get_db),
) -> list[WardOfficerResponse]:
    """Returns ward officers whose ward_id belongs to a ward in this zone."""
    wards_in_zone = db.query(Ward).filter(Ward.zone_id == zo.zone_id).all()
    ward_ids_in_zone = [w.id for w in wards_in_zone]
    ward_lookup: dict[int, Ward] = {w.id: w for w in wards_in_zone}

    officers = (
        db.query(User)
        .filter(
            User.role == UserRole.WARD_OFFICER,
            User.ward_id.in_(ward_ids_in_zone),
        )
        .order_by(User.full_name)
        .all()
    )
    return [
        WardOfficerResponse(
            id=o.id,
            full_name=o.full_name,
            email=o.email,
            phone=o.phone,
            is_active=o.is_active,
            zone_id=o.zone_id,
            ward_id=o.ward_id,
            ward_number=ward_lookup[o.ward_id].ward_number if o.ward_id and o.ward_id in ward_lookup else None,
            ward_name=ward_lookup[o.ward_id].ward_name if o.ward_id and o.ward_id in ward_lookup else None,
            created_at=o.created_at,
        )
        for o in officers
    ]


# ═══════════════════════════════════════════════════════════════════════════════
# GET /zonal/wards
# ═══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/wards",
    response_model=list[ZoneWardItem],
    summary="List wards in this zonal officer's zone",
)
def list_zone_wards(
    zo: User = Depends(require_zonal_officer),
    db: Session = Depends(get_db),
) -> list[ZoneWardItem]:
    """Returns all wards in the zonal officer's zone, with a flag showing if they have an officer."""
    wards = db.query(Ward).filter(Ward.zone_id == zo.zone_id).order_by(Ward.ward_number).all()

    # Find which ward_ids already have an officer assigned
    occupied_ward_ids = set(
        row[0] for row in
        db.query(User.ward_id)
        .filter(
            User.role == UserRole.WARD_OFFICER,
            User.ward_id.in_([w.id for w in wards]),
            User.is_active == True,
        )
        .all()
        if row[0] is not None
    )

    return [
        ZoneWardItem(
            id=w.id,
            ward_number=str(w.ward_number),
            ward_name=w.ward_name,
            has_officer=w.id in occupied_ward_ids,
        )
        for w in wards
    ]


# ═══════════════════════════════════════════════════════════════════════════════
# POST /zonal/ward-officers
# ═══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/ward-officers",
    response_model=WardOfficerResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a Ward Officer",
)
def create_ward_officer(
    payload: WardOfficerCreate,
    zo: User = Depends(require_zonal_officer),
    db: Session = Depends(get_db),
) -> WardOfficerResponse:
    """Creates a Ward Officer assigned to a specific ward in this zonal officer's zone."""
    # Validate that ward_id belongs to this zone
    ward = db.get(Ward, payload.ward_id)
    if not ward or ward.zone_id != zo.zone_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ward not found or does not belong to your zone.",
        )

    # Check if another officer is already assigned to this ward
    existing_officer = db.query(User).filter(
        User.ward_id == payload.ward_id,
        User.role == UserRole.WARD_OFFICER,
        User.is_active == True,
    ).first()
    if existing_officer:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ward {ward.ward_number} already has an active officer assigned.",
        )

    # Check email uniqueness
    existing = db.query(User).filter(User.email == payload.email.lower().strip()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Email '{payload.email}' is already registered.",
        )

    officer = User(
        id            = str(uuid.uuid4()),
        full_name     = payload.full_name.strip(),
        email         = payload.email.lower().strip(),
        phone         = payload.phone,
        password_hash = hash_password(payload.password),
        auth_provider = AuthProvider.EMAIL,
        role          = UserRole.WARD_OFFICER,
        zone_id       = zo.zone_id,
        ward_id       = payload.ward_id,
        is_active     = True,
    )
    db.add(officer)
    db.flush()
    db.refresh(officer)

    logger.info(
        "Ward Officer created: id=%s email=%s ward=%s by zonal_officer=%s zone=%s",
        officer.id, officer.email, payload.ward_id, zo.id, zo.zone_id,
    )

    return WardOfficerResponse(
        id=officer.id,
        full_name=officer.full_name,
        email=officer.email,
        phone=officer.phone,
        is_active=officer.is_active,
        zone_id=officer.zone_id,
        ward_id=officer.ward_id,
        ward_number=ward.ward_number,
        ward_name=ward.ward_name,
        created_at=officer.created_at,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# PUT /zonal/ward-officers/{officer_id}/deactivate
# ═══════════════════════════════════════════════════════════════════════════════

@router.put(
    "/ward-officers/{officer_id}/deactivate",
    response_model=WardOfficerResponse,
    summary="Deactivate a Ward Officer",
)
def deactivate_ward_officer(
    officer_id: str,
    zo: User = Depends(require_zonal_officer),
    db: Session = Depends(get_db),
) -> WardOfficerResponse:
    """Deactivates a ward officer — only if they belong to this zonal officer's zone."""
    officer = db.get(User, officer_id)
    if not officer or officer.role != UserRole.WARD_OFFICER:
        raise HTTPException(status_code=404, detail="Ward Officer not found.")
    if officer.zone_id != zo.zone_id:
        raise HTTPException(status_code=403, detail="This officer is not in your zone.")

    officer.is_active = False
    db.flush()

    logger.info("Ward Officer deactivated: id=%s by zonal=%s", officer.id, zo.id)

    return WardOfficerResponse(
        id=officer.id,
        full_name=officer.full_name,
        email=officer.email,
        phone=officer.phone,
        is_active=officer.is_active,
        zone_id=officer.zone_id,
        created_at=officer.created_at,
    )
