"""
models/ward_geometry.py — Ward Geometry (MySQL Spatial)

Table: ward_geometries

Stores the actual MySQL GEOMETRY column for each ward's boundary polygon.
Separated from the `wards` table so:
  - Old code reading `wards.polygon_geojson` (TEXT) still works
  - Spatial queries use this table with a SPATIAL INDEX
  - Frontend map rendering still reads GeoJSON text from `wards`

Note: This model defines the Python side. The actual GEOMETRY column and
SPATIAL INDEX are created via raw DDL in migrate_spatial.py because
SQLAlchemy's MySQL dialect doesn't natively handle SRID constraints
on GEOMETRY columns well.

Columns:
  ward_id      — INT PK, FK → wards.id (1:1)
  centroid_lat — DOUBLE (precomputed for nearest-ward fallback)
  centroid_lng — DOUBLE
  -- boundary  — GEOMETRY NOT NULL SRID 4326 (created via raw DDL)
"""

from sqlalchemy import Float, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class WardGeometry(Base):
    __tablename__ = "ward_geometries"

    ward_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("wards.id", ondelete="CASCADE"),
        primary_key=True,
    )
    centroid_lat: Mapped[float | None] = mapped_column(
        Float, nullable=True,
        comment="Precomputed centroid latitude for nearest-ward fallback",
    )
    centroid_lng: Mapped[float | None] = mapped_column(
        Float, nullable=True,
        comment="Precomputed centroid longitude for nearest-ward fallback",
    )

    # ── Relationships ────────────────────────────────────────────────────────
    ward = relationship("Ward", lazy="selectin")

    def __repr__(self) -> str:
        return f"<WardGeometry ward_id={self.ward_id} centroid=({self.centroid_lat}, {self.centroid_lng})>"
