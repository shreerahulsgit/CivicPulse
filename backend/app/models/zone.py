"""
models/zone.py — Zone Model

Table: zones

A zone is an administrative subdivision within a jurisdiction (e.g. GCC
has 15 zones). Wards belong to a zone, and departments are mapped per zone
via the zone_departments pivot table.

Columns:
  id              — Auto-increment INT
  jurisdiction_id — FK → jurisdictions.id
  zone_number     — INT (e.g. 1–15 for GCC)
  zone_name       — VARCHAR(100) (e.g. "Thiruvottiyur", "Teynampet")
"""

from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class Zone(Base):
    __tablename__ = "zones"
    __table_args__ = (
        UniqueConstraint("jurisdiction_id", "zone_number", name="uq_zone_jurisdiction"),
    )

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    jurisdiction_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("jurisdictions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    zone_number: Mapped[int] = mapped_column(
        Integer, nullable=False, index=True
    )
    zone_name: Mapped[str] = mapped_column(
        String(100), nullable=False
    )

    # ── Relationships ────────────────────────────────────────────────────────
    jurisdiction = relationship("Jurisdiction", lazy="selectin")
    wards = relationship("Ward", back_populates="zone", lazy="selectin")
    zone_departments = relationship(
        "ZoneDepartment", back_populates="zone", lazy="selectin",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Zone id={self.id} number={self.zone_number} name={self.zone_name!r}>"
