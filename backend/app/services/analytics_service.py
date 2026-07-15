"""
services/analytics_service.py — Analytics Business Logic

All heavy lifting for the /analytics/* endpoints.
Uses SQLAlchemy 2.0 aggregated queries (func.count, func.avg, func.datediff)
to avoid loading ORM objects into memory for analytical queries.

Functions:
  get_dashboard_metrics()      → DashboardMetrics
  get_department_analytics()   → DepartmentAnalyticsList
  get_officer_analytics()      → OfficerAnalyticsList
  get_ward_analytics()         → WardAnalyticsList
  get_trend_analytics()        → TrendData

Performance notes:
  - All aggregate queries run as single SQL statements (no Python-level loops).
  - MySQL TIMESTAMPDIFF(HOUR, ...) used for resolution time.
  - Results are sorted by complaint volume DESC for top-N use-cases.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Literal

from sqlalchemy import case, func, text
from sqlalchemy.orm import Session

from app.models.complaint import Complaint, ComplaintStatus
from app.models.complaint_status_history import ComplaintStatusHistory
from app.models.department import Department
from app.models.officer_assignment import OfficerAssignment
from app.models.user import User
from app.models.ward import Ward
from app.schemas.analytics import (
    DashboardMetrics,
    DepartmentAnalytics,
    DepartmentAnalyticsList,
    OfficerAnalytics,
    OfficerAnalyticsList,
    TrendData,
    TrendPoint,
    WardAnalytics,
    WardAnalyticsList,
)

logger = logging.getLogger(__name__)

# Complaint statuses considered "open" (not terminal)
_OPEN_STATUSES = [
    ComplaintStatus.SUBMITTED,
    ComplaintStatus.UNDER_REVIEW,
    ComplaintStatus.IN_PROGRESS,
]


# ═══════════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════════

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _safe_avg(total: int, value: float) -> float:
    return round(value, 2) if total else 0.0


def _pct(part: int, total: int) -> float:
    return round(part / total * 100, 2) if total else 0.0


def _avg_resolution_hours(db: Session, filter_col=None, filter_val=None) -> float:
    """
    Compute mean resolution time in hours using:
      TIMESTAMPDIFF(HOUR, complaints.created_at, status_history.updated_at)
    across all resolved complaints (optionally filtered by a column).

    Uses a JOIN between complaints and complaint_status_history
    where new_status = 'resolved'.
    """
    q = (
        db.query(
            func.avg(
                func.timestampdiff(
                    text("HOUR"),
                    Complaint.created_at,
                    ComplaintStatusHistory.updated_at,
                )
            )
        )
        .join(
            ComplaintStatusHistory,
            (ComplaintStatusHistory.complaint_id == Complaint.id)
            & (ComplaintStatusHistory.new_status == ComplaintStatus.RESOLVED.value),
        )
        .filter(Complaint.status == ComplaintStatus.RESOLVED)
    )

    if filter_col is not None:
        q = q.filter(filter_col == filter_val)

    result = q.scalar()
    return round(float(result), 2) if result else 0.0


# ═══════════════════════════════════════════════════════════════════════════════
# Dashboard
# ═══════════════════════════════════════════════════════════════════════════════

def get_dashboard_metrics(db: Session) -> DashboardMetrics:
    """
    Single-pass aggregation over the complaints table to compute all KPIs.
    Uses conditional COUNTs to avoid multiple round trips.
    """
    now      = _now()
    today    = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = now - timedelta(days=7)
    month_ago= now - timedelta(days=30)

    # ── Single aggregated query over complaints ──────────────────────────────
    row = db.query(
        func.count(Complaint.id).label("total"),
        func.sum(
            case((Complaint.status.in_(_OPEN_STATUSES), 1), else_=0)
        ).label("open"),
        func.sum(
            case((Complaint.status == ComplaintStatus.RESOLVED, 1), else_=0)
        ).label("resolved"),
        func.sum(
            case((Complaint.status == ComplaintStatus.REJECTED, 1), else_=0)
        ).label("rejected"),
        func.sum(
            case((Complaint.created_at >= today, 1), else_=0)
        ).label("today"),
        func.sum(
            case((Complaint.created_at >= week_ago, 1), else_=0)
        ).label("this_week"),
        func.sum(
            case((Complaint.created_at >= month_ago, 1), else_=0)
        ).label("this_month"),
    ).one()

    total     = int(row.total     or 0)
    open_     = int(row.open      or 0)
    resolved  = int(row.resolved  or 0)
    rejected  = int(row.rejected  or 0)
    today_cnt = int(row.today     or 0)
    week_cnt  = int(row.this_week or 0)
    month_cnt = int(row.this_month or 0)

    # ── Resolution time ──────────────────────────────────────────────────────
    avg_hours = _avg_resolution_hours(db)

    # ── Active officers ──────────────────────────────────────────────────────
    active_officers = (
        db.query(func.count(func.distinct(Complaint.assigned_officer_id)))
        .filter(
            Complaint.status == ComplaintStatus.IN_PROGRESS,
            Complaint.assigned_officer_id.isnot(None),
        )
        .scalar()
        or 0
    )

    # ── Totals ───────────────────────────────────────────────────────────────
    total_depts = db.query(func.count(Department.id)).scalar() or 0
    total_wards = db.query(func.count(Ward.id)).scalar() or 0

    logger.info(
        "Dashboard: total=%d open=%d resolved=%d avg_hours=%.2f",
        total, open_, resolved, avg_hours,
    )

    return DashboardMetrics(
        total_complaints       = total,
        open_complaints        = open_,
        resolved_complaints    = resolved,
        rejected_complaints    = rejected,
        avg_resolution_hours   = avg_hours,
        active_officers        = int(active_officers),
        total_departments      = int(total_depts),
        total_wards            = int(total_wards),
        complaints_today       = today_cnt,
        complaints_this_week   = week_cnt,
        complaints_this_month  = month_cnt,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Department Analytics
# ═══════════════════════════════════════════════════════════════════════════════

def get_department_analytics(db: Session) -> DepartmentAnalyticsList:
    """
    One aggregated query per department, using GROUP BY.
    Sorted by total_complaints DESC.
    """
    rows = (
        db.query(
            Department.id.label("dept_id"),
            Department.name.label("dept_name"),
            func.count(Complaint.id).label("total"),
            func.sum(
                case((Complaint.status == ComplaintStatus.RESOLVED, 1), else_=0)
            ).label("resolved"),
            func.sum(
                case((Complaint.status.in_(_OPEN_STATUSES), 1), else_=0)
            ).label("pending"),
            func.sum(
                case((Complaint.status == ComplaintStatus.REJECTED, 1), else_=0)
            ).label("rejected"),
        )
        .outerjoin(Complaint, Complaint.department_id == Department.id)
        .group_by(Department.id, Department.name)
        .order_by(func.count(Complaint.id).desc())
        .all()
    )

    items = []
    for row in rows:
        total    = int(row.total    or 0)
        resolved = int(row.resolved or 0)
        pending  = int(row.pending  or 0)
        rejected = int(row.rejected or 0)

        avg_h = _avg_resolution_hours(db, Complaint.department_id, row.dept_id)

        items.append(DepartmentAnalytics(
            department_id        = row.dept_id,
            department_name      = row.dept_name,
            total_complaints     = total,
            resolved_complaints  = resolved,
            pending_complaints   = pending,
            rejected_complaints  = rejected,
            avg_resolution_hours = avg_h,
            resolution_rate      = _pct(resolved, total),
        ))

    return DepartmentAnalyticsList(total=len(items), items=items)


# ═══════════════════════════════════════════════════════════════════════════════
# Officer Analytics
# ═══════════════════════════════════════════════════════════════════════════════

def get_officer_analytics(
    db:   Session,
    skip: int = 0,
    limit: int = 20,
) -> OfficerAnalyticsList:
    """
    Aggregates assigned complaints per officer.
    Only counts users who have at least one assigned complaint.
    Sorted by resolved complaints DESC.
    """
    limit = min(limit, 100)

    rows = (
        db.query(
            User.id.label("officer_id"),
            User.full_name.label("officer_name"),
            User.email.label("officer_email"),
            func.count(Complaint.id).label("assigned"),
            func.sum(
                case((Complaint.status == ComplaintStatus.RESOLVED, 1), else_=0)
            ).label("resolved"),
            func.sum(
                case((Complaint.status == ComplaintStatus.IN_PROGRESS, 1), else_=0)
            ).label("in_progress"),
            func.sum(
                case((Complaint.status.in_([
                    ComplaintStatus.SUBMITTED, ComplaintStatus.UNDER_REVIEW
                ]), 1), else_=0)
            ).label("pending"),
        )
        .join(Complaint, Complaint.assigned_officer_id == User.id)
        .group_by(User.id, User.full_name, User.email)
        .order_by(func.sum(
            case((Complaint.status == ComplaintStatus.RESOLVED, 1), else_=0)
        ).desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    # Count total distinct officers with assigned complaints
    total = (
        db.query(func.count(func.distinct(Complaint.assigned_officer_id)))
        .filter(Complaint.assigned_officer_id.isnot(None))
        .scalar()
        or 0
    )

    items = []
    for row in rows:
        assigned    = int(row.assigned    or 0)
        resolved    = int(row.resolved    or 0)
        in_progress = int(row.in_progress or 0)
        pending     = int(row.pending     or 0)

        avg_h = _avg_resolution_hours(db, Complaint.assigned_officer_id, row.officer_id)

        items.append(OfficerAnalytics(
            officer_id             = row.officer_id,
            officer_name           = row.officer_name,
            officer_email          = row.officer_email,
            assigned_complaints    = assigned,
            resolved_complaints    = resolved,
            in_progress_complaints = in_progress,
            pending_complaints     = pending,
            avg_completion_hours   = avg_h,
            resolution_rate        = _pct(resolved, assigned),
        ))

    return OfficerAnalyticsList(total=int(total), items=items)


# ═══════════════════════════════════════════════════════════════════════════════
# Ward Analytics
# ═══════════════════════════════════════════════════════════════════════════════

def get_ward_analytics(
    db:     Session,
    top_n:  int = 10,
) -> WardAnalyticsList:
    """
    Complaint counts grouped by ward.
    Returns all wards plus a top-N list (by volume) for dashboard widgets.
    """
    top_n = min(top_n, 50)

    rows = (
        db.query(
            Ward.id.label("ward_id"),
            Ward.ward_name.label("ward_name"),
            Ward.ward_number.label("ward_number"),
            Ward.zone_number.label("zone_number"),
            Ward.jurisdiction_id.label("jurisdiction_id"),
            func.count(Complaint.id).label("total"),
            func.sum(
                case((Complaint.status.in_(_OPEN_STATUSES), 1), else_=0)
            ).label("open"),
            func.sum(
                case((Complaint.status == ComplaintStatus.RESOLVED, 1), else_=0)
            ).label("resolved"),
        )
        .outerjoin(Complaint, Complaint.ward_id == Ward.id)
        .group_by(
            Ward.id, Ward.ward_name, Ward.ward_number,
            Ward.zone_number, Ward.jurisdiction_id,
        )
        .order_by(func.count(Complaint.id).desc())
        .all()
    )

    all_wards = [
        WardAnalytics(
            ward_id             = row.ward_id,
            ward_name           = row.ward_name,
            ward_number         = row.ward_number,
            zone_number         = row.zone_number,
            jurisdiction_id     = row.jurisdiction_id,
            total_complaints    = int(row.total    or 0),
            open_complaints     = int(row.open     or 0),
            resolved_complaints = int(row.resolved or 0),
        )
        for row in rows
    ]

    return WardAnalyticsList(
        total_wards = len(all_wards),
        top_wards   = all_wards[:top_n],
        all_wards   = all_wards,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Trend Analytics
# ═══════════════════════════════════════════════════════════════════════════════

def get_trend_analytics(
    db:          Session,
    granularity: Literal["daily", "weekly", "monthly"] = "daily",
    days_back:   int = 30,
) -> TrendData:
    """
    Time-series complaint counts grouped by day / week / month.
    Uses MySQL DATE_FORMAT for period bucketing.

    daily   → DATE_FORMAT(created_at, '%Y-%m-%d')
    weekly  → DATE_FORMAT(created_at, '%x-W%v')   (ISO week)
    monthly → DATE_FORMAT(created_at, '%Y-%m')
    """
    days_back = min(max(days_back, 1), 365)
    since     = _now() - timedelta(days=days_back)

    fmt_map = {
        "daily":   "%Y-%m-%d",
        "weekly":  "%x-W%v",
        "monthly": "%Y-%m",
    }
    fmt = fmt_map[granularity]

    rows = (
        db.query(
            func.date_format(Complaint.created_at, fmt).label("period"),
            func.count(Complaint.id).label("total"),
            func.sum(
                case((Complaint.status == ComplaintStatus.RESOLVED, 1), else_=0)
            ).label("resolved"),
            func.sum(
                case((Complaint.status.in_(_OPEN_STATUSES), 1), else_=0)
            ).label("open"),
        )
        .filter(Complaint.created_at >= since)
        .group_by(func.date_format(Complaint.created_at, fmt))
        .order_by(text("period ASC"))
        .all()
    )

    data_points = [
        TrendPoint(
            period             = row.period,
            total_complaints   = int(row.total    or 0),
            resolved_complaints= int(row.resolved or 0),
            open_complaints    = int(row.open     or 0),
        )
        for row in rows
    ]

    logger.info(
        "Trend analytics: granularity=%s days_back=%d data_points=%d",
        granularity, days_back, len(data_points),
    )

    return TrendData(
        granularity  = granularity,
        days_back    = days_back,
        data_points  = data_points,
    )
