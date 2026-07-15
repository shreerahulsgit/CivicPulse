"""
services/notification_service.py — Notification Business Logic

Handles all notification CRUD and creation triggers.

Architecture:
  - All notification creation is fire-and-forget (errors logged, not raised).
  - Respects NotificationPreference.in_app_enabled per user.
  - Email delivery is a placeholder — integrate SendGrid / SMTP in prod.
  - Creation helpers follow a consistent pattern:
      create_notification(db, user_id, title, message, type, complaint_id)

Public trigger functions (called from complaint_service / officer_service):
  notify_complaint_created()
  notify_complaint_assigned()
  notify_status_changed()
  notify_progress_update()
  notify_complaint_resolved()
  notify_duplicate_detected()

Public API functions (called from api/notifications.py):
  get_notifications()
  mark_notification_read()
  mark_all_read()
  get_unread_count()
  get_preference()
  update_preference()
"""

import logging
import uuid
from typing import Optional

from sqlalchemy import func, update
from sqlalchemy.orm import Session

from app.models.notification import Notification, NotificationType
from app.models.notification_preference import NotificationPreference
from app.schemas.notification import (
    NotificationListResponse,
    NotificationPreferenceResponse,
    NotificationPreferenceUpdate,
    NotificationResponse,
    UnreadCountResponse,
)

logger = logging.getLogger(__name__)

# ── Defaults (when no preference row exists) ──────────────────────────────────
_DEFAULT_IN_APP   = True
_DEFAULT_EMAIL    = True


# ═══════════════════════════════════════════════════════════════════════════════
# Internal helpers
# ═══════════════════════════════════════════════════════════════════════════════

def _get_preference(db: Session, user_id: str) -> NotificationPreference:
    """
    Return the NotificationPreference row for `user_id`.
    If none exists yet, returns an in-memory default (not persisted).
    """
    pref = db.query(NotificationPreference).filter(
        NotificationPreference.user_id == user_id
    ).first()
    if pref is None:
        # Return a transient default — do NOT add to session yet
        pref = NotificationPreference(
            user_id        = user_id,
            email_enabled  = _DEFAULT_EMAIL,
            in_app_enabled = _DEFAULT_IN_APP,
        )
    return pref


def _create_notification(
    db:           Session,
    user_id:      str,
    title:        str,
    message:      str,
    notif_type:   NotificationType,
    complaint_id: Optional[str] = None,
) -> Optional[Notification]:
    """
    Core internal helper — creates and flushes a single Notification row.
    Respects the user's in_app_enabled preference.
    Never raises — exceptions are caught and logged.
    Returns the created Notification, or None if skipped/failed.
    """
    try:
        pref = _get_preference(db, user_id)
        if not pref.in_app_enabled:
            logger.debug(
                "_create_notification: in_app disabled for user %s — skipping %s",
                user_id, notif_type,
            )
            return None

        notif = Notification(
            id           = str(uuid.uuid4()),
            user_id      = user_id,
            title        = title,
            message      = message,
            type         = notif_type,
            complaint_id = complaint_id,
            is_read      = False,
        )
        db.add(notif)
        db.flush()
        logger.debug(
            "_create_notification: created %s for user=%s complaint=%s",
            notif_type, user_id, complaint_id,
        )
        return notif
    except Exception as exc:
        logger.error(
            "_create_notification: failed for user=%s type=%s: %s",
            user_id, notif_type, exc, exc_info=True,
        )
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# Trigger Functions
# Called from complaint_service.py and officer_service.py
# ═══════════════════════════════════════════════════════════════════════════════

def notify_complaint_created(
    db:           Session,
    user_id:      str,
    complaint_id: str,
    title:        str,
) -> None:
    """Notify the citizen that their complaint was successfully submitted."""
    _create_notification(
        db           = db,
        user_id      = user_id,
        title        = "Complaint Submitted",
        message      = (
            f"Your complaint '{title}' has been submitted successfully. "
            "We'll keep you updated on the progress."
        ),
        notif_type   = NotificationType.COMPLAINT_CREATED,
        complaint_id = complaint_id,
    )


