"""
services/admin_service.py — Admin Control Center Business Logic

All functions are admin-only (enforced at API layer via require_admin dep).

Features:
  reassign_complaint()        — Move complaint to a different officer
  override_department()       — Manually set department (skips routing engine)
  escalate_complaint()        — Record escalation + create notification
  get_officer_workloads()     — Per-officer complaint load breakdown
  get_department_workloads()  — Per-department complaint load breakdown
  get_complaint_audit()       — Full chronological audit trail for a complaint

Audit trail sources:
  - complaint_status_history     (status changes)
  - complaint_progress_updates   (officer messages)
  - complaint_escalations        (admin escalations)
  - status history               (reassignment notes added as status_change events)

All write operations:
  1. Validate target IDs
  2. Apply the change
  3. Record in appropriate audit table
  4. Fire notification(s)
  5. Flush (caller commits)
"""

import logging
import uuid
from typing import Optional

from sqlalchemy import func, case
from sqlalchemy.orm import Session

from app.models.complaint import Complaint, ComplaintStatus
from app.models.complaint_escalation import ComplaintEscalation
from app.models.complaint_progress_update import ComplaintProgressUpdate
from app.models.complaint_status_history import ComplaintStatusHistory
from app.models.department import Department
from app.models.user import User, UserRole
from app.schemas.admin import (
    AuditStatusEntry,
    ComplaintAuditResponse,
    ComplaintDepartmentOverrideRequest,
    ComplaintEscalationCreate,
    ComplaintEscalationResponse,
    ComplaintReassignRequest,
    DepartmentWorkloadResponse,
    OfficerWorkloadResponse,
)

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════════

def _get_complaint_or_raise(db: Session, complaint_id: str) -> Complaint:
    c = db.get(Complaint, complaint_id)
    if not c:
        raise ValueError(f"Complaint '{complaint_id}' not found.")
    return c


def _get_officer_or_raise(db: Session, officer_id: str) -> User:
    u = db.get(User, officer_id)
    if not u:
        raise ValueError(f"User '{officer_id}' not found.")
    if u.role not in (UserRole.WARD_OFFICER, UserRole.ZONAL_OFFICER, UserRole.DEPT_HEAD, UserRole.ADMIN):
        raise ValueError(f"User '{officer_id}' is not an officer or admin.")
    return u


def _get_department_or_raise(db: Session, department_id: int) -> Department:
    d = db.get(Department, department_id)
    if not d:
        raise ValueError(f"Department '{department_id}' not found.")
    return d


def _add_status_history(
    db:            Session,
    complaint_id:  str,
    old_status:    str,
    new_status:    str,
    updated_by_id: str,
    note:          str = "",
) -> None:
    """Append a row to complaint_status_history."""
    db.add(ComplaintStatusHistory(
        id           = str(uuid.uuid4()),
        complaint_id = complaint_id,
        old_status   = old_status,
        new_status   = new_status,
        updated_by   = updated_by_id,
        note         = note,
    ))


# ═══════════════════════════════════════════════════════════════════════════════
# Complaint Reassignment
# ═══════════════════════════════════════════════════════════════════════════════

def reassign_complaint(
    db:       Session,
    admin:    User,
    complaint_id: str,
    payload:  ComplaintReassignRequest,
) -> Complaint:
    """
    Reassign a complaint from its current officer to a new one.
    Records the reassignment in status_history as a note.
    Notifies both old and new officers, and the citizen.
    """
    complaint   = _get_complaint_or_raise(db, complaint_id)
    new_officer = _get_officer_or_raise(db, payload.officer_id)

    old_officer_id   = complaint.assigned_officer_id
    old_officer_name = "unassigned"
    if old_officer_id:
        old_officer = db.get(User, old_officer_id)
        if old_officer:
            old_officer_name = old_officer.full_name or old_officer.email

    # Apply reassignment
    complaint.assigned_officer_id = new_officer.id
    db.flush()

    # Audit trail — status_history used as reassignment log
    note = (
        f"[ADMIN REASSIGN] by {admin.full_name or admin.email}: "
        f"'{old_officer_name}' → '{new_officer.full_name or new_officer.email}'. "
        f"Reason: {payload.reason}"
    )
    _add_status_history(
        db            = db,
        complaint_id  = complaint.id,
        old_status    = complaint.status.value,
        new_status    = complaint.status.value,   # status unchanged
        updated_by_id = admin.id,
        note          = note,
    )
    db.flush()

    # Notifications
    try:
        from app.services.notification_service import notify_complaint_assigned
        # Notify citizen
        notify_complaint_assigned(
            db               = db,
            citizen_id       = complaint.user_id,
            officer_id       = new_officer.id,
            complaint_id     = complaint.id,
            complaint_title  = complaint.title,
            officer_name     = new_officer.full_name or new_officer.email,
        )
    except Exception as exc:
        logger.error("reassign_complaint: notification error: %s", exc)

    logger.info(
        "Admin reassigned complaint=%s from officer=%s to officer=%s by admin=%s",
        complaint.id, old_officer_id, new_officer.id, admin.id,
    )
    db.refresh(complaint)
    return complaint


