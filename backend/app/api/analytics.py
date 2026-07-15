"""
api/analytics.py — Analytics Endpoints (Admin Only)

All endpoints require admin or super_admin role.

GET /analytics/dashboard     → DashboardMetrics
GET /analytics/departments   → DepartmentAnalyticsList
GET /analytics/officers      → OfficerAnalyticsList  (paginated)
GET /analytics/wards         → WardAnalyticsList
GET /analytics/trends        → TrendData  (daily | weekly | monthly)
"""

import logging
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.database.session import get_db
from app.models.user import User
from app.schemas.analytics import (
    DashboardMetrics,
    DepartmentAnalyticsList,
    OfficerAnalyticsList,
    TrendData,
    WardAnalyticsList,
)
from app.services.analytics_service import (
    get_dashboard_metrics,
    get_department_analytics,
    get_officer_analytics,
    get_trend_analytics,
    get_ward_analytics,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/analytics",
    tags=["Analytics"],
    dependencies=[Depends(require_admin)],  # all routes admin-only
)


# ═══════════════════════════════════════════════════════════════════════════════
# Dashboard
# ═══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/dashboard",
    response_model=DashboardMetrics,
    summary="Platform-wide KPI snapshot",
    description=(
        "Returns total, open, resolved, avg resolution time, "
        "active officers, totals for today/week/month. Admin only."
    ),
)
def dashboard(
    db: Session = Depends(get_db),
    _: User     = Depends(require_admin),
) -> DashboardMetrics:
    return get_dashboard_metrics(db)


# ═══════════════════════════════════════════════════════════════════════════════
# Department Analytics
# ═══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/departments",
    response_model=DepartmentAnalyticsList,
    summary="Per-department complaint analytics",
    description=(
        "Returns total, resolved, pending, rejected counts and "
        "average resolution time per department. Sorted by volume."
    ),
)
def departments(
    db: Session = Depends(get_db),
    _: User     = Depends(require_admin),
) -> DepartmentAnalyticsList:
    return get_department_analytics(db)


# ═══════════════════════════════════════════════════════════════════════════════
# Officer Analytics
# ═══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/officers",
    response_model=OfficerAnalyticsList,
    summary="Per-officer complaint analytics",
    description=(
        "Returns assigned, resolved, in-progress, pending counts and "
        "average completion time per officer. Sorted by resolved DESC. Paginated."
    ),
)
def officers(
    skip:  int = Query(default=0, ge=0, description="Pagination offset"),
    limit: int = Query(default=20, ge=1, le=100, description="Page size"),
    db:    Session = Depends(get_db),
    _:     User    = Depends(require_admin),
) -> OfficerAnalyticsList:
    return get_officer_analytics(db, skip=skip, limit=limit)


# ═══════════════════════════════════════════════════════════════════════════════
# Ward Analytics
# ═══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/wards",
    response_model=WardAnalyticsList,
    summary="Per-ward complaint counts",
    description=(
        "Returns complaint counts (total / open / resolved) per ward. "
        "Sorted by volume. `top_n` controls how many wards appear in the "
        "`top_wards` widget list."
    ),
)
def wards(
    top_n: int = Query(default=10, ge=1, le=50, description="Top-N wards to highlight"),
    db:    Session = Depends(get_db),
    _:     User    = Depends(require_admin),
) -> WardAnalyticsList:
    return get_ward_analytics(db, top_n=top_n)


# ═══════════════════════════════════════════════════════════════════════════════
# Trend Analytics
# ═══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/trends",
    response_model=TrendData,
    summary="Time-series complaint trend data",
    description=(
        "Returns complaint counts bucketed by day / week / month. "
        "Use `days_back` to control how far back to look (max 365). "
        "Each data point includes total, resolved, and open counts."
    ),
)
def trends(
    granularity: Literal["daily", "weekly", "monthly"] = Query(
        default="daily",
        description="Time bucket: daily | weekly | monthly",
    ),
    days_back: int = Query(
        default=30, ge=1, le=365,
        description="Number of past days to include",
    ),
    db: Session = Depends(get_db),
    _:  User    = Depends(require_admin),
) -> TrendData:
    return get_trend_analytics(db, granularity=granularity, days_back=days_back)