def notify_complaint_assigned(
    db:            Session,
    citizen_id:    str,
    officer_id:    str,
    complaint_id:  str,
    complaint_title: str,
    officer_name:  str,
) -> None:
    """
    Notify both citizen and officer when a complaint is assigned.
    """
    # Notify citizen
    _create_notification(
        db           = db,
        user_id      = citizen_id,
        title        = "Officer Assigned",
        message      = (
            f"An officer ({officer_name}) has been assigned to your complaint "
            f"'{complaint_title}'. They will begin working on it shortly."
        ),
        notif_type   = NotificationType.COMPLAINT_ASSIGNED,
        complaint_id = complaint_id,
    )
    # Notify officer
    _create_notification(
        db           = db,
        user_id      = officer_id,
        title        = "New Complaint Assigned",
        message      = (
            f"You have been assigned a new complaint: '{complaint_title}'. "
            "Please review and accept it."
        ),
        notif_type   = NotificationType.COMPLAINT_ASSIGNED,
        complaint_id = complaint_id,
    )


def notify_status_changed(
    db:              Session,
    user_id:         str,
    complaint_id:    str,
    complaint_title: str,
    old_status:      str,
    new_status:      str,
) -> None:
    """Notify the citizen when their complaint's status changes."""
    _STATUS_LABELS = {
        "submitted":    "Submitted",
        "under_review": "Under Review",
        "in_progress":  "In Progress",
        "resolved":     "Resolved",
        "rejected":     "Rejected",
    }
    new_label = _STATUS_LABELS.get(new_status, new_status.replace("_", " ").title())

    _create_notification(
        db           = db,
        user_id      = user_id,
        title        = f"Complaint Status: {new_label}",
        message      = (
            f"The status of your complaint '{complaint_title}' has been "
            f"updated to '{new_label}'."
        ),
        notif_type   = NotificationType.STATUS_CHANGED,
        complaint_id = complaint_id,
    )


def notify_progress_update(
    db:              Session,
    user_id:         str,
    complaint_id:    str,
    complaint_title: str,
    update_message:  str,
    officer_name:    str,
) -> None:
    """Notify the citizen when the officer posts a progress update."""
    _create_notification(
        db           = db,
        user_id      = user_id,
        title        = "Progress Update",
        message      = (
            f"Officer {officer_name} posted an update on '{complaint_title}': "
            f"\"{update_message[:100]}{'...' if len(update_message) > 100 else ''}\""
        ),
        notif_type   = NotificationType.PROGRESS_UPDATE,
        complaint_id = complaint_id,
    )


def notify_complaint_resolved(
    db:              Session,
    user_id:         str,
    complaint_id:    str,
    complaint_title: str,
    officer_name:    str,
) -> None:
    """Notify the citizen when their complaint is resolved."""
    _create_notification(
        db           = db,
        user_id      = user_id,
        title        = "Complaint Resolved",
        message      = (
            f"Your complaint '{complaint_title}' has been resolved by "
            f"Officer {officer_name}. Thank you for reporting!"
        ),
        notif_type   = NotificationType.COMPLAINT_RESOLVED,
        complaint_id = complaint_id,
    )


def notify_duplicate_detected(
    db:                  Session,
    user_id:             str,
    complaint_id:        str,
    complaint_title:     str,
    matched_complaint_id: str,
    similarity_score:    float,
) -> None:
    """Notify the citizen that their complaint may be a duplicate."""
    _create_notification(
        db           = db,
        user_id      = user_id,
        title        = "Possible Duplicate Detected",
        message      = (
            f"Your complaint '{complaint_title}' appears to be similar to an "
            f"existing complaint (similarity: {similarity_score:.0%}). "
            "It has been grouped with related complaints and will still be reviewed."
        ),
        notif_type   = NotificationType.DUPLICATE_DETECTED,
        complaint_id = complaint_id,
    )


