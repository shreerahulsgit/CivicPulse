"""
models/category.py — Complaint Category Model

Table: categories

Pre-seeded lookup table for civic issue categories (e.g. potholes, water,
electricity, sanitation). Complaints reference this via FK.

Columns:
  id          — Auto-increment INT primary key (small fixed set, no UUID needed)
  name        — VARCHAR(100), unique, indexed (e.g. "Pothole")
  description — VARCHAR(500), optional longer explanation
"""

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    name: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False, index=True
    )
    description: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )

    # ── Relationships ────────────────────────────────────────────────────────
    complaints = relationship("Complaint", back_populates="category", lazy="selectin")

    def __repr__(self) -> str:
        return f"<Category id={self.id} name={self.name!r}>"
