"""
tests/test_routing.py — Geo-Spatial Routing Engine Tests

Tests:
  1. Point inside polygon          — Shapely point-in-polygon
  2. Point outside polygon         — returns None / fallback
  3. Nearest centroid fallback      — Haversine distance
  4. Department mapping             — category → department
  5. Department fallback            — unmapped category → default dept
  6. Officer assignment (exact)     — dept + ward match
  7. Officer assignment (overflow)  — dept match, any ward
  8. Officer assignment (none)      — no officer in dept
  9. Full auto_route_complaint()    — integration test with mocked DB
 10. RoutingResult fields           — all nullable, never raises
"""

import json
import pytest
from unittest.mock import MagicMock, patch
from shapely.geometry import mapping, Point, Polygon

from app.services.geospatial_service import (
    WardMatch,
    _haversine_distance,
    find_ward,
    invalidate_cache,
)
from app.services.routing_service import (
    CATEGORY_DEPARTMENT_MAP,
    RoutingResult,
    assign_officer,
    auto_route_complaint,
    get_department_for_category,
)


# ═══════════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════════

def make_square_polygon(center_lat: float, center_lng: float, delta: float = 0.05):
    """Create a simple square polygon (GeoJSON) centred at a point."""
    return {
        "type": "Polygon",
        "coordinates": [[
            [center_lng - delta, center_lat - delta],
            [center_lng + delta, center_lat - delta],
            [center_lng + delta, center_lat + delta],
            [center_lng - delta, center_lat + delta],
            [center_lng - delta, center_lat - delta],
        ]],
    }


def make_mock_ward(ward_id, lat, lng, jurisdiction_id=1, ward_name="Test Ward", ward_number="W-1"):
    """Create a mock Ward ORM object with polygon_geojson."""
    ward = MagicMock()
    ward.id              = ward_id
    ward.ward_name       = ward_name
    ward.ward_number     = ward_number
    ward.zone_number     = "Z-1"
    ward.jurisdiction_id = jurisdiction_id
    ward.polygon_geojson = json.dumps(make_square_polygon(lat, lng))
    return ward


def make_mock_db_with_wards(*wards):
    """Return a mock DB session whose ward query returns the given wards."""
    db = MagicMock()
    db.query.return_value.filter.return_value.all.return_value = list(wards)
    db.query.return_value.all.return_value = list(wards)
    db.query.return_value.first.return_value = wards[0] if wards else None
    return db


# ═══════════════════════════════════════════════════════════════════════════════
# 1 & 2. Point-in-polygon tests
# ═══════════════════════════════════════════════════════════════════════════════

def test_point_inside_polygon():
    """A point inside the ward polygon should return that ward."""
    invalidate_cache()  # ensure fresh cache

    center_lat, center_lng = 19.1197, 72.8464
    mock_ward = make_mock_ward(1, center_lat, center_lng)
    db = make_mock_db_with_wards(mock_ward)

    result = find_ward(db, center_lat, center_lng)

    assert result is not None
    assert result.ward_id == 1
    assert result.ward_name == "Test Ward"
    assert result.jurisdiction_id == 1

    invalidate_cache()


def test_point_outside_all_polygons_uses_nearest():
    """A point outside all ward polygons should fall back to nearest centroid."""
    invalidate_cache()

    # Ward centred at Mumbai
    mock_ward = make_mock_ward(1, 19.0760, 72.8777)
    db = make_mock_db_with_wards(mock_ward)

    # Point very far from ward polygon (Bandra – outside the small square)
    result = find_ward(db, 19.9999, 73.9999)

    # Should fall back to nearest — the only ward available
    assert result is not None
    assert result.ward_id == 1

    invalidate_cache()


def test_point_inside_correct_polygon_with_multiple_wards():
    """With multiple wards, only the matching ward should be returned."""
    invalidate_cache()

    # Use clearly separated centers so polygons (delta=0.05) don't overlap:
    # Ward A at 19.0760, 72.8777  →  polygon spans 19.026–19.126, 72.827–72.927
    # Ward B at 19.5000, 73.5000  →  polygon spans 19.450–19.550, 73.450–73.550
    ward_a = make_mock_ward(1, 19.0760, 72.8777, ward_name="Bandra West")
    ward_b = make_mock_ward(2, 19.5000, 73.5000, ward_name="Nashik Road")
    db     = make_mock_db_with_wards(ward_a, ward_b)

    # Point inside Ward B (19.5000, 73.5000 is right at its center)
    result = find_ward(db, 19.5000, 73.5000)

    assert result is not None
    assert result.ward_id == 2
    assert result.ward_name == "Nashik Road"

    invalidate_cache()


# ═══════════════════════════════════════════════════════════════════════════════
# 3. Haversine distance
# ═══════════════════════════════════════════════════════════════════════════════

def test_haversine_same_point():
    """Distance from a point to itself should be 0."""
    assert _haversine_distance(19.076, 72.877, 19.076, 72.877) == pytest.approx(0.0, abs=1e-6)


def test_haversine_known_distance():
    """Mumbai to Pune is roughly 120 km."""
    # Mumbai: 19.076°N 72.877°E  |  Pune: 18.520°N 73.856°E
    dist = _haversine_distance(19.076, 72.877, 18.520, 73.856)
    assert 115 < dist < 135  # within ±10 km of expected


# ═══════════════════════════════════════════════════════════════════════════════
# 4 & 5. Department mapping
# ═══════════════════════════════════════════════════════════════════════════════