# ═══════════════════════════════════════════════════════════════════════════════
# Department Override
# ═══════════════════════════════════════════════════════════════════════════════

def override_department(
    db:           Session,
    admin:        User,
    complaint_id: str,
    payload:      ComplaintDepartmentOverrideRequest,
) -> Complaint:
    """
    Manually override the routing-engine assigned department.
    Adds a note to the status history audit trail.
    """
    complaint  = _get_complaint_or_raise(db, complaint_id)
    department = _get_department_or_raise(db, payload.department_id)

    old_dept_id = complaint.department_id
    old_dept    = db.get(Department, old_dept_id) if old_dept_id else None
    old_dept_name = old_dept.name if old_dept else "none"

    complaint.department_id = department.id
    db.flush()

    note = (
        f"[ADMIN DEPT OVERRIDE] by {admin.full_name or admin.email}: "
        f"'{old_dept_name}' → '{department.name}'. Reason: {payload.reason}"
    )
    _add_status_history(
        db            = db,
        complaint_id  = complaint.id,
        old_status    = complaint.status.value,
        new_status    = complaint.status.value,
        updated_by_id = admin.id,
        note          = note,
    )
    db.flush()

    logger.info(
        "Admin overrode department: complaint=%s dept %s→%s by admin=%s",
        complaint.id, old_dept_id, department.id, admin.id,
    )
    db.refresh(complaint)
    return complaint


# ═══════════════════════════════════════════════════════════════════════════════
# Officer Override
# ═══════════════════════════════════════════════════════════════════════════════

def override_officer(
    db:           Session,
    admin:        User,
    complaint_id: str,
    payload:      ComplaintReassignRequest,   # reuses same schema
) -> Complaint:
    """
    Forcefully assign a specific officer, bypassing routing engine logic.
    Identical to reassign but with different audit label.
    """
    complaint   = _get_complaint_or_raise(db, complaint_id)
    new_officer = _get_officer_or_raise(db, payload.officer_id)

    old_officer_id = complaint.assigned_officer_id
    complaint.assigned_officer_id = new_officer.id
    db.flush()

    note = (
        f"[ADMIN OFFICER OVERRIDE] by {admin.full_name or admin.email}: "
        f"manual assignment to '{new_officer.full_name or new_officer.email}'. "
        f"Reason: {payload.reason}"
    )
    _add_status_history(
        db            = db,
        complaint_id  = complaint.id,
        old_status    = complaint.status.value,
        new_status    = complaint.status.value,
        updated_by_id = admin.id,
        note          = note,
    )
    db.flush()

    try:
        from app.services.notification_service import notify_complaint_assigned
        notify_complaint_assigned(
            db               = db,
            citizen_id       = complaint.user_id,
            officer_id       = new_officer.id,
            complaint_id     = complaint.id,
            complaint_title  = complaint.title,
            officer_name     = new_officer.full_name or new_officer.email,
        )
    except Exception as exc:
        logger.error("override_officer: notification error: %s", exc)

    logger.info(
        "Admin force-assigned officer: complaint=%s officer %s→%s by admin=%s",
        complaint.id, old_officer_id, new_officer.id, admin.id,
    )
    db.refresh(complaint)
    return complaint


