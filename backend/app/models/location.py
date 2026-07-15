"""
models/location.py — Geolocation Model

Table: locations

Stores the GPS coordinates and reverse-geocoded address for each complaint.
Separated from complaints so multiple complaints at the same spot can be
clustered (duplicate detection / heatmap logic).

Columns:
  id         — CHAR(36) UUID
  latitude   — DOUBLE, WGS-84 latitude (-90 to 90)
  longitude  — DOUBLE, WGS-84 longitude (-180 to 180)
  address    — VARCHAR(500), human-readable reverse-geocoded address
  created_at — DATETIME, auto-set at INSERT
"""

import uuid

from sqlalchemy import DateTime, Float, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class Location(Base):
    __tablename__ = "locations"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)

    address: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )

    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # ── Relationships ────────────────────────────────────────────────────────
    complaints = relationship("Complaint", back_populates="location", lazy="selectin")

    def __repr__(self) -> str:
        return f"<Location id={self.id!r} lat={self.latitude} lng={self.longitude}>"
