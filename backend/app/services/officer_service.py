"""
services/officer_service.py — Officer Operations Business Logic

Handles all officer-facing actions: viewing assigned complaints, accepting,
posting progress, uploading resolution images, and resolving complaints.

Functions:
  get_officer_complaints()       — all complaints assigned to officer
  get_pending_complaints()       — submitted complaints for this officer
  get_inprogress_complaints()    — in_progress complaints for this officer
  accept_complaint()             — submitted → under_review
  resolve_complaint()            — in_progress → resolved (requires AFTER image)
  add_progress_update()          — append a progress text message
  add_resolution_images()        — upload + store before/after Cloudinary images
  get_complaint_timeline()       — merge status history + progress + resolution images

Design: officers can ONLY access complaints where assigned_officer_id == their user ID.
"""

import uuid
import logging
from typing import Optional

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.models.complaint import Complaint, ComplaintStatus
from app.models.complaint_progress_update import ComplaintProgressUpdate
from app.models.complaint_resolution_image import ComplaintResolutionImage, ResolutionImageType
from app.models.complaint_status_history import ComplaintStatusHistory
from app.models.user import User
from app.schemas.officer import ComplaintTimelineEntry, ComplaintTimelineResponse, ProgressCreate
from app.services.cloudinary_service import upload_image

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════════

def _assert_assigned(complaint: Complaint, officer: User) -> None:
    """Raise ValueError if the officer is not assigned to this complaint."""
    if complaint.assigned_officer_id != officer.id:
        raise ValueError(
            f"Complaint '{complaint.id}' is not assigned to you."
        )


def _get_assigned_complaint(
    db: Session,
    complaint_id: str,
    officer: User,
) -> Complaint:
    """Fetch complaint and verify it is assigned to this officer. Raises ValueError if not."""
    complaint = db.get(Complaint, complaint_id)
    if not complaint:
        raise ValueError(f"Complaint '{complaint_id}' not found.")
    _assert_assigned(complaint, officer)
    return complaint


# ═══════════════════════════════════════════════════════════════════════════════
# Read
# ═══════════════════════════════════════════════════════════════════════════════

