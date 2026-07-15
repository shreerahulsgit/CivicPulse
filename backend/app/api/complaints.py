"""
api/complaints.py — Complaint Management Routes

Endpoints:
  POST   /complaints              Create a new complaint (JWT required)
  GET    /complaints              List all complaints (public, filterable)
  GET    /complaints/my           List current user's complaints (JWT required)
  GET    /complaints/{id}         Get complaint detail (owner or admin)
  PATCH  /complaints/{id}/status  Update complaint status (admin only)

Access control:
  - Creating a complaint requires authentication (citizen, admin, super_admin).
  - Listing all complaints is public (for dashboards / maps).
  - Viewing a single complaint's detail is restricted to the owner or admin.
  - Status updates are admin-only with enforced state machine transitions.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.complaint import ComplaintStatus
from app.models.user import User, UserRole
from app.api.deps import get_current_user, require_admin
from app.schemas.complaint import (
    ComplaintCreate,
    ComplaintDetailResponse,
    ComplaintResponse,
    ComplaintStatusUpdate,
)
from app.services.complaint_service import (
    create_complaint,
    get_complaint_by_id,
    get_complaints,
    get_complaints_by_user,
    update_complaint_status,
    update_complaint,
    delete_complaint,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/complaints", tags=["Complaints"])


# ═══════════════════════════════════════════════════════════════════════════════
# POST /complaints
# ═══════════════════════════════════════════════════════════════════════════════
@router.post(
    "",
    response_model=ComplaintDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="File a new complaint",
    description="Submit a civic issue with title, description, category, location, and optional images.",
)
def file_complaint(
    payload: ComplaintCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ComplaintDetailResponse:
    try:
        complaint = create_complaint(db, payload, current_user)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    return ComplaintDetailResponse.model_validate(complaint)


# ═══════════════════════════════════════════════════════════════════════════════
# GET /complaints
# ═══════════════════════════════════════════════════════════════════════════════
@router.get(
    "",
    response_model=list[ComplaintResponse],
    status_code=status.HTTP_200_OK,
    summary="List all complaints",
    description="Public endpoint. Supports pagination and optional filters by status and category.",
)
def list_complaints(
    skip: int = Query(0, ge=0, description="Offset for pagination"),
    limit: int = Query(20, ge=1, le=100, description="Page size (max 100)"),
    status_filter: ComplaintStatus | None = Query(
        None, alias="status", description="Filter by complaint status"
    ),
    category_id: int | None = Query(
        None, gt=0, description="Filter by category ID"
    ),
    db: Session = Depends(get_db),
) -> list[ComplaintResponse]:
    complaints = get_complaints(
        db,
        skip=skip,
        limit=limit,
        status_filter=status_filter,
        category_id=category_id,
    )
    return [ComplaintResponse.model_validate(c) for c in complaints]


# ═══════════════════════════════════════════════════════════════════════════════
# GET /complaints/my
# ═══════════════════════════════════════════════════════════════════════════════
@router.get(
    "/my",
    response_model=list[ComplaintResponse],
    status_code=status.HTTP_200_OK,
    summary="List my complaints",
    description="Returns all complaints filed by the authenticated user.",
)
def my_complaints(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ComplaintResponse]:
    complaints = get_complaints_by_user(db, current_user.id, skip=skip, limit=limit)
    return [ComplaintResponse.model_validate(c) for c in complaints]


# ═══════════════════════════════════════════════════════════════════════════════
# GET /complaints/{id}
# ═══════════════════════════════════════════════════════════════════════════════
@router.get(
    "/{complaint_id}",
    response_model=ComplaintDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get complaint details",
    description="Full detail view including images and status history. Only the owner or an admin can access.",
)
def get_complaint(
    complaint_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ComplaintDetailResponse:
    complaint = get_complaint_by_id(db, complaint_id)

    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Complaint '{complaint_id}' not found.",
        )

    # Access control: owner, admin, or assigned officer
    is_owner    = complaint.user_id == current_user.id
    is_admin    = current_user.role == UserRole.ADMIN
    is_assigned = complaint.assigned_officer_id == current_user.id

    if not is_owner and not is_admin and not is_assigned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view this complaint.",
        )

    return ComplaintDetailResponse.model_validate(complaint)


# ═══════════════════════════════════════════════════════════════════════════════
# PATCH /complaints/{id}/status
# ═══════════════════════════════════════════════════════════════════════════════
@router.patch(
    "/{complaint_id}/status",
    response_model=ComplaintDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Update complaint status (Admin only)",
    description=(
        "Transition the complaint to a new status. Enforces a valid "
        "state machine: submitted → under_review → in_progress → resolved/rejected."
    ),
)
def update_status(
    complaint_id: str,
    payload: ComplaintStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> ComplaintDetailResponse:
    complaint = get_complaint_by_id(db, complaint_id)

    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Complaint '{complaint_id}' not found.",
        )

    try:
        updated = update_complaint_status(db, complaint, payload, current_user)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    return ComplaintDetailResponse.model_validate(updated)


# ═══════════════════════════════════════════════════════════════════════════════
# PATCH /complaints/{id}  — Edit complaint (owner only, while submitted)
# ═══════════════════════════════════════════════════════════════════════════════
class ComplaintEditPayload(BaseModel):
    title: str | None = None
    description: str | None = None


@router.patch(
    "/{complaint_id}",
    response_model=ComplaintDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Edit complaint title/description",
    description="Owner can edit their complaint while it's still in 'submitted' status.",
)
def edit_complaint(
    complaint_id: str,
    payload: ComplaintEditPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ComplaintDetailResponse:
    complaint = get_complaint_by_id(db, complaint_id)
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found.")
    if complaint.user_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized.")

    try:
        updated = update_complaint(db, complaint, payload.title, payload.description)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return ComplaintDetailResponse.model_validate(updated)


# ═══════════════════════════════════════════════════════════════════════════════
# DELETE /complaints/{id}  — Delete complaint (owner only, while submitted/rejected)
# ═══════════════════════════════════════════════════════════════════════════════
@router.delete(
    "/{complaint_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a complaint",
    description="Owner can delete their complaint while it's 'submitted' or 'rejected'.",
)
def remove_complaint(
    complaint_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    complaint = get_complaint_by_id(db, complaint_id)
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found.")
    if complaint.user_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized.")

    try:
        delete_complaint(db, complaint)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return {"message": "Complaint deleted successfully."}


# ═══════════════════════════════════════════════════════════════════════════════
# POST /complaints/{id}/resolve  — Officer marks complaint as resolved
# ═══════════════════════════════════════════════════════════════════════════════
@router.post("/{complaint_id}/resolve", summary="Officer marks complaint as pending verification")
async def resolve_complaint(
    complaint_id: str,
    note: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Officer uploads an optional resolution note (photo upload is separate via /uploads/image).
    Sets status → pending_verification and sends citizen a notification.
    Pass photo_url + photo_id as query params after uploading via /uploads/image.
    """
    from datetime import datetime, timedelta, timezone
    from app.services.notification_service import _create_notification
    from app.models.notification import NotificationType
    from app.models.complaint_status_history import ComplaintStatusHistory
    import uuid as _uuid

    complaint = get_complaint_by_id(db, complaint_id)
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found.")

    # Only assigned officer or admin can mark resolved
    is_officer = current_user.id == complaint.assigned_officer_id
    is_admin   = current_user.role == UserRole.ADMIN
    if not is_officer and not is_admin:
        raise HTTPException(status_code=403, detail="Only the assigned officer can mark this resolved.")

    if complaint.status not in (ComplaintStatus.IN_PROGRESS, ComplaintStatus.UNDER_REVIEW):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot resolve a complaint with status '{complaint.status.value}'.",
        )

    old_st = complaint.status  # capture before mutating
    complaint.status          = ComplaintStatus.PENDING_VERIFICATION
    complaint.resolution_note = note
    complaint.auto_close_at   = datetime.now(timezone.utc) + timedelta(days=5)

    db.add(ComplaintStatusHistory(
        id           = str(_uuid.uuid4()),
        complaint_id = complaint_id,
        updated_by   = current_user.id,
        old_status   = old_st.value,
        new_status   = ComplaintStatus.PENDING_VERIFICATION.value,
        note         = f"Marked resolved by officer. {note or ''}".strip(),
    ))

    _create_notification(
        db           = db,
        user_id      = complaint.user_id,
        title        = "Resolution Submitted — Please Verify",
        message      = (
            f"The officer has marked your complaint '{complaint.title}' as resolved. "
            "Please open the complaint and confirm whether the issue is fixed."
        ),
        notif_type   = NotificationType.STATUS_CHANGED,
        complaint_id = complaint_id,
    )

    db.commit()
    db.refresh(complaint)
    return {"message": "Complaint set to pending_verification.", "auto_close_at": complaint.auto_close_at}


