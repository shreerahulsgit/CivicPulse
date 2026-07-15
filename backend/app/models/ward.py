"""
models/ward.py — Ward Model

Table: wards

A ward is the smallest administrative division within a jurisdiction.
Complaints are geo-located into wards, and officers are assigned per ward.

Columns:
  id              — Auto-increment INT
  jurisdiction_id — FK → jurisdictions.id
  ward_number     — VARCHAR(20), e.g. "W-14"
  zone_number     — VARCHAR(20), e.g. "Z-3" (optional)
  ward_name       — VARCHAR(200), human-readable name
  polygon_geojson — TEXT, GeoJSON polygon boundary (nullable, for map rendering)
"""

from sqlalchemy import ForeignKey, Integer, String, Text
from typing import Optional
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class Ward(Base):
    __tablename__ = "wards"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    jurisdiction_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("jurisdictions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    ward_number: Mapped[str] = mapped_column(
        String(20), nullable=False, index=True
    )
    zone_number: Mapped[str | None] = mapped_column(
        String(20), nullable=True,
        comment="Legacy zone label — prefer zone_id FK for queries",
    )
    zone_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("zones.id", ondelete="SET NULL"),
        nullable=True, default=None, index=True,
        comment="FK to zones table (populated by ingest script)",
    )
    ward_name: Mapped[str] = mapped_column(
        String(200), nullable=False
    )
    polygon_geojson: Mapped[str | None] = mapped_column(
        Text, nullable=True,
        comment="GeoJSON polygon boundary for map rendering",
    )

    # ── Relationships ────────────────────────────────────────────────────────
    jurisdiction = relationship("Jurisdiction", back_populates="wards", lazy="selectin")
    zone = relationship("Zone", back_populates="wards", lazy="selectin")
    officer_assignments = relationship(
        "OfficerAssignment", back_populates="ward", lazy="selectin"
    )
    geometry = relationship(
        "WardGeometry", lazy="select", uselist=False,
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Ward id={self.id} ward_number={self.ward_number!r} name={self.ward_name!r}>"
