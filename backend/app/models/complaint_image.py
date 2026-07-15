"""
models/complaint_image.py — Complaint Image Attachment Model

Table: complaint_images

Stores Cloudinary-hosted images attached to a complaint.
A complaint can have multiple images; images cascade-delete with the complaint.

Columns:
  id           — CHAR(36) UUID
  complaint_id — FK → complaints.id (CASCADE delete)
  image_url    — VARCHAR(500), Cloudinary secure_url
  public_id    — VARCHAR(255), Cloudinary public_id (for deletion)
  created_at   — DATETIME, auto-set
"""

import uuid

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class ComplaintImage(Base):
    __tablename__ = "complaint_images"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    complaint_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("complaints.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    image_url: Mapped[str] = mapped_column(
        String(500), nullable=False,
        comment="Cloudinary secure_url",
    )

    public_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, index=True,
        comment="Cloudinary public_id for deletion",
    )

    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # ── Relationships ────────────────────────────────────────────────────────
    complaint = relationship("Complaint", back_populates="images")

    def __repr__(self) -> str:
        return f"<ComplaintImage id={self.id!r} complaint={self.complaint_id!r}>"
