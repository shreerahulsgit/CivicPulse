"""
models/complaint_resolution_image.py — Resolution Images

Table: complaint_resolution_images

Cloudinary-hosted before/after photos uploaded by an officer
to document a complaint's resolution.

Columns:
  id           — CHAR(36) UUID
  complaint_id — FK → complaints.id (CASCADE delete)
  uploaded_by  — FK → users.id (SET NULL on delete)
  public_id    — VARCHAR(255), Cloudinary public_id
  secure_url   — VARCHAR(500), Cloudinary secure_url
  image_type   — ENUM: before | after
  uploaded_at  — DATETIME, auto-set
"""

import uuid
import enum

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class ResolutionImageType(str, enum.Enum):
    BEFORE = "before"
    AFTER  = "after"


class ComplaintResolutionImage(Base):
    __tablename__ = "complaint_resolution_images"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    complaint_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("complaints.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )

    uploaded_by: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )

    public_id: Mapped[str] = mapped_column(
        String(255), nullable=False, index=True,
        comment="Cloudinary public_id",
    )

    secure_url: Mapped[str] = mapped_column(
        String(500), nullable=False,
        comment="Cloudinary secure_url",
    )

    image_type: Mapped[ResolutionImageType] = mapped_column(
        SAEnum(ResolutionImageType, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        comment="before | after",
    )

    uploaded_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # ── Relationships ────────────────────────────────────────────────────────
    complaint = relationship("Complaint", back_populates="resolution_images")
    uploader  = relationship("User", foreign_keys=[uploaded_by])

    def __repr__(self) -> str:
        return (
            f"<ResolutionImage id={self.id!r} complaint={self.complaint_id!r} "
            f"type={self.image_type!r}>"
        )
