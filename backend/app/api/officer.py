"""
api/officer.py — Officer Operations & Citizen Timeline Routes

Officer Endpoints (require admin/officer role + complaint assignment):
  GET    /officer/complaints                         All assigned complaints
  GET    /officer/complaints/pending                 Submitted/under_review
  GET    /officer/complaints/in-progress             In-progress only
  PATCH  /officer/complaints/{id}/accept             Accept → in_progress
  PATCH  /officer/complaints/{id}/resolve            Resolve (needs AFTER image)
  POST   /officer/complaints/{id}/progress           Add progress text update
  POST   /officer/complaints/{id}/resolution-images  Upload before/after images

Citizen Endpoint (JWT required):
  GET    /complaints/{id}/timeline                   Full chronological timeline
"""

import logging
from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_officer
from app.database.session import get_db
from app.models.complaint_resolution_image import ResolutionImageType
from app.models.user import User
from app.schemas.complaint import ComplaintResponse
from app.schemas.officer import (
    ComplaintTimelineResponse,
    ProgressCreate,
    ProgressResponse,
    ResolutionImageResponse,
)
from app.services.officer_service import (
    accept_complaint,
    add_progress_update,
    add_resolution_images,
    get_complaint_timeline,
    get_inprogress_complaints,
    get_officer_complaints,
    get_pending_complaints,
    resolve_complaint,
)

logger = logging.getLogger(__name__)

officer_router = APIRouter(prefix="/officer/complaints", tags=["Officer Operations"])
citizen_router = APIRouter(prefix="/complaints",         tags=["Citizen — Timeline"])


# ═══════════════════════════════════════════════════════════════════════════════
# Officer — Read
# ═══════════════════════════════════════════════════════════════════════════════

@officer_router.get(
    "",
    response_model=list[ComplaintResponse],
    summary="List all my assigned complaints",
)
def list_officer_complaints(
    skip:    int = Query(default=0, ge=0),
    limit:   int = Query(default=20, ge=1, le=100),
    officer: User    = Depends(require_officer),
    db:      Session = Depends(get_db),
) -> list[ComplaintResponse]:
    return get_officer_complaints(db, officer, skip=skip, limit=limit)


@officer_router.get(
    "/pending",
    response_model=list[ComplaintResponse],
    summary="List pending (submitted/under_review) assigned complaints",
)
def list_pending_complaints(
    skip:    int = Query(default=0, ge=0),
    limit:   int = Query(default=20, ge=1, le=100),
    officer: User    = Depends(require_officer),
    db:      Session = Depends(get_db),
) -> list[ComplaintResponse]:
    return get_pending_complaints(db, officer, skip=skip, limit=limit)


@officer_router.get(
    "/in-progress",
    response_model=list[ComplaintResponse],
    summary="List in-progress assigned complaints",
)
def list_inprogress_complaints(
    skip:    int = Query(default=0, ge=0),
    limit:   int = Query(default=20, ge=1, le=100),
    officer: User    = Depends(require_officer),
    db:      Session = Depends(get_db),
) -> list[ComplaintResponse]:
    return get_inprogress_complaints(db, officer, skip=skip, limit=limit)


# ═══════════════════════════════════════════════════════════════════════════════
# Officer — Status transitions
# ═══════════════════════════════════════════════════════════════════════════════

@officer_router.patch(
    "/{complaint_id}/accept",
    response_model=ComplaintResponse,
    status_code=status.HTTP_200_OK,
    summary="Accept a complaint (submitted → in_progress)",
)
def accept(
    complaint_id: str,
    officer:      User    = Depends(require_officer),
    db:           Session = Depends(get_db),
) -> ComplaintResponse:
    try:
        return accept_complaint(db, complaint_id, officer)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@officer_router.patch(
    "/{complaint_id}/resolve",
    response_model=ComplaintResponse,
    status_code=status.HTTP_200_OK,
    summary="Resolve a complaint (in_progress → resolved) — requires AFTER image",
)
def resolve(
    complaint_id: str,
    officer:      User    = Depends(require_officer),
    db:           Session = Depends(get_db),
) -> ComplaintResponse:
    try:
        return resolve_complaint(db, complaint_id, officer)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


# ═══════════════════════════════════════════════════════════════════════════════
# Officer — Progress updates
# ═══════════════════════════════════════════════════════════════════════════════

@officer_router.post(
    "/{complaint_id}/progress",
    response_model=ProgressResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Post a progress update on an assigned complaint",
)
def post_progress(
    complaint_id: str,
    payload:      ProgressCreate,
    officer:      User    = Depends(require_officer),
    db:           Session = Depends(get_db),
) -> ProgressResponse:
    try:
        return add_progress_update(db, complaint_id, officer, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


# ═══════════════════════════════════════════════════════════════════════════════
# Officer — Resolution images
# ═══════════════════════════════════════════════════════════════════════════════

@officer_router.post(
    "/{complaint_id}/resolution-images",
    response_model=list[ResolutionImageResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Upload before/after resolution images",
    description=(
        "Upload resolution images to Cloudinary. "
        "Use `image_type=before` for initial site photos, `image_type=after` for post-repair photos. "
        "At least one AFTER image is required before resolving a complaint."
    ),
)
async def upload_resolution_images(
    complaint_id: str,
    image_type:   ResolutionImageType = Form(
        ...,
        description="Image type: 'before' or 'after'",
    ),
    files:        list[UploadFile] = File(
        ..., description="Image files (max 5, JPG/PNG/WEBP, 10 MB each)"
    ),
    officer:      User    = Depends(require_officer),
    db:           Session = Depends(get_db),
) -> list[ResolutionImageResponse]:
    try:
        return await add_resolution_images(db, complaint_id, officer, files, image_type)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))


# ═══════════════════════════════════════════════════════════════════════════════
# Citizen — Timeline
# ═══════════════════════════════════════════════════════════════════════════════

@citizen_router.get(
    "/{complaint_id}/timeline",
    response_model=ComplaintTimelineResponse,
    summary="Get full chronological timeline of a complaint",
    description=(
        "Returns all events on a complaint in chronological order: "
        "status changes, officer progress updates, and resolution images. "
        "Available to any authenticated user."
    ),
)
def complaint_timeline(
    complaint_id:  str,
    _current_user: User    = Depends(get_current_user),
    db:            Session = Depends(get_db),
) -> ComplaintTimelineResponse:
    try:
        return get_complaint_timeline(db, complaint_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
