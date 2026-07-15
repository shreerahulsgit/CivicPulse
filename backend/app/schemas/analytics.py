"""
schemas/analytics.py — Analytics Pydantic v2 Schemas

Covers all five dashboard endpoints:
  DashboardMetrics        — GET /analytics/dashboard
  DepartmentAnalytics     — GET /analytics/departments
  OfficerAnalytics        — GET /analytics/officers
  WardAnalytics           — GET /analytics/wards
  TrendPoint / TrendData  — GET /analytics/trends
"""

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


# ═══════════════════════════════════════════════════════════════════════════════
# Dashboard
# ═══════════════════════════════════════════════════════════════════════════════

class DashboardMetrics(BaseModel):
    """Top-level KPI snapshot — GET /analytics/dashboard."""

    total_complaints:         int   = Field(description="All complaints ever submitted")
    open_complaints:          int   = Field(description="Complaints not yet resolved/rejected")
    resolved_complaints:      int   = Field(description="Complaints with status=resolved")
    rejected_complaints:      int   = Field(description="Complaints with status=rejected")
    avg_resolution_hours:     float = Field(description="Mean hours from submitted → resolved")
    active_officers:          int   = Field(description="Officers with ≥1 assigned in-progress complaint")
    total_departments:        int
    total_wards:              int
    complaints_today:         int   = Field(description="Complaints created today")
    complaints_this_week:     int   = Field(description="Complaints created in the last 7 days")
    complaints_this_month:    int   = Field(description="Complaints created in the last 30 days")


# ═══════════════════════════════════════════════════════════════════════════════
# Department Analytics
# ═══════════════════════════════════════════════════════════════════════════════

class DepartmentAnalytics(BaseModel):
    """Per-department stats — item in GET /analytics/departments."""

    department_id:        int
    department_name:      str
    total_complaints:     int
    resolved_complaints:  int
    pending_complaints:   int   = Field(description="Submitted + under_review + in_progress")
    rejected_complaints:  int
    avg_resolution_hours: float = Field(description="Mean resolution time in hours; 0 if none resolved")
    resolution_rate:      float = Field(description="resolved / total * 100, percentage")


class DepartmentAnalyticsList(BaseModel):
    total: int
    items: list[DepartmentAnalytics]


# ═══════════════════════════════════════════════════════════════════════════════
# Officer Analytics
# ═══════════════════════════════════════════════════════════════════════════════

class OfficerAnalytics(BaseModel):
    """Per-officer stats — item in GET /analytics/officers."""

    officer_id:             str
    officer_name:           str
    officer_email:          str
    assigned_complaints:    int
    resolved_complaints:    int
    in_progress_complaints: int
    pending_complaints:     int
    avg_completion_hours:   float = Field(description="Mean hours from submitted → resolved for this officer")
    resolution_rate:        float = Field(description="resolved / assigned * 100, percentage")


class OfficerAnalyticsList(BaseModel):
    total: int
    items: list[OfficerAnalytics]


# ═══════════════════════════════════════════════════════════════════════════════
# Ward Analytics
# ═══════════════════════════════════════════════════════════════════════════════

class WardAnalytics(BaseModel):
    """Per-ward complaint count — item in GET /analytics/wards."""

    ward_id:          int
    ward_name:        str
    ward_number:      str
    zone_number:      Optional[str]
    jurisdiction_id:  int
    total_complaints: int
    open_complaints:  int
    resolved_complaints: int


class WardAnalyticsList(BaseModel):
    total_wards:     int
    top_wards:       list[WardAnalytics] = Field(description="Top wards by complaint volume")
    all_wards:       list[WardAnalytics]


# ═══════════════════════════════════════════════════════════════════════════════
# Trend Analytics
# ═══════════════════════════════════════════════════════════════════════════════

class TrendPoint(BaseModel):
    """A single data point in a time-series trend."""
    period:            str   = Field(description="ISO date (daily/weekly) or YYYY-MM (monthly)")
    total_complaints:  int
    resolved_complaints: int
    open_complaints:   int


class TrendData(BaseModel):
    """Full trend response — GET /analytics/trends."""
    granularity:   str              = Field(description="daily | weekly | monthly")
    days_back:     int              = Field(description="How many days of history included")
    data_points:   list[TrendPoint]
