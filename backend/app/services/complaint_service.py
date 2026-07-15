"""
services/complaint_service.py — Complaint Business Logic

All database mutations and queries for complaints live here.
Routes never call db.query() directly — they always go through this service.

Functions:
  create_complaint       — persist a new complaint + location + images + auto-routing
  get_complaints         — paginated list of all complaints
  get_complaint_by_id    — single complaint or None
  get_complaints_by_user — all complaints owned by a specific user
  update_complaint_status — transition status + write audit trail
"""

import uuid
import logging

from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.complaint import Complaint, ComplaintStatus
from app.models.complaint_image import ComplaintImage
from app.models.complaint_status_history import ComplaintStatusHistory
from app.models.location import Location
from app.models.user import User
from app.schemas.complaint import ComplaintCreate, ComplaintStatusUpdate

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# Create
# ═══════════════════════════════════════════════════════════════════════════════

def create_complaint(
    db: Session,
    payload: ComplaintCreate,
    current_user: User,
) -> Complaint:
    """
    Persist a new complaint along with its location and image records.

    Steps:
      1. Validate category exists.
      2. Create Location row.
      3. Run auto-routing (geo-detect ward + jurisdiction, map dept, assign officer).
      4. Create Complaint row with routing fields populated.
      5. Bulk-create ComplaintImage rows.
      6. Flush + refresh so server-generated fields populate.

    Raises ValueError if category_id is invalid.
    """
    # ── Validate category ────────────────────────────────────────────────────
    category = db.get(Category, payload.category_id)
    if not category:
        raise ValueError(f"Category with id {payload.category_id} does not exist.")

    # ── Location ─────────────────────────────────────────────────────────────
    location = Location(
        id        = str(uuid.uuid4()),
        latitude  = payload.location.latitude,
        longitude = payload.location.longitude,
        address   = payload.location.address,
    )
    db.add(location)

    # ── Auto-routing ─────────────────────────────────────────────────────────
    from app.services.routing_service import auto_route_complaint
    routing = auto_route_complaint(
        db          = db,
        latitude    = payload.location.latitude,
        longitude   = payload.location.longitude,
        category_id = payload.category_id,
    )

    # ── Gemini AI Classification (best-effort, never blocks) ─────────────────
    from app.services.gemini_service import classify_complaint as gemini_classify
    from app.models.category import Category as CategoryModel

    # Build categories list for Gemini
    all_cats = db.query(CategoryModel).all()
    cat_list = [{"id": c.id, "name": c.name} for c in all_cats]

    gemini_result = gemini_classify(
        title       = payload.title,
        description = payload.description or "",
        categories  = cat_list,
    )

    # Use Gemini category if confident, otherwise keep manual
    resolved_category_id = (
        gemini_result["category_id"]
        if gemini_result["used_ai"] and gemini_result["category_id"]
        else payload.category_id
    )
    ai_priority = gemini_result["priority"]        # 1-10
    ai_summary  = gemini_result["ai_summary"]      # one-line summary
    ai_label    = gemini_result["category_name"]   # readable label

    # ── Complaint ────────────────────────────────────────────────────────────
    complaint = Complaint(
        id                  = str(uuid.uuid4()),
        user_id             = current_user.id,
        category_id         = resolved_category_id,
        location_id         = location.id,
        title               = payload.title,
        description         = payload.description,
        status              = ComplaintStatus.SUBMITTED,
        # AI fields
        ai_category         = ai_label,
        severity_score      = ai_priority,
        # Routing fields (nullable — populated by routing engine)
        ward_id             = routing.ward_id,
        jurisdiction_id     = routing.jurisdiction_id,
        zone_id             = routing.zone_id,
        department_id       = routing.department_id,
        assigned_officer_id = routing.assigned_officer_id,
    )
    if ai_summary:
        logger.info("Gemini AI summary: %s", ai_summary)
    db.add(complaint)

    # ── Images ───────────────────────────────────────────────────────────────
    for url in payload.image_urls:
        db.add(ComplaintImage(
            id           = str(uuid.uuid4()),
            complaint_id = complaint.id,
            image_url    = url,
        ))

    db.flush()
    db.refresh(complaint)

    # ── Gemini Duplicate Detection (best-effort, never blocks) ──────────────
    from app.services.gemini_service import detect_duplicates as gemini_duplicates
    dup_result = gemini_duplicates(
        db          = db,
        title       = payload.title,
        description = payload.description or "",
        ward_id     = complaint.ward_id,
    )

    if dup_result["is_duplicate"]:
        complaint.matched_complaint_id = dup_result["matched_complaint_id"]
        complaint.similarity_score     = dup_result["similarity_score"]
        db.flush()
        logger.info(
            "Complaint %s flagged as DUPLICATE of %s (score=%.4f) by Gemini",
            complaint.id,
            dup_result["matched_complaint_id"],
            dup_result["similarity_score"] or 0,
        )

    # ── Notifications ─────────────────────────────────────────────────────────
    from app.services.notification_service import (
        notify_complaint_created,
        notify_complaint_assigned,
        notify_duplicate_detected,
        notify_zonal_officer,
    )
    from app.models.ward import Ward
    from app.models.user import UserRole

    notify_complaint_created(
        db           = db,
        user_id      = current_user.id,
        complaint_id = complaint.id,
        title        = complaint.title,
    )

    if complaint.assigned_officer_id:
        notify_complaint_assigned(
            db               = db,
            citizen_id       = current_user.id,
            officer_id       = complaint.assigned_officer_id,
            complaint_id     = complaint.id,
            complaint_title  = complaint.title,
            officer_name     = "the assigned officer",
        )

    # ── Notify Zonal Officer of this ward's zone ──────────────────────────────
    if complaint.ward_id:
        ward = db.get(Ward, complaint.ward_id)
        if ward and ward.zone_id:
            zonal_officer = (
                db.query(User)
                .filter(
                    User.role == UserRole.ZONAL_OFFICER,
                    User.zone_id == ward.zone_id,
                    User.is_active == True,
                )
                .first()
            )
            if zonal_officer:
                notify_zonal_officer(
                    db               = db,
                    zonal_officer_id = zonal_officer.id,
                    complaint_id     = complaint.id,
                    complaint_title  = complaint.title,
                    ward_name        = ward.ward_name or f"Ward {ward.ward_number}",
                )

    if dup_result["is_duplicate"] and dup_result["matched_complaint_id"]:
        notify_duplicate_detected(
            db                   = db,
            user_id              = current_user.id,
            complaint_id         = complaint.id,
            complaint_title      = complaint.title,
            matched_complaint_id = dup_result["matched_complaint_id"],
            similarity_score     = dup_result["similarity_score"] or 0.0,
        )

    logger.info(
        "Complaint created: id=%s user=%s category_id=%s ai_label=%s ai_used=%s ward=%s",
        complaint.id, current_user.id, complaint.category_id,
        gemini_result["category_name"], gemini_result["used_ai"], routing.ward_id,
    )
    return complaint


