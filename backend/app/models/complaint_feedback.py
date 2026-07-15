"""
models/complaint_feedback.py — Citizen Feedback / Rating

Table: complaint_feedback

Citizen rates a resolved complaint (1–5 stars) and optionally leaves a comment.
Created when the citizen accepts the officer's resolution.

One feedback record per complaint (UNIQUE on complaint_id).
"""

import uuid

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class ComplaintFeedback(Base):
    __tablename__ = "complaint_feedback"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    complaint_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("complaints.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,          # one rating per complaint
        index=True,
    )

    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    rating: Mapped[int] = mapped_column(
        Integer, nullable=False,
        comment="1–5 star rating from the citizen",
    )

    comment: Mapped[str | None] = mapped_column(
        Text, nullable=True, default=None,
    )

    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    complaint = relationship("Complaint", back_populates="feedback")
    user      = relationship("User", foreign_keys=[user_id])

    def __repr__(self) -> str:
        return (
            f"<ComplaintFeedback complaint={self.complaint_id!r} "
            f"rating={self.rating} user={self.user_id!r}>"
        )
