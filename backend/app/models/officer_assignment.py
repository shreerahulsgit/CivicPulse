"""
models/officer_assignment.py — Officer Assignment Model

Table: officer_assignments

Links a User (with admin role) to a Department and a Ward, representing
which officer is responsible for handling complaints in that area.

Columns:
  id            — CHAR(36) UUID
  user_id       — FK → users.id (the assigned officer)
  department_id — FK → departments.id
  ward_id       — FK → wards.id
  assigned_at   — DATETIME, auto-set at INSERT
"""

import uuid

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class OfficerAssignment(Base):
    __tablename__ = "officer_assignments"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    department_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("departments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    ward_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("wards.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    assigned_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # ── Relationships ────────────────────────────────────────────────────────
    user       = relationship("User", backref="officer_assignments", lazy="selectin")
    department = relationship("Department", back_populates="officer_assignments", lazy="selectin")
    ward       = relationship("Ward", back_populates="officer_assignments", lazy="selectin")

    def __repr__(self) -> str:
        return (
            f"<OfficerAssignment id={self.id!r} user={self.user_id!r} "
            f"dept={self.department_id} ward={self.ward_id}>"
        )
