"""
services/cloudinary_service.py — Cloudinary Media Management

Production-grade image upload, delete, and complaint integration via Cloudinary.

Functions:
  configure_cloudinary()         — Initialize Cloudinary SDK from .env
  validate_image()               — MIME type + size validation
  upload_image()                 — Upload a single image, return secure_url + public_id
  upload_multiple_images()       — Upload batch of images
  delete_image()                 — Remove image from Cloudinary by public_id
  attach_images_to_complaint()   — Upload images + persist to complaint_images table
"""

import os
import uuid
import logging
from typing import BinaryIO

import cloudinary
import cloudinary.uploader
from fastapi import UploadFile

from app.models.complaint_image import ComplaintImage
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# ── Constants ────────────────────────────────────────────────────────────────
ALLOWED_MIME_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB
UPLOAD_FOLDER = "civicpulse/complaints"


# ═══════════════════════════════════════════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════════════════════════════════════════

def configure_cloudinary() -> None:
    """
    Initialize the Cloudinary SDK using environment variables.
    Call once at application startup (lifespan).

    Required env vars:
      CLOUDINARY_CLOUD_NAME
      CLOUDINARY_API_KEY
      CLOUDINARY_API_SECRET
    """
    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME")
    api_key    = os.getenv("CLOUDINARY_API_KEY")
    api_secret = os.getenv("CLOUDINARY_API_SECRET")

    if not all([cloud_name, api_key, api_secret]):
        logger.warning(
            "Cloudinary credentials not configured. "
            "Image uploads will fail until CLOUDINARY_* env vars are set."
        )
        return

    cloudinary.config(
        cloud_name = cloud_name,
        api_key    = api_key,
        api_secret = api_secret,
        secure     = True,
    )
    logger.info("Cloudinary configured: cloud=%s", cloud_name)


# ═══════════════════════════════════════════════════════════════════════════════
# Validation
# ═══════════════════════════════════════════════════════════════════════════════

async def validate_image(file: UploadFile) -> None:
    """
    Validate an uploaded image file.

    Checks:
      1. MIME type is in the allow-list (jpg, jpeg, png, webp).
      2. File extension matches.
      3. File size does not exceed 10 MB.

    Raises ValueError with a human-readable message on failure.
    """
    # ── MIME type ────────────────────────────────────────────────────────────
    content_type = file.content_type or ""
    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()

    # Some browsers/upload clients send empty or generic MIME types,
    # so we allow through if the extension is valid.
    if content_type not in ALLOWED_MIME_TYPES and ext not in ALLOWED_EXTENSIONS:
        raise ValueError(
            f"Invalid file type '{content_type}' / extension '{ext}'. "
            f"Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    # ── Extension ────────────────────────────────────────────────────────────
    if ext and ext not in ALLOWED_EXTENSIONS:
        raise ValueError(
            f"Invalid file extension '{ext}'. "
            f"Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    # ── Size check ───────────────────────────────────────────────────────────
    # Read the file to check actual size, then seek back to start
    contents = await file.read()
    size = len(contents)
    await file.seek(0)  # Reset for subsequent reads

    if size > MAX_FILE_SIZE_BYTES:
        size_mb = size / (1024 * 1024)
        raise ValueError(
            f"File size {size_mb:.1f} MB exceeds the 10 MB limit."
        )

    if size == 0:
        raise ValueError("File is empty.")


# ═══════════════════════════════════════════════════════════════════════════════
# Upload
# ═══════════════════════════════════════════════════════════════════════════════

async def upload_image(file: UploadFile) -> dict:
    """
    Upload a single image to Cloudinary.

    Steps:
      1. Validate MIME type and size.
      2. Generate a unique public_id.
      3. Upload to Cloudinary.
      4. Return {secure_url, public_id, original_filename}.

    Raises ValueError on validation failure, RuntimeError on upload failure.
    """
    await validate_image(file)

    # Generate unique filename
    unique_id = str(uuid.uuid4())[:8]
    original_name = os.path.splitext(file.filename or "image")[0]
    # Sanitize filename — only keep alphanumeric and hyphens
    safe_name = "".join(c if c.isalnum() or c == "-" else "_" for c in original_name)
    public_id = f"{UPLOAD_FOLDER}/{safe_name}_{unique_id}"

    try:
        contents = await file.read()
        result = cloudinary.uploader.upload(
            contents,
            public_id       = public_id,
            resource_type   = "image",
            overwrite       = False,
            quality         = "auto:good",
            fetch_format    = "auto",
            transformation  = [
                {"width": 1920, "height": 1920, "crop": "limit"},  # cap resolution
            ],
        )
    except Exception as exc:
        logger.error("Cloudinary upload failed: %s", exc)
        raise RuntimeError(f"Image upload failed: {exc}") from exc

    logger.info(
        "Image uploaded: public_id=%s size=%s bytes",
        result["public_id"], result.get("bytes", "?"),
    )

    return {
        "secure_url":        result["secure_url"],
        "public_id":         result["public_id"],
        "original_filename": file.filename,
        "format":            result.get("format"),
        "width":             result.get("width"),
        "height":            result.get("height"),
        "bytes":             result.get("bytes"),
    }


async def upload_multiple_images(files: list[UploadFile]) -> list[dict]:
    """
    Upload multiple images to Cloudinary.

    Returns a list of upload result dicts (same shape as upload_image).
    Raises on the first validation/upload failure.
    """
    if not files:
        raise ValueError("No files provided.")

    if len(files) > 10:
        raise ValueError("Maximum 10 images per upload.")

    results = []
    for file in files:
        result = await upload_image(file)
        results.append(result)

    return results


# ═══════════════════════════════════════════════════════════════════════════════
# Delete
# ═══════════════════════════════════════════════════════════════════════════════

def delete_image(public_id: str) -> dict:
    """
    Delete an image from Cloudinary by its public_id.

    Returns the Cloudinary API response {"result": "ok" | "not found"}.
    Raises RuntimeError on API failure.
    """
    if not public_id:
        raise ValueError("public_id is required.")

    try:
        result = cloudinary.uploader.destroy(public_id, resource_type="image")
    except Exception as exc:
        logger.error("Cloudinary delete failed: public_id=%s error=%s", public_id, exc)
        raise RuntimeError(f"Image deletion failed: {exc}") from exc

    status = result.get("result", "unknown")
    logger.info("Image deleted: public_id=%s result=%s", public_id, status)

    return {"public_id": public_id, "result": status}


# ═══════════════════════════════════════════════════════════════════════════════
# Complaint Integration
# ═══════════════════════════════════════════════════════════════════════════════

async def attach_images_to_complaint(
    db: Session,
    complaint_id: str,
    files: list[UploadFile],
) -> list[ComplaintImage]:
    """
    Upload images to Cloudinary and persist them in the complaint_images table.

    Steps:
      1. Upload each file to Cloudinary.
      2. Create a ComplaintImage row with the secure_url and public_id.
      3. Flush to DB (caller controls commit via session scope).

    Returns list of created ComplaintImage ORM objects.
    """
    uploaded_records: list[ComplaintImage] = []

    for file in files:
        result = await upload_image(file)

        image_record = ComplaintImage(
            id           = str(uuid.uuid4()),
            complaint_id = complaint_id,
            image_url    = result["secure_url"],
            public_id    = result["public_id"],
        )
        db.add(image_record)
        uploaded_records.append(image_record)

    db.flush()

    logger.info(
        "Attached %d images to complaint %s",
        len(uploaded_records), complaint_id,
    )
    return uploaded_records
