"""
models/complaint_escalation.py — Complaint Escalation Audit Trail

Table: complaint_escalations

Records every escalation action taken on a complaint by an admin.
Multiple escalations are allowed per complaint (each is a new row).

Columns:
  id           — UUID PK
  complaint_id — FK → complaints (cascade delete)
  escalated_by — FK → users (SET NULL on delete)
  reason       — Mandatory free-text reason for escalation
  created_at   — Timestamp
"""

import uuid
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base


class ComplaintEscalation(Base):
    __tablename__ = "complaint_escalations"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    complaint_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("complaints.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    escalated_by: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    reason: Mapped[str] = mapped_column(
        Text, nullable=False,
        comment="Admin-provided escalation reason or auto-generated message",
    )
    escalation_level: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default="1",
        comment="1=escalated to zonal, 2=escalated to admin",
    )
    trigger_type: Mapped[str] = mapped_column(
        String(10), nullable=False, default="auto", server_default="'auto'",
        comment="auto=background scheduler, manual=admin action",
    )
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    complaint   = relationship("Complaint",   foreign_keys=[complaint_id], lazy="selectin")
    escalated_by_user = relationship("User", foreign_keys=[escalated_by],  lazy="selectin")

    def __repr__(self) -> str:
        return (
            f"<ComplaintEscalation id={self.id!r} "
            f"complaint={self.complaint_id!r} by={self.escalated_by!r}>"
        )
