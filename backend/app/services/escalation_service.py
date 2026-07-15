"""
services/escalation_service.py — Auto-Escalation Engine

SLA windows (Level-1 deadline stored in complaint.sla_deadline):
  Severity 8-10  → Level-1: 12h,  Level-2: 24h
  Severity 5-7   → Level-1: 48h,  Level-2: 96h
  Severity 1-4   → Level-1: 120h, Level-2: 240h  (5d / 10d)

Escalation levels on complaint.escalation_level:
  0 = normal
  1 = escalated to zonal officer (Level-1 SLA breached)
  2 = escalated to admin         (Level-2 SLA breached)

run_escalation_check(db) is called every 30 minutes by the scheduler.
"""

import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# ── SLA tables ────────────────────────────────────────────────────────────────

def _sla_hours(severity: float | None) -> tuple[int, int]:
    """Return (level1_hours, level2_hours) for the given severity score."""
    s = int(severity or 5)
    if s >= 8:
        return 12, 24
    if s >= 5:
        return 48, 96
    return 120, 240   # 5 days, 10 days


def compute_sla_deadline(severity: float | None, from_time: datetime) -> datetime:
    """Return the Level-1 SLA deadline datetime (UTC-aware)."""
    h1, _ = _sla_hours(severity)
    if from_time.tzinfo is None:
        from_time = from_time.replace(tzinfo=timezone.utc)
    return from_time + timedelta(hours=h1)


# ── Main escalation check ─────────────────────────────────────────────────────

def run_escalation_check(db: Session) -> dict:
    """
    Query all open complaints and escalate any that have breached their SLA.
    Returns a summary dict {checked, level1_escalated, level2_escalated}.
    """
    from app.models.complaint import Complaint, ComplaintStatus
    from app.models.complaint_escalation import ComplaintEscalation
    from app.models.complaint_status_history import ComplaintStatusHistory
    from app.models.user import User, UserRole
    from app.models.notification import Notification, NotificationType

    now = datetime.now(timezone.utc)

    # Only look at open (not resolved/rejected) complaints
    open_statuses = [
        ComplaintStatus.SUBMITTED,
        ComplaintStatus.UNDER_REVIEW,
        ComplaintStatus.IN_PROGRESS,
    ]

    complaints = (
        db.query(Complaint)
        .filter(Complaint.status.in_(open_statuses))
        .filter(Complaint.escalation_level < 2)   # stop at level 2
        .all()
    )

    level1_count = 0
    level2_count = 0

    for c in complaints:
        severity  = c.severity_score or 5
        h1, h2    = _sla_hours(severity)
        created   = c.created_at.replace(tzinfo=timezone.utc) if c.created_at.tzinfo is None else c.created_at

        # Compute absolute deadlines from creation time
        deadline_l1 = created + timedelta(hours=h1)
        deadline_l2 = created + timedelta(hours=h2)

        escalated = False

        # ── Level 2 escalation (admin) ────────────────────────────────────────
        if c.escalation_level < 2 and now > deadline_l2:
            c.escalation_level = 2
            c.escalated_at     = now
            escalated          = True
            level2_count      += 1

            reason = (
                f"Auto-escalated to admin: complaint #{c.id[:8].upper()} "
                f"unresolved for {h2}h (severity {int(severity)})"
            )
            _record_escalation(db, c, level=2, reason=reason)
            _add_timeline_event(db, c, level=2, reason=reason)

            # Notify all admins
            admins = db.query(User).filter(User.role == UserRole.ADMIN, User.is_active == True).all()
            for admin in admins:
                _notify(db, admin.id, c, level=2)

            logger.warning(
                "ESCALATION L2: complaint=%s severity=%s age=%.1fh",
                c.id[:8], int(severity), (now - created).total_seconds() / 3600,
            )

        # ── Level 1 escalation (zonal officer) ───────────────────────────────
        elif c.escalation_level < 1 and now > deadline_l1:
            c.escalation_level = 1
            c.escalated_at     = now
            escalated          = True
            level1_count      += 1

            reason = (
                f"Auto-escalated to zonal officer: complaint #{c.id[:8].upper()} "
                f"unresolved for {h1}h (severity {int(severity)})"
            )
            _record_escalation(db, c, level=1, reason=reason)
            _add_timeline_event(db, c, level=1, reason=reason)

            # Notify assigned zonal officer (from zone_id)
            if c.zone_id:
                zonal = (
                    db.query(User)
                    .filter(
                        User.role == UserRole.ZONAL_OFFICER,
                        User.zone_id == c.zone_id,
                        User.is_active == True,
                    )
                    .first()
                )
                if zonal:
                    _notify(db, zonal.id, c, level=1)

            logger.warning(
                "ESCALATION L1: complaint=%s severity=%s age=%.1fh",
                c.id[:8], int(severity), (now - created).total_seconds() / 3600,
            )

        if escalated:
            db.add(c)

    if level1_count or level2_count:
        db.commit()
        logger.info(
            "Escalation run complete: checked=%d L1=%d L2=%d",
            len(complaints), level1_count, level2_count,
        )
    else:
        logger.debug("Escalation run: %d complaints checked, none escalated", len(complaints))

    return {
        "checked":          len(complaints),
        "level1_escalated": level1_count,
        "level2_escalated": level2_count,
    }


# ── Helpers ───────────────────────────────────────────────────────────────────

def _record_escalation(db: Session, complaint, level: int, reason: str) -> None:
    """Insert a ComplaintEscalation audit row."""
    from app.models.complaint_escalation import ComplaintEscalation
    row = ComplaintEscalation(
        id               = str(uuid.uuid4()),
        complaint_id     = complaint.id,
        escalated_by     = None,   # system-triggered
        reason           = reason,
        escalation_level = level,
        trigger_type     = "auto",
    )
    db.add(row)


def _add_timeline_event(db: Session, complaint, level: int, reason: str) -> None:
    """Append an escalation entry to complaint_status_history for the timeline."""
    from app.models.complaint_status_history import ComplaintStatusHistory
    # Reuse the status history table with a special status value of None
    # We store the message as a note in the `note` column if it exists,
    # otherwise we skip (timeline will pick up from ComplaintEscalation).
    try:
        row = ComplaintStatusHistory(
            id           = str(uuid.uuid4()),
            complaint_id = complaint.id,
            old_status   = complaint.status,
            new_status   = complaint.status,   # status unchanged
            updated_by   = None,
            note         = reason,
        )
        db.add(row)
    except Exception as e:
        logger.debug("_add_timeline_event skipped (model mismatch?): %s", e)


def _notify(db: Session, user_id: str, complaint, level: int) -> None:
    """Insert an in-app notification for the target user."""
    try:
        from app.models.notification import Notification, NotificationType
        label = "Admin Alert" if level == 2 else "Escalation Alert"
        body  = (
            f"Complaint \"{complaint.title[:50]}\" has been auto-escalated "
            f"(Level {level}) due to SLA breach."
        )
        row = Notification(
            id               = str(uuid.uuid4()),
            user_id          = user_id,
            complaint_id     = complaint.id,
            notification_type= NotificationType.STATUS_CHANGE,
            title            = f"[{label}] SLA Breached",
            body             = body,
            is_read          = False,
        )
        db.add(row)
    except Exception as e:
        logger.warning("_notify failed for user=%s: %s", user_id, e)