# ═══════════════════════════════════════════════════════════════════════════════
# Escalation
# ═══════════════════════════════════════════════════════════════════════════════

def escalate_complaint(
    db:           Session,
    admin:        User,
    complaint_id: str,
    payload:      ComplaintEscalationCreate,
) -> ComplaintEscalation:
    """
    Record an admin escalation on a complaint.
    Allows multiple escalations per complaint.
    Notifies the citizen and the assigned officer (if any).
    """
    complaint = _get_complaint_or_raise(db, complaint_id)

    escalation = ComplaintEscalation(
        id           = str(uuid.uuid4()),
        complaint_id = complaint.id,
        escalated_by = admin.id,
        reason       = payload.reason,
    )
    db.add(escalation)
    db.flush()

    # Citizen notification
    try:
        from app.services.notification_service import _create_notification
        from app.models.notification import NotificationType
        _create_notification(
            db           = db,
            user_id      = complaint.user_id,
            title        = "Your Complaint Has Been Escalated",
            message      = (
                f"An admin has escalated your complaint '{complaint.title}' for priority attention. "
                f"Reason: {payload.reason[:150]}"
            ),
            notif_type   = NotificationType.STATUS_CHANGED,
            complaint_id = complaint.id,
        )
        # Officer notification
        if complaint.assigned_officer_id:
            _create_notification(
                db           = db,
                user_id      = complaint.assigned_officer_id,
                title        = "Complaint Escalated — Action Required",
                message      = (
                    f"Complaint '{complaint.title}' has been escalated by admin "
                    f"{admin.full_name or admin.email}. Reason: {payload.reason[:150]}"
                ),
                notif_type   = NotificationType.STATUS_CHANGED,
                complaint_id = complaint.id,
            )
    except Exception as exc:
        logger.error("escalate_complaint: notification error: %s", exc)

    logger.info(
        "Complaint escalated: complaint=%s by admin=%s", complaint.id, admin.id,
    )
    return escalation


# ═══════════════════════════════════════════════════════════════════════════════
# Workloads
# ═══════════════════════════════════════════════════════════════════════════════

def get_officer_workloads(db: Session) -> list[OfficerWorkloadResponse]:
    """
    Per-officer complaint load breakdown.
    Only includes officers who have at least one assigned complaint.
    """
    from datetime import date, datetime, timezone
    from sqlalchemy import text

    sql = text("""
        SELECT
            u.id                                                       AS officer_id,
            COALESCE(u.full_name, u.email)                             AS officer_name,
            u.email,
            COUNT(c.id)                                                AS assigned_total,
            SUM(c.status IN ('submitted','under_review'))              AS pending,
            SUM(c.status = 'in_progress')                              AS in_progress,
            SUM(
                c.status = 'resolved'
                AND DATE(c.updated_at) = CURDATE()
            )                                                          AS resolved_today,
            ROUND(AVG(
                CASE
                    WHEN c.status = 'resolved' AND c.updated_at IS NOT NULL
                    THEN TIMESTAMPDIFF(HOUR, c.created_at, c.updated_at)
                    ELSE NULL
                END
            ), 2)                                                      AS avg_resolution_hours
        FROM users u
        JOIN complaints c ON c.assigned_officer_id = u.id
        WHERE u.role IN ('ward_officer', 'zonal_officer', 'dept_head', 'admin')
        GROUP BY u.id, u.full_name, u.email
        ORDER BY assigned_total DESC
    """)

    rows = db.execute(sql).mappings().all()
    return [
        OfficerWorkloadResponse(
            officer_id           = r["officer_id"],
            officer_name         = r["officer_name"],
            email                = r["email"],
            assigned_total       = int(r["assigned_total"] or 0),
            pending              = int(r["pending"] or 0),
            in_progress          = int(r["in_progress"] or 0),
            resolved_today       = int(r["resolved_today"] or 0),
            avg_resolution_hours = float(r["avg_resolution_hours"]) if r["avg_resolution_hours"] else None,
        )
        for r in rows
    ]