# ═══════════════════════════════════════════════════════════════════════════════
# PATCH /complaints/{id}/resolution-photo  — Attach Cloudinary photo after upload
# ═══════════════════════════════════════════════════════════════════════════════
class ResolutionPhotoRequest(BaseModel):
    photo_url: str
    photo_id:  str

@router.patch("/{complaint_id}/resolution-photo", summary="Attach resolution photo (officer)")
def attach_resolution_photo(
    complaint_id: str,
    body: ResolutionPhotoRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    complaint = get_complaint_by_id(db, complaint_id)
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found.")
    is_officer = current_user.id == complaint.assigned_officer_id
    is_admin   = current_user.role == UserRole.ADMIN
    if not is_officer and not is_admin:
        raise HTTPException(status_code=403, detail="Not authorized.")

    complaint.resolution_photo_url = body.photo_url
    complaint.resolution_photo_id  = body.photo_id
    db.commit()
    return {"message": "Resolution photo attached."}


# ═══════════════════════════════════════════════════════════════════════════════
# POST /complaints/{id}/verdict  — Citizen accepts or rejects resolution
# ═══════════════════════════════════════════════════════════════════════════════
class VerdictRequest(BaseModel):
    verdict: str   # "accepted" | "rejected"
    reason:  str | None = None

@router.post("/{complaint_id}/verdict", summary="Citizen accepts or rejects resolution")
def submit_verdict(
    complaint_id: str,
    body: VerdictRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from datetime import datetime, timezone
    from app.services.notification_service import _create_notification
    from app.models.notification import NotificationType
    from app.models.complaint_status_history import ComplaintStatusHistory
    import uuid as _uuid

    if body.verdict not in ("accepted", "rejected"):
        raise HTTPException(status_code=400, detail="verdict must be 'accepted' or 'rejected'.")

    complaint = get_complaint_by_id(db, complaint_id)
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found.")
    if complaint.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the complaint owner can submit a verdict.")
    if complaint.status != ComplaintStatus.PENDING_VERIFICATION:
        raise HTTPException(status_code=400, detail="Complaint is not awaiting verification.")

    now = datetime.now(timezone.utc)
    complaint.citizen_verdict    = body.verdict
    complaint.citizen_verdict_at = now

    if body.verdict == "accepted":
        complaint.status = ComplaintStatus.RESOLVED
        new_status = ComplaintStatus.RESOLVED
        notif_msg = f"Citizen accepted your resolution for '{complaint.title}'."
    else:
        complaint.status              = ComplaintStatus.IN_PROGRESS
        complaint.resolution_note     = None
        complaint.resolution_photo_url = None
        complaint.resolution_photo_id  = None
        complaint.auto_close_at       = None
        new_status = ComplaintStatus.IN_PROGRESS
        notif_msg = (
            f"Citizen rejected the resolution for '{complaint.title}'. "
            f"Reason: {body.reason or 'Not specified'}. Complaint reopened."
        )

    db.add(ComplaintStatusHistory(
        id           = str(_uuid.uuid4()),
        complaint_id = complaint_id,
        updated_by   = current_user.id,
        old_status   = ComplaintStatus.PENDING_VERIFICATION.value,
        new_status   = new_status.value,
        note         = f"Citizen verdict: {body.verdict}. {body.reason or ''}".strip(),
    ))

    if complaint.assigned_officer_id:
        _create_notification(
            db           = db,
            user_id      = complaint.assigned_officer_id,
            title        = "Resolution " + ("Accepted" if body.verdict == "accepted" else "Rejected"),
            message      = notif_msg,
            notif_type   = NotificationType.STATUS_CHANGED,
            complaint_id = complaint_id,
        )

    db.commit()
    db.refresh(complaint)
    return {"message": f"Verdict '{body.verdict}' submitted.", "status": complaint.status.value}


# ═══════════════════════════════════════════════════════════════════════════════
# POST /complaints/{id}/feedback  — Citizen submits star rating
# ═══════════════════════════════════════════════════════════════════════════════
class FeedbackRequest(BaseModel):
    rating:  int
    comment: str | None = None

@router.post("/{complaint_id}/feedback", summary="Citizen submits star rating after resolution")
def submit_feedback(
    complaint_id: str,
    body: FeedbackRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.complaint_feedback import ComplaintFeedback
    import uuid as _uuid

    if not (1 <= body.rating <= 5):
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5.")

    complaint = get_complaint_by_id(db, complaint_id)
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found.")
    if complaint.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the complaint owner can rate it.")
    if complaint.status != ComplaintStatus.RESOLVED:
        raise HTTPException(status_code=400, detail="You can only rate resolved complaints.")
    if complaint.feedback:
        raise HTTPException(status_code=409, detail="You have already rated this complaint.")

    fb = ComplaintFeedback(
        id           = str(_uuid.uuid4()),
        complaint_id = complaint_id,
        user_id      = current_user.id,
        rating       = body.rating,
        comment      = body.comment,
    )
    db.add(fb)
    db.commit()
    db.refresh(fb)
    return {"message": "Feedback submitted.", "rating": fb.rating}


# ═══════════════════════════════════════════════════════════════════════════════
# GET /complaints/{id}/feedback  — Get feedback for a complaint
# ═══════════════════════════════════════════════════════════════════════════════
@router.get("/{complaint_id}/feedback", summary="Get citizen feedback for a complaint")
def get_feedback(
    complaint_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    complaint = get_complaint_by_id(db, complaint_id)
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found.")
    # Allow owner, assigned officer, or admin
    allowed = (
        complaint.user_id == current_user.id
        or complaint.assigned_officer_id == current_user.id
        or current_user.role == UserRole.ADMIN
    )
    if not allowed:
        raise HTTPException(status_code=403, detail="Not authorized.")
    if not complaint.feedback:
        return {"feedback": None}
    fb = complaint.feedback
    return {
        "feedback": {
            "id":         fb.id,
            "rating":     fb.rating,
            "comment":    fb.comment,
            "created_at": fb.created_at,
        }
    }