# ═══════════════════════════════════════════════════════════════════════════════
# Read
# ═══════════════════════════════════════════════════════════════════════════════

def get_complaints(
    db: Session,
    skip: int = 0,
    limit: int = 20,
    status_filter: ComplaintStatus | None = None,
    category_id: int | None = None,
) -> list[Complaint]:
    """
    Paginated complaint list with optional filters.

    Args:
        skip           — offset for pagination (default 0)
        limit          — page size, capped at 100
        status_filter  — optional status enum to filter by
        category_id    — optional category id to filter by

    Returns:
        List of Complaint ORM objects with relationships eagerly loaded.
    """
    limit = min(limit, 100)  # hard cap

    query = db.query(Complaint)

    if status_filter:
        query = query.filter(Complaint.status == status_filter)
    if category_id:
        query = query.filter(Complaint.category_id == category_id)

    return (
        query
        .order_by(Complaint.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_complaint_by_id(db: Session, complaint_id: str) -> Complaint | None:
    """Fetch a single complaint by UUID. Returns None if not found."""
    return db.get(Complaint, complaint_id)


def get_complaints_by_user(
    db: Session,
    user_id: str,
    skip: int = 0,
    limit: int = 20,
) -> list[Complaint]:
    """All complaints filed by a specific user, newest first."""
    limit = min(limit, 100)
    return (
        db.query(Complaint)
        .filter(Complaint.user_id == user_id)
        .order_by(Complaint.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Update status
# ═══════════════════════════════════════════════════════════════════════════════

# Allowed transitions — prevents invalid status jumps
_ALLOWED_TRANSITIONS: dict[ComplaintStatus, set[ComplaintStatus]] = {
    ComplaintStatus.SUBMITTED:    {ComplaintStatus.UNDER_REVIEW, ComplaintStatus.REJECTED},
    ComplaintStatus.UNDER_REVIEW: {ComplaintStatus.IN_PROGRESS, ComplaintStatus.REJECTED},
    ComplaintStatus.IN_PROGRESS:  {ComplaintStatus.RESOLVED, ComplaintStatus.REJECTED},
    ComplaintStatus.RESOLVED:     set(),      # terminal
    ComplaintStatus.REJECTED:     set(),      # terminal
}


def update_complaint_status(
    db: Session,
    complaint: Complaint,
    payload: ComplaintStatusUpdate,
    updated_by: User,
) -> Complaint:
    """
    Transition a complaint's status and record the change in the audit trail.

    Enforces the allowed transition graph. Raises ValueError on illegal moves
    (e.g. resolved → submitted).
    """
    old_status = complaint.status
    new_status = payload.status

    if new_status == old_status:
        raise ValueError(f"Complaint is already '{old_status.value}'.")

    allowed = _ALLOWED_TRANSITIONS.get(old_status, set())
    if new_status not in allowed:
        raise ValueError(
            f"Cannot transition from '{old_status.value}' to '{new_status.value}'. "
            f"Allowed: {[s.value for s in allowed] if allowed else 'none (terminal)'}."
        )

    # ── Apply ────────────────────────────────────────────────────────────────
    complaint.status = new_status

    # ── Audit trail ──────────────────────────────────────────────────────────
    history = ComplaintStatusHistory(
        id           = str(uuid.uuid4()),
        complaint_id = complaint.id,
        old_status   = old_status.value,
        new_status   = new_status.value,
        updated_by   = updated_by.id,
    )
    db.add(history)
    db.flush()
    db.refresh(complaint)

    logger.info(
        "Status updated: complaint=%s %s→%s by=%s",
        complaint.id, old_status.value, new_status.value, updated_by.id,
    )
    return complaint


# ═══════════════════════════════════════════════════════════════════════════════
# Update complaint (edit title/description)
# ═══════════════════════════════════════════════════════════════════════════════

def update_complaint(
    db: Session,
    complaint: Complaint,
    title: str | None = None,
    description: str | None = None,
) -> Complaint:
    """
    Update a complaint's title and/or description.
    Only allowed when status is 'submitted' (not yet picked up by officer).
    """
    if complaint.status != ComplaintStatus.SUBMITTED:
        raise ValueError(
            f"Cannot edit a complaint in '{complaint.status.value}' status. "
            "Only 'submitted' complaints can be edited."
        )

    if title is not None:
        complaint.title = title.strip()
    if description is not None:
        complaint.description = description.strip()

    db.flush()
    db.refresh(complaint)
    logger.info("Complaint updated: %s", complaint.id)
    return complaint


# ═══════════════════════════════════════════════════════════════════════════════
# Delete complaint
# ═══════════════════════════════════════════════════════════════════════════════

def delete_complaint(db: Session, complaint: Complaint) -> None:
    """
    Delete a complaint and all related records (images, status history, etc.).
    Only allowed when status is 'submitted' or 'rejected'.
    """
    if complaint.status not in (ComplaintStatus.SUBMITTED, ComplaintStatus.REJECTED):
        raise ValueError(
            f"Cannot delete a complaint in '{complaint.status.value}' status. "
            "Only 'submitted' or 'rejected' complaints can be deleted."
        )

    # Delete related records
    from app.models.complaint_image import ComplaintImage as CI
    from app.models.complaint_status_history import ComplaintStatusHistory as CSH
    from app.models.complaint_embedding import ComplaintEmbedding as CE
    from app.models.notification import Notification

    db.query(CI).filter(CI.complaint_id == complaint.id).delete()
    db.query(CSH).filter(CSH.complaint_id == complaint.id).delete()
    db.query(CE).filter(CE.complaint_id == complaint.id).delete()
    db.query(Notification).filter(Notification.complaint_id == complaint.id).delete()

    # Delete location
    location_id = complaint.location_id
    db.delete(complaint)
    if location_id:
        from app.models.location import Location as Loc
        loc = db.get(Loc, location_id)
        if loc:
            db.delete(loc)

    db.flush()
    logger.info("Complaint deleted: %s", complaint.id)

