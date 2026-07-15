"""
models/department.py — Municipal Department Model

Table: departments

Lookup table for municipal departments (e.g. Roads, Water Supply, Sanitation).
Officers are assigned to departments, and complaints can be routed here.

Columns:
  id          — Auto-increment INT primary key
  name        — VARCHAR(150), unique, indexed
  description — VARCHAR(500), optional
"""

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    name: Mapped[str] = mapped_column(
        String(150), unique=True, nullable=False, index=True
    )
    description: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )

    # ── Relationships ────────────────────────────────────────────────────────
    officer_assignments = relationship(
        "OfficerAssignment", back_populates="department", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<Department id={self.id} name={self.name!r}>"
