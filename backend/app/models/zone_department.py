"""
models/zone_department.py — Zone–Department Pivot Model

Table: zone_departments

Maps each zone to each department with zone-specific contact info.
E.g. Zone 9 (Teynampet) + Roads & Infrastructure → contact: zone9-roads@gcc.gov.in

Columns:
  id                 — Auto-increment INT
  zone_id            — FK → zones.id
  department_id      — FK → departments.id
  contact_identifier — VARCHAR(300), email/phone/inbox for this zone+dept
  contact_name       — VARCHAR(200), responsible person name (optional)
"""

from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class ZoneDepartment(Base):
    __tablename__ = "zone_departments"
    __table_args__ = (
        UniqueConstraint("zone_id", "department_id", name="uq_zone_department"),
    )

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    zone_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("zones.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    department_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("departments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    contact_identifier: Mapped[str | None] = mapped_column(
        String(300), nullable=True,
        comment="Email / phone / inbox ID for this zone+department",
    )
    contact_name: Mapped[str | None] = mapped_column(
        String(200), nullable=True,
        comment="Responsible person name for this zone+department",
    )

    # ── Relationships ────────────────────────────────────────────────────────
    zone       = relationship("Zone", back_populates="zone_departments", lazy="selectin")
    department = relationship("Department", lazy="selectin")

    def __repr__(self) -> str:
        return (
            f"<ZoneDepartment id={self.id} zone={self.zone_id} "
            f"dept={self.department_id} contact={self.contact_identifier!r}>"
        )
