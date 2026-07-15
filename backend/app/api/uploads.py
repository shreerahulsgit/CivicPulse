"""
api/uploads.py — Media Upload Routes

Endpoints:
  POST   /uploads/image        Upload a single image to Cloudinary (JWT required)
  POST   /uploads/images       Upload multiple images (max 10) (JWT required)
  DELETE /uploads/{public_id}  Delete an image from Cloudinary (Admin only)

All uploads are validated for:
  - MIME type (jpg, jpeg, png, webp)
  - File size (max 10 MB)
  - Non-empty content
"""

import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.api.deps import get_current_user, require_admin
from app.models.user import User
from app.schemas.upload import (
    ImageDeleteResponse,
    ImageUploadResponse,
    MultiImageUploadResponse,
)
from app.services.cloudinary_service import (
    delete_image,
    upload_image,
    upload_multiple_images,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/uploads", tags=["Uploads"])


# ═══════════════════════════════════════════════════════════════════════════════
# POST /uploads/image — Single image upload
# ═══════════════════════════════════════════════════════════════════════════════
@router.post(
    "/image",
    response_model=ImageUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a single image",
    description="Upload one image to Cloudinary. Accepted formats: JPG, JPEG, PNG, WEBP. Max size: 10 MB.",
)
async def upload_single_image(
    file: UploadFile = File(..., description="Image file to upload"),
    _current_user: User = Depends(get_current_user),
) -> ImageUploadResponse:
    try:
        result = await upload_image(file)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        )

    return ImageUploadResponse(**result)


# ═══════════════════════════════════════════════════════════════════════════════
# POST /uploads/images — Multiple image upload
# ═══════════════════════════════════════════════════════════════════════════════
@router.post(
    "/images",
    response_model=MultiImageUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload multiple images",
    description="Upload up to 10 images at once. Same format/size restrictions as single upload.",
)
async def upload_batch_images(
    files: list[UploadFile] = File(..., description="Image files to upload (max 10)"),
    _current_user: User = Depends(get_current_user),
) -> MultiImageUploadResponse:
    try:
        results = await upload_multiple_images(files)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        )

    return MultiImageUploadResponse(
        uploaded=[ImageUploadResponse(**r) for r in results],
        count=len(results),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# DELETE /uploads/{public_id} — Delete an image
# ═══════════════════════════════════════════════════════════════════════════════
@router.delete(
    "/{public_id:path}",
    response_model=ImageDeleteResponse,
    status_code=status.HTTP_200_OK,
    summary="Delete an image (Admin only)",
    description="Remove an image from Cloudinary by its public_id. Admin-only.",
)
def delete_uploaded_image(
    public_id: str,
    _admin: User = Depends(require_admin),
) -> ImageDeleteResponse:
    try:
        result = delete_image(public_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        )

    return ImageDeleteResponse(**result)