def test_category_department_map_completeness():
    """Every seeded category should have a mapping entry."""
    seeded = ["Pothole", "Water Supply", "Electricity", "Sanitation",
              "Public Safety", "Noise", "Other"]
    for cat in seeded:
        assert cat in CATEGORY_DEPARTMENT_MAP, f"'{cat}' missing from CATEGORY_DEPARTMENT_MAP"


def test_get_department_for_category_known():
    """Pothole → Roads & Infrastructure."""
    mock_category   = MagicMock(); mock_category.name = "Pothole"
    mock_department = MagicMock(); mock_department.id = 1; mock_department.name = "Roads & Infrastructure"

    db = MagicMock()
    db.get.return_value = mock_category
    db.query.return_value.filter.return_value.first.return_value = mock_department

    result = get_department_for_category(db, category_id=1)
    assert result is not None
    assert result.name == "Roads & Infrastructure"


def test_get_department_for_category_unmapped_uses_default():
    """An unmapped category name not in map resolves to DEFAULT_DEPARTMENT directly."""
    mock_category   = MagicMock(); mock_category.name = "Unknown Category"
    mock_department = MagicMock(); mock_department.name = "General Administration"

    db = MagicMock()
    db.get.return_value = mock_category
    # "Unknown Category" not in map → .get() returns DEFAULT_DEPARTMENT → one query
    db.query.return_value.filter.return_value.first.return_value = mock_department

    result = get_department_for_category(db, category_id=99)
    assert result is not None
    assert result.name == "General Administration"


def test_get_department_for_nonexistent_category():
    """Category not found in DB → returns None."""
    db = MagicMock()
    db.get.return_value = None

    result = get_department_for_category(db, category_id=9999)
    assert result is None


# ═══════════════════════════════════════════════════════════════════════════════
# 6, 7, 8. Officer assignment
# ═══════════════════════════════════════════════════════════════════════════════

def test_assign_officer_exact_match():
    """Officer assigned to same dept + ward is returned."""
    mock_officer    = MagicMock(); mock_officer.is_active = True; mock_officer.id = "officer-uuid-1"
    mock_assignment = MagicMock(); mock_assignment.user_id = "officer-uuid-1"

    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = mock_assignment
    db.get.return_value = mock_officer

    result = assign_officer(db, department_id=1, ward_id=1)
    assert result is not None
    assert result.id == "officer-uuid-1"


def test_assign_officer_overflow():
    """With no exact ward match, officer from same dept in any ward is used."""
    mock_officer    = MagicMock(); mock_officer.is_active = True; mock_officer.id = "officer-uuid-2"
    mock_assignment = MagicMock(); mock_assignment.user_id = "officer-uuid-2"

    db = MagicMock()
    # First call (exact) returns None; second call (overflow) returns assignment
    db.query.return_value.filter.return_value.first.side_effect = [None, mock_assignment]
    db.get.return_value = mock_officer

    result = assign_officer(db, department_id=1, ward_id=99)
    assert result is not None
    assert result.id == "officer-uuid-2"


def test_assign_officer_none_available():
    """No officer in dept → returns None, does not raise."""
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = None

    result = assign_officer(db, department_id=1, ward_id=1)
    assert result is None


# ═══════════════════════════════════════════════════════════════════════════════
# 9 & 10. Full pipeline — auto_route_complaint()
# ═══════════════════════════════════════════════════════════════════════════════

def test_auto_route_complaint_full_pipeline():
    """Integration test: routing engine populates all fields."""
    invalidate_cache()

    mock_ward = make_mock_ward(5, 19.1197, 72.8464, jurisdiction_id=2)

    mock_category   = MagicMock(); mock_category.name = "Pothole"
    mock_department = MagicMock(); mock_department.id = 3; mock_department.name = "Roads & Infrastructure"
    mock_officer    = MagicMock(); mock_officer.is_active = True; mock_officer.id = "officer-abc"
    mock_assignment = MagicMock(); mock_assignment.user_id = "officer-abc"

    db = MagicMock()
    db.query.return_value.filter.return_value.all.return_value = [mock_ward]  # polygon query
    db.query.return_value.all.return_value = [mock_ward]
    db.query.return_value.filter.return_value.first.return_value = mock_assignment
    db.query.return_value.first.return_value = mock_ward
    db.get.side_effect = lambda model, pk: {
        1:             mock_category,
        "officer-abc": mock_officer,
    }.get(pk, mock_department)

    with patch(
        "app.services.routing_service.get_department_for_category",
        return_value=mock_department,
    ), patch(
        "app.services.routing_service.assign_officer",
        return_value=mock_officer,
    ), patch(
        "app.services.routing_service.find_ward",
        return_value=WardMatch(
            ward_id=5, ward_name="Andheri West", ward_number="W-14",
            zone_number="Z-3", jurisdiction_id=2,
        ),
    ):
        result = auto_route_complaint(db, latitude=19.1197, longitude=72.8464, category_id=1)

    assert result.ward_id         == 5
    assert result.jurisdiction_id == 2
    assert result.department_id   == mock_department.id
    assert result.assigned_officer_id == mock_officer.id

    invalidate_cache()


def test_auto_route_complaint_never_raises():
    """Routing must not raise even when all dependencies fail."""
    db = MagicMock()
    db.query.side_effect = Exception("DB is down!")

    # Should return a RoutingResult with all None, no exception
    result = auto_route_complaint(db, latitude=0.0, longitude=0.0, category_id=1)
    assert isinstance(result, RoutingResult)
    assert result.ward_id             is None
    assert result.department_id       is None
    assert result.assigned_officer_id is None