def get_officer_complaints(
    db: Session,
    officer: User,
    skip: int = 0,
    limit: int = 20,
) -> list[Complaint]:
    """All complaints assigned to this officer, newest first."""
    limit = min(limit, 100)
    return (
        db.query(Complaint)
        .filter(Complaint.assigned_officer_id == officer.id)
        .order_by(Complaint.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_pending_complaints(
    db: Session,
    officer: User,
    skip: int = 0,
    limit: int = 20,
) -> list[Complaint]:
    """Assigned complaints in SUBMITTED or UNDER_REVIEW status (pending acceptance)."""
    limit = min(limit, 100)
    return (
        db.query(Complaint)
        .filter(
            Complaint.assigned_officer_id == officer.id,
            Complaint.status.in_([
                ComplaintStatus.SUBMITTED,
                ComplaintStatus.UNDER_REVIEW,
            ]),
        )
        .order_by(Complaint.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_inprogress_complaints(
    db: Session,
    officer: User,
    skip: int = 0,
    limit: int = 20,
) -> list[Complaint]:
    """Assigned complaints actively in progress."""
    limit = min(limit, 100)
    return (
        db.query(Complaint)
        .filter(
            Complaint.assigned_officer_id == officer.id,
            Complaint.status == ComplaintStatus.IN_PROGRESS,
        )
        .order_by(Complaint.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Status transitions
# ═══════════════════════════════════════════════════════════════════════════════

def accept_complaint(
    db: Session,
    complaint_id: str,
    officer: User,
) -> Complaint:
    """
    Officer accepts a complaint: SUBMITTED → UNDER_REVIEW → IN_PROGRESS.

    If complaint is SUBMITTED, transitions to UNDER_REVIEW first (audit),
    then immediately to IN_PROGRESS. Both transitions are recorded in history.

    Raises ValueError if complaint is not assigned to this officer or
    if the status is not transitionable.
    """
    complaint = _get_assigned_complaint(db, complaint_id, officer)

    allowed = {ComplaintStatus.SUBMITTED, ComplaintStatus.UNDER_REVIEW}
    if complaint.status not in allowed:
        raise ValueError(
            f"Cannot accept complaint with status '{complaint.status.value}'. "
            "Must be 'submitted' or 'under_review'."
        )

    transitions: list[tuple[ComplaintStatus, ComplaintStatus]] = []
    if complaint.status == ComplaintStatus.SUBMITTED:
        transitions.append((ComplaintStatus.SUBMITTED, ComplaintStatus.UNDER_REVIEW))
    transitions.append((complaint.status if not transitions else ComplaintStatus.UNDER_REVIEW, ComplaintStatus.IN_PROGRESS))

    for old, new in transitions:
        db.add(ComplaintStatusHistory(
            id           = str(uuid.uuid4()),
            complaint_id = complaint.id,
            old_status   = old.value,
            new_status   = new.value,
            updated_by   = officer.id,
        ))

    complaint.status = ComplaintStatus.IN_PROGRESS
    db.flush()
    db.refresh(complaint)

    # Notify citizen of status change
    from app.services.notification_service import notify_status_changed
    if complaint.user_id:
        notify_status_changed(
            db              = db,
            user_id         = complaint.user_id,
            complaint_id    = complaint.id,
            complaint_title = complaint.title,
            old_status      = ComplaintStatus.SUBMITTED.value,
            new_status      = ComplaintStatus.IN_PROGRESS.value,
        )

    logger.info(
        "Complaint accepted: id=%s by officer=%s -> in_progress",
        complaint.id, officer.id,
    )
    return complaint


def resolve_complaint(
    db: Session,
    complaint_id: str,
    officer: User,
) -> Complaint:
    """
    Officer resolves a complaint: IN_PROGRESS → RESOLVED.

    Business rule: At least one AFTER resolution image must be uploaded
    before resolving. Raises ValueError if this condition is not met.
    """
    complaint = _get_assigned_complaint(db, complaint_id, officer)

    if complaint.status != ComplaintStatus.IN_PROGRESS:
        raise ValueError(
            f"Cannot resolve complaint with status '{complaint.status.value}'. "
            "Must be 'in_progress'."
        )

    # Require at least one AFTER image before resolving
    after_images = [
        img for img in complaint.resolution_images
        if img.image_type == ResolutionImageType.AFTER
    ]
    if not after_images:
        raise ValueError(
            "At least one resolution proof photo (image_type='after') must be uploaded "
            "before marking this complaint as resolved."
        )

    db.add(ComplaintStatusHistory(
        id           = str(uuid.uuid4()),
        complaint_id = complaint.id,
        old_status   = ComplaintStatus.IN_PROGRESS.value,
        new_status   = ComplaintStatus.RESOLVED.value,
        updated_by   = officer.id,
    ))
    complaint.status = ComplaintStatus.RESOLVED
    db.flush()
    db.refresh(complaint)

    # Notify citizen — resolved
    from app.services.notification_service import (
        notify_status_changed,
        notify_complaint_resolved,
    )
    if complaint.user_id:
        notify_status_changed(
            db              = db,
            user_id         = complaint.user_id,
            complaint_id    = complaint.id,
            complaint_title = complaint.title,
            old_status      = ComplaintStatus.IN_PROGRESS.value,
            new_status      = ComplaintStatus.RESOLVED.value,
        )
        notify_complaint_resolved(
            db              = db,
            user_id         = complaint.user_id,
            complaint_id    = complaint.id,
            complaint_title = complaint.title,
            officer_name    = officer.full_name or "the assigned officer",
        )

    logger.info(
        "Complaint resolved: id=%s by officer=%s", complaint.id, officer.id,
    )
    return complaint


# ═══════════════════════════════════════════════════════════════════════════════
# Progress updates
# ═══════════════════════════════════════════════════════════════════════════════

def add_progress_update(
    db: Session,
    complaint_id: str,
    officer: User,
    payload: ProgressCreate,
) -> ComplaintProgressUpdate:
    """
    Officer posts a text progress update on an assigned complaint.
    The complaint must be IN_PROGRESS.
    """
    complaint = _get_assigned_complaint(db, complaint_id, officer)

    if complaint.status != ComplaintStatus.IN_PROGRESS:
        raise ValueError(
            f"Progress updates can only be added to IN_PROGRESS complaints. "
            f"Current status: '{complaint.status.value}'."
        )

    update = ComplaintProgressUpdate(
        id           = str(uuid.uuid4()),
        complaint_id = complaint.id,
        officer_id   = officer.id,
        message      = payload.message,
    )
    db.add(update)
    db.flush()

    # Notify citizen of progress update
    from app.services.notification_service import notify_progress_update
    if complaint.user_id:
        notify_progress_update(
            db              = db,
            user_id         = complaint.user_id,
            complaint_id    = complaint.id,
            complaint_title = complaint.title,
            update_message  = payload.message,
            officer_name    = officer.full_name or "the assigned officer",
        )

    logger.info(
        "Progress update added: complaint=%s officer=%s", complaint.id, officer.id,
    )
    return update


# ═══════════════════════════════════════════════════════════════════════════════
# Resolution images
# ═══════════════════════════════════════════════════════════════════════════════

async def add_resolution_images(
    db: Session,
    complaint_id: str,
    officer: User,
    files: list[UploadFile],
    image_type: ResolutionImageType,
) -> list[ComplaintResolutionImage]:
    """
    Upload resolution images to Cloudinary and persist them.
    The complaint must be IN_PROGRESS.

    image_type: "before" | "after"
    Max 5 images per call.
    """
    if not files:
        raise ValueError("At least one image file is required.")
    if len(files) > 5:
        raise ValueError("Maximum 5 images per upload.")

    complaint = _get_assigned_complaint(db, complaint_id, officer)

    if complaint.status != ComplaintStatus.IN_PROGRESS:
        raise ValueError(
            f"Resolution images can only be uploaded to IN_PROGRESS complaints. "
            f"Current status: '{complaint.status.value}'."
        )

    records: list[ComplaintResolutionImage] = []
    for file in files:
        result = await upload_image(file)

        record = ComplaintResolutionImage(
            id           = str(uuid.uuid4()),
            complaint_id = complaint.id,
            uploaded_by  = officer.id,
            public_id    = result["public_id"],
            secure_url   = result["secure_url"],
            image_type   = image_type,
        )
        db.add(record)
        records.append(record)

    db.flush()

    logger.info(
        "Uploaded %d %s images for complaint=%s by officer=%s",
        len(records), image_type.value, complaint.id, officer.id,
    )
    return records


# ═══════════════════════════════════════════════════════════════════════════════
# Timeline
# ═══════════════════════════════════════════════════════════════════════════════

def get_complaint_timeline(
    db: Session,
    complaint_id: str,
) -> ComplaintTimelineResponse:
    """
    Build a chronological timeline of all events on a complaint:
      - Status changes (from complaint_status_history)
      - Officer progress updates (from complaint_progress_updates)
      - Resolution images (from complaint_resolution_images)

    Sorted by timestamp ascending. Available to all authenticated users.
    """
    complaint = db.get(Complaint, complaint_id)
    if not complaint:
        raise ValueError(f"Complaint '{complaint_id}' not found.")

    events: list[ComplaintTimelineEntry] = []

    # ── Status changes ───────────────────────────────────────────────────────
    for history in complaint.status_history:
        actor = db.get(User, history.updated_by) if history.updated_by else None
        events.append(ComplaintTimelineEntry(
            event_type = "status_change",
            timestamp  = history.updated_at,
            actor_id   = history.updated_by,
            actor_name = actor.full_name if actor else None,
            old_status = history.old_status,
            new_status = history.new_status,
        ))

    # ── Progress updates ─────────────────────────────────────────────────────
    for update in complaint.progress_updates:
        actor = db.get(User, update.officer_id) if update.officer_id else None
        events.append(ComplaintTimelineEntry(
            event_type = "progress_update",
            timestamp  = update.created_at,
            actor_id   = update.officer_id,
            actor_name = actor.full_name if actor else None,
            message    = update.message,
        ))

    # ── Resolution images ────────────────────────────────────────────────────
    for img in complaint.resolution_images:
        actor = db.get(User, img.uploaded_by) if img.uploaded_by else None
        events.append(ComplaintTimelineEntry(
            event_type = "resolution_image",
            timestamp  = img.uploaded_at,
            actor_id   = img.uploaded_by,
            actor_name = actor.full_name if actor else None,
            secure_url = img.secure_url,
            public_id  = img.public_id,
            image_type = img.image_type.value,
        ))

    # ── Escalation events ────────────────────────────────────────────────────
    for esc in complaint.escalations:
        events.append(ComplaintTimelineEntry(
            event_type = "escalation",
            timestamp  = esc.created_at,
            actor_id   = None,
            actor_name = "System",
            message    = esc.reason,
        ))

    # Sort all events chronologically
    events.sort(key=lambda e: e.timestamp)

    return ComplaintTimelineResponse(
        complaint_id  = complaint_id,
        total_events  = len(events),
        timeline      = events,
    )
