"""
schemas/upload.py — Media Upload Pydantic Schemas

Response schemas for Cloudinary upload and delete operations.
"""

from pydantic import BaseModel, ConfigDict


class ImageUploadResponse(BaseModel):
    """Response for a single image upload."""
    secure_url: str
    public_id: str
    original_filename: str | None = None
    format: str | None = None
    width: int | None = None
    height: int | None = None
    bytes: int | None = None


class MultiImageUploadResponse(BaseModel):
    """Response for a batch image upload."""
    uploaded: list[ImageUploadResponse]
    count: int


class ImageDeleteResponse(BaseModel):
    """Response for image deletion."""
    public_id: str
    result: str