def get_department_workloads(db: Session) -> list[DepartmentWorkloadResponse]:
    """
    Per-department complaint load summary.
    Includes all departments (0-complaint rows via LEFT JOIN).
    """
    from sqlalchemy import text

    sql = text("""
        SELECT
            d.id                                        AS department_id,
            d.name                                      AS department_name,
            COUNT(c.id)                                 AS total,
            SUM(c.status NOT IN ('resolved','rejected'))AS open_count,
            SUM(c.status = 'resolved')                  AS resolved,
            ROUND(AVG(
                CASE
                    WHEN c.status = 'resolved' AND c.updated_at IS NOT NULL
                    THEN TIMESTAMPDIFF(HOUR, c.created_at, c.updated_at)
                    ELSE NULL
                END
            ), 2)                                       AS avg_resolution_hours
        FROM departments d
        LEFT JOIN complaints c ON c.department_id = d.id
        GROUP BY d.id, d.name
        ORDER BY total DESC
    """)

    rows = db.execute(sql).mappings().all()
    return [
        DepartmentWorkloadResponse(
            department_id        = r["department_id"],
            department_name      = r["department_name"],
            total                = int(r["total"] or 0),
            open                 = int(r["open_count"] or 0),
            resolved             = int(r["resolved"] or 0),
            avg_resolution_hours = float(r["avg_resolution_hours"]) if r["avg_resolution_hours"] else None,
        )
        for r in rows
    ]


# ═══════════════════════════════════════════════════════════════════════════════
# Complaint Audit View
# ═══════════════════════════════════════════════════════════════════════════════

def get_complaint_audit(
    db:           Session,
    complaint_id: str,
) -> ComplaintAuditResponse:
    """
    Full chronological audit trail for a single complaint.

    Events aggregated (sorted by timestamp):
      - Status changes (complaint_status_history) — includes admin notes
      - Progress updates (complaint_progress_updates)
      - Escalations (complaint_escalations)
    """
    complaint = _get_complaint_or_raise(db, complaint_id)

    # Department info
    dept      = db.get(Department, complaint.department_id) if complaint.department_id else None
    # Officer info
    officer   = db.get(User, complaint.assigned_officer_id) if complaint.assigned_officer_id else None

    events: list[AuditStatusEntry] = []

    # ── Status history ────────────────────────────────────────────────────────
    for h in complaint.status_history:
        actor = db.get(User, h.updated_by) if h.updated_by else None
        detail = f"Status changed: '{h.old_status}' → '{h.new_status}'"
        if hasattr(h, "note") and h.note:
            detail = h.note
        events.append(AuditStatusEntry(
            event      = "status_change",
            actor_id   = h.updated_by,
            actor_name = actor.full_name if actor else None,
            detail     = detail,
            timestamp  = h.updated_at,
        ))

    # ── Progress updates ──────────────────────────────────────────────────────
    for p in complaint.progress_updates:
        actor = db.get(User, p.officer_id) if p.officer_id else None
        events.append(AuditStatusEntry(
            event      = "progress_update",
            actor_id   = p.officer_id,
            actor_name = actor.full_name if actor else None,
            detail     = f"Progress: {p.message}",
            timestamp  = p.created_at,
        ))

    # ── Escalations ───────────────────────────────────────────────────────────
    for e in complaint.escalations:
        actor = db.get(User, e.escalated_by) if e.escalated_by else None
        events.append(AuditStatusEntry(
            event      = "escalation",
            actor_id   = e.escalated_by,
            actor_name = actor.full_name if actor else None,
            detail     = f"Escalated: {e.reason}",
            timestamp  = e.created_at,
        ))

    events.sort(key=lambda x: x.timestamp)

    return ComplaintAuditResponse(
        complaint_id          = complaint.id,
        title                 = complaint.title,
        current_status        = complaint.status.value,
        department_id         = complaint.department_id,
        department_name       = dept.name if dept else None,
        assigned_officer_id   = complaint.assigned_officer_id,
        assigned_officer_name = (officer.full_name or officer.email) if officer else None,
        duplicate_group_id    = complaint.duplicate_group_id,
        matched_complaint_id  = complaint.matched_complaint_id,
        similarity_score      = complaint.similarity_score,
        ai_category           = complaint.ai_category,
        escalation_count      = len(complaint.escalations),
        total_events          = len(events),
        audit_trail           = events,
    )
