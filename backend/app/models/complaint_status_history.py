"""
models/complaint_status_history.py — Status Change Audit Trail

Table: complaint_status_history

Immutable audit log — every status transition is recorded with who made it
and when. Used for SLA tracking, analytics, and accountability.

Columns:
  id           — CHAR(36) UUID
  complaint_id — FK → complaints.id (CASCADE delete)
  old_status   — previous status value
  new_status   — new status value
  updated_by   — FK → users.id (the admin or user who made the change)
  updated_at   — DATETIME, auto-set
"""

import uuid

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.complaint import ComplaintStatus


class ComplaintStatusHistory(Base):
    __tablename__ = "complaint_status_history"

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

    old_status: Mapped[str] = mapped_column(String(20), nullable=False)
    new_status: Mapped[str] = mapped_column(String(20), nullable=False)

    # Who triggered the transition (admin or system)
    updated_by: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Optional human-readable note (populated by admin actions)
    note: Mapped[str | None] = mapped_column(
        String(1000), nullable=True, default=None,
        comment="Admin-supplied note for audit trail (reassignment, override, etc.)",
    )

    # ── Relationships ────────────────────────────────────────────────────────
    complaint = relationship("Complaint", back_populates="status_history")
    updater   = relationship("User", lazy="selectin")

    def __repr__(self) -> str:
        return (
            f"<StatusHistory complaint={self.complaint_id!r} "
            f"{self.old_status}→{self.new_status}>"
        )
