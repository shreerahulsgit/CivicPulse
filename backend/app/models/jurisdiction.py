"""
models/jurisdiction.py — Jurisdiction Model

Table: jurisdictions

Represents the top-level civic administrative body — either a Municipal
Corporation or a Municipality. Wards belong to a jurisdiction.

Columns:
  id   — Auto-increment INT
  name — VARCHAR(200), unique (e.g. "Brihanmumbai Municipal Corporation")
  type — ENUM: corporation | municipality
"""

import enum

from sqlalchemy import Enum as SAEnum, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class JurisdictionType(str, enum.Enum):
    CORPORATION  = "corporation"
    MUNICIPALITY = "municipality"


class Jurisdiction(Base):
    __tablename__ = "jurisdictions"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    name: Mapped[str] = mapped_column(
        String(200), unique=True, nullable=False, index=True
    )
    type: Mapped[JurisdictionType] = mapped_column(
        SAEnum(JurisdictionType, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )

    # ── Relationships ────────────────────────────────────────────────────────
    wards = relationship("Ward", back_populates="jurisdiction", lazy="selectin")

    def __repr__(self) -> str:
        return f"<Jurisdiction id={self.id} name={self.name!r} type={self.type}>"
