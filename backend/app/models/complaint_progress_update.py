"""
models/complaint_progress_update.py — Officer Progress Updates

Table: complaint_progress_updates

Officers post timestamped text updates on a complaint's progress
(e.g., "Arrived on site", "Work in progress", "Awaiting materials").

Columns:
  id           — CHAR(36) UUID
  complaint_id — FK → complaints.id (CASCADE delete)
  officer_id   — FK → users.id (CASCADE delete)
  message      — TEXT, required
  created_at   — DATETIME, auto-set
"""

import uuid

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class ComplaintProgressUpdate(Base):
    __tablename__ = "complaint_progress_updates"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    complaint_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("complaints.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )

    officer_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )

    message: Mapped[str] = mapped_column(Text, nullable=False)

    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # ── Relationships ────────────────────────────────────────────────────────
    complaint = relationship("Complaint", back_populates="progress_updates")
    officer   = relationship("User", foreign_keys=[officer_id])

    def __repr__(self) -> str:
        return f"<ProgressUpdate id={self.id!r} complaint={self.complaint_id!r}>"
