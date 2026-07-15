"""
api/geo.py — Geospatial Resolution Endpoint

Endpoints:
  GET /geo/resolve?lat=...&lng=...  Resolve GPS coordinates to ward/zone/department

Used by the frontend during complaint creation to show:
  "Your complaint will be routed to Zone 8 (Anna Nagar) — Roads & Infrastructure"
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.services.geospatial_service import find_ward, WardMatch

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/geo", tags=["Geospatial"])


# ── Response schemas ─────────────────────────────────────────────────────────

class GeoResolveResponse(BaseModel):
    """Result of resolving a GPS coordinate to a ward/zone."""
    ward_id:         int
    ward_number:     str
    ward_name:       str
    zone_id:         Optional[int]      = None
    zone_number:     Optional[str]      = None
    zone_name:       Optional[str]      = None
    jurisdiction_id: int
    jurisdiction_name: Optional[str]    = None

    class Config:
        from_attributes = True


class GeoResolveNotFoundResponse(BaseModel):
    """Returned when coordinates fall outside all known wards."""
    detail:    str
    latitude:  float
    longitude: float
    suggestion: str = "Please adjust the pin on the map to a location within city limits."


# ═══════════════════════════════════════════════════════════════════════════════
# GET /geo/resolve
# ═══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/resolve",
    response_model=GeoResolveResponse,
    summary="Resolve GPS coordinates to ward and zone",
    description=(
        "Takes latitude/longitude and returns the matched ward, zone, and "
        "jurisdiction. Used during complaint submission to show routing info. "
        "Returns 404 if coordinates fall outside all known ward boundaries."
    ),
    responses={
        404: {
            "model": GeoResolveNotFoundResponse,
            "description": "Coordinates fall outside all known ward boundaries",
        },
    },
)
def resolve_location(
    lat: float = Query(
        ..., ge=-90, le=90,
        description="Latitude (WGS84)",
        examples=[13.0827],
    ),
    lng: float = Query(
        ..., ge=-180, le=180,
        description="Longitude (WGS84)",
        examples=[80.2707],
    ),
    db: Session = Depends(get_db),
) -> GeoResolveResponse:
    ward_match: WardMatch | None = find_ward(db, lat, lng)

    if not ward_match:
        logger.warning(
            "Geo resolve: no ward found for (%.6f, %.6f) — outside jurisdiction",
            lat, lng,
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "detail": "These coordinates fall outside all known ward boundaries.",
                "latitude": lat,
                "longitude": lng,
                "suggestion": (
                    "Please adjust the pin on the map to a location within "
                    "Greater Chennai Corporation limits."
                ),
            },
        )

    # Fetch jurisdiction name for the response
    from sqlalchemy import text as sql_text
    jurisdiction_name = None
    if ward_match.jurisdiction_id:
        result = db.execute(sql_text(
            "SELECT name FROM jurisdictions WHERE id = :jid"
        ), {"jid": ward_match.jurisdiction_id})
        row = result.first()
        if row:
            jurisdiction_name = row[0]

    return GeoResolveResponse(
        ward_id           = ward_match.ward_id,
        ward_number       = ward_match.ward_number,
        ward_name         = ward_match.ward_name,
        zone_id           = ward_match.zone_id,
        zone_number       = ward_match.zone_number,
        zone_name         = ward_match.zone_name,
        jurisdiction_id   = ward_match.jurisdiction_id,
        jurisdiction_name = jurisdiction_name,
    )