def notify_zonal_officer(
    db:              Session,
    zonal_officer_id: str,
    complaint_id:    str,
    complaint_title: str,
    ward_name:       str,
) -> None:
    """
    Notify the Zonal Officer when a new complaint is submitted in any ward
    within their zone.
    """
    _create_notification(
        db           = db,
        user_id      = zonal_officer_id,
        title        = "New Complaint in Your Zone",
        message      = (
            f"A new complaint '{complaint_title}' has been submitted in {ward_name}. "
            "Please monitor progress."
        ),
        notif_type   = NotificationType.COMPLAINT_ASSIGNED,
        complaint_id = complaint_id,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# API Service Functions
# ═══════════════════════════════════════════════════════════════════════════════

def get_notifications(
    db:       Session,
    user_id:  str,
    skip:     int = 0,
    limit:    int = 20,
    unread_only: bool = False,
) -> NotificationListResponse:
    """
    Paginated list of notifications for the current user.
    Sorted by created_at DESC (newest first).
    """
    limit = min(limit, 100)

    query = db.query(Notification).filter(Notification.user_id == user_id)

    if unread_only:
        query = query.filter(Notification.is_read == False)  # noqa: E712

    total = query.count()
    unread = (
        db.query(func.count(Notification.id))
        .filter(Notification.user_id == user_id, Notification.is_read == False)  # noqa: E712
        .scalar()
        or 0
    )

    items = (
        query.order_by(Notification.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return NotificationListResponse(
        total     = total,
        unread    = int(unread),
        page      = skip // limit + 1 if limit else 1,
        page_size = limit,
        items     = [NotificationResponse.model_validate(n) for n in items],
    )


def mark_notification_read(
    db:              Session,
    notification_id: str,
    user_id:         str,
) -> NotificationResponse:
    """
    Mark a single notification as read.
    Raises ValueError if not found or not owned by user_id.
    """
    notif = (
        db.query(Notification)
        .filter(
            Notification.id      == notification_id,
            Notification.user_id == user_id,
        )
        .first()
    )
    if notif is None:
        raise ValueError(f"Notification {notification_id!r} not found.")

    if not notif.is_read:
        notif.is_read = True
        db.flush()

    return NotificationResponse.model_validate(notif)


def mark_all_read(db: Session, user_id: str) -> int:
    """
    Mark all unread notifications for `user_id` as read.
    Returns the number of rows updated.
    """
    result = (
        db.execute(
            update(Notification)
            .where(
                Notification.user_id == user_id,
                Notification.is_read == False,  # noqa: E712
            )
            .values(is_read=True)
        )
    )
    db.flush()
    count = result.rowcount
    logger.info("mark_all_read: %d notifications marked read for user=%s", count, user_id)
    return count


def get_unread_count(db: Session, user_id: str) -> UnreadCountResponse:
    """Return the count of unread notifications for `user_id`."""
    count = (
        db.query(func.count(Notification.id))
        .filter(
            Notification.user_id == user_id,
            Notification.is_read == False,  # noqa: E712
        )
        .scalar()
        or 0
    )
    return UnreadCountResponse(unread_count=int(count))


def get_preference(db: Session, user_id: str) -> NotificationPreferenceResponse:
    """Return current notification preferences (with defaults if not set)."""
    pref = _get_preference(db, user_id)
    # If transient (no updated_at), return defaults
    if not hasattr(pref, "_sa_instance_state") or pref.updated_at is None:
        from datetime import datetime, timezone
        pref.updated_at = datetime.now(timezone.utc)
    return NotificationPreferenceResponse.model_validate(pref)


def update_preference(
    db:      Session,
    user_id: str,
    payload: NotificationPreferenceUpdate,
) -> NotificationPreferenceResponse:
    """
    Create or update notification preferences for `user_id`.
    Only fields provided in the payload are updated (partial update).
    """
    pref = (
        db.query(NotificationPreference)
        .filter(NotificationPreference.user_id == user_id)
        .first()
    )

    if pref is None:
        pref = NotificationPreference(
            user_id        = user_id,
            email_enabled  = _DEFAULT_EMAIL,
            in_app_enabled = _DEFAULT_IN_APP,
        )
        db.add(pref)

    if payload.email_enabled is not None:
        pref.email_enabled = payload.email_enabled
    if payload.in_app_enabled is not None:
        pref.in_app_enabled = payload.in_app_enabled

    db.flush()
    db.refresh(pref)
    logger.info(
        "update_preference: user=%s email=%s in_app=%s",
        user_id, pref.email_enabled, pref.in_app_enabled,
    )
    return NotificationPreferenceResponse.model_validate(pref)
