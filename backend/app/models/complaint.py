"""
models/complaint.py — Core Complaint Model

Table: complaints

Central entity of CivicPulse. A complaint is a civic issue reported by a
citizen, categorised, geo-located, and optionally enriched by AI.

Status lifecycle:  submitted → under_review → in_progress → resolved / rejected

AI-populated fields (nullable until the ML pipeline runs):
  severity_score     — float 0.0–1.0 from the prioritisation model
  ai_category        — category predicted by BERT classifier
  duplicate_group_id — clustering ID from Sentence-BERT similarity

Routing fields (auto-populated by GeoSpatial Routing Engine):
  ward_id            — FK → wards.id, detected from GPS coordinates
  jurisdiction_id    — FK → jurisdictions.id, derived from ward
  department_id      — FK → departments.id, mapped from category
  assigned_officer_id — FK → users.id, auto-assigned officer
"""

import uuid
import enum

from sqlalchemy import (
    DateTime,
    Enum as SAEnum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


# ── Complaint status enum ────────────────────────────────────────────────────────
class ComplaintStatus(str, enum.Enum):
    SUBMITTED    = "submitted"
    UNDER_REVIEW = "under_review"
    IN_PROGRESS           = "in_progress"
    PENDING_VERIFICATION  = "pending_verification"
    RESOLVED              = "resolved"
    REJECTED              = "rejected"


# ── ORM Model ────────────────────────────────────────────────────────────────────
class Complaint(Base):
    __tablename__ = "complaints"

    # Primary key
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True,
    )

    # ── Foreign keys ─────────────────────────────────────────────────────────
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    category_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("categories.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    location_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("locations.id", ondelete="CASCADE"),
        nullable=False,
    )

    # ── Content ──────────────────────────────────────────────────────────────
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)

    # ── Status ───────────────────────────────────────────────────────────────
    status: Mapped[ComplaintStatus] = mapped_column(
        SAEnum(ComplaintStatus, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=ComplaintStatus.SUBMITTED,
        index=True,
    )

    # ── Routing fields (auto-populated by GeoSpatial Routing Engine) ─────────
    ward_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("wards.id", ondelete="SET NULL"),
        nullable=True, default=None, index=True,
        comment="Auto-detected ward from GPS coordinates",
    )
    jurisdiction_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("jurisdictions.id", ondelete="SET NULL"),
        nullable=True, default=None, index=True,
        comment="Jurisdiction derived from ward",
    )
    zone_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("zones.id", ondelete="SET NULL"),
        nullable=True, default=None, index=True,
        comment="Zone resolved from ward (auto-populated by routing engine)",
    )
    department_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("departments.id", ondelete="SET NULL"),
        nullable=True, default=None, index=True,
        comment="Department mapped from complaint category",
    )
    assigned_officer_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True, default=None, index=True,
        comment="Auto-assigned officer for this complaint",
    )

    # ── AI-populated fields (nullable until ML pipeline runs) ────────────────
    severity_score: Mapped[float | None] = mapped_column(
        Float, nullable=True, default=None,
        comment="0.0–1.0 severity from AI prioritisation model",
    )
    ai_category: Mapped[str | None] = mapped_column(
        String(100), nullable=True, default=None,
        comment="Category predicted by BERT classifier",
    )
    duplicate_group_id: Mapped[str | None] = mapped_column(
        String(36), nullable=True, default=None, index=True,
        comment="Cluster ID from Sentence-BERT duplicate detection",
    )
    matched_complaint_id: Mapped[str | None] = mapped_column(
        String(36), nullable=True, default=None, index=True,
        comment="ID of the original complaint this is a duplicate of",
    )
    similarity_score: Mapped[float | None] = mapped_column(
        Float, nullable=True, default=None,
        comment="Cosine similarity score vs matched_complaint (0.0-1.0)",
    )

    # ── Timestamps ───────────────────────────────────────────────────────────
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # ── Escalation ───────────────────────────────────────────────────────────
    escalation_level: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0",
        comment="0=normal, 1=escalated to zonal officer, 2=escalated to admin",
    )
    escalated_at: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None,
        comment="Timestamp of most recent auto-escalation",
    )
    sla_deadline: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None,
        comment="Level-1 SLA deadline — set when complaint is assigned",
    )

    # ── Resolution (officer marks complaint resolved) ───────────────────────────
    resolution_note: Mapped[str | None] = mapped_column(
        Text, nullable=True, default=None,
        comment="Officer's note when marking pending_verification",
    )
    resolution_photo_url: Mapped[str | None] = mapped_column(
        String(500), nullable=True, default=None,
        comment="Cloudinary secure_url of the after/resolution photo",
    )
    resolution_photo_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, default=None,
        comment="Cloudinary public_id of the resolution photo",
    )
    auto_close_at: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None,
        comment="Auto-close deadline (pending_verification + 5 days)",
    )

    # ── Citizen verdict after resolution ─────────────────────────────────────────
    citizen_verdict: Mapped[str | None] = mapped_column(
        String(20), nullable=True, default=None,
        comment="accepted | rejected | auto_accepted",
    )
    citizen_verdict_at: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None,
    )

    # ── Relationships ────────────────────────────────────────────────────────
    user     = relationship("User",     foreign_keys=[user_id], backref="complaints",  lazy="selectin")
    category = relationship("Category", back_populates="complaints", lazy="selectin")
    location = relationship("Location", back_populates="complaints", lazy="selectin")
    images   = relationship(
        "ComplaintImage",
        back_populates="complaint",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
    status_history = relationship(
        "ComplaintStatusHistory",
        back_populates="complaint",
        lazy="selectin",
        cascade="all, delete-orphan",
        order_by="ComplaintStatusHistory.updated_at.desc()",
    )

    # Routing relationships
    ward              = relationship("Ward",         lazy="selectin", foreign_keys=[ward_id])
    jurisdiction_rel  = relationship("Jurisdiction",  lazy="selectin", foreign_keys=[jurisdiction_id])
    zone_rel          = relationship("Zone",          lazy="selectin", foreign_keys=[zone_id])
    department        = relationship("Department",    lazy="selectin", foreign_keys=[department_id])
    assigned_officer  = relationship("User",          lazy="selectin", foreign_keys=[assigned_officer_id])

    # Officer operations
    progress_updates = relationship(
        "ComplaintProgressUpdate",
        back_populates="complaint",
        lazy="selectin",
        cascade="all, delete-orphan",
        order_by="ComplaintProgressUpdate.created_at.asc()",
    )
    resolution_images = relationship(
        "ComplaintResolutionImage",
        back_populates="complaint",
        lazy="selectin",
        cascade="all, delete-orphan",
        order_by="ComplaintResolutionImage.uploaded_at.asc()",
    )

    # Embedding (1:1 — created after complaint is saved)
    embedding_record = relationship(
        "ComplaintEmbedding",
        back_populates="complaint",
        uselist=False,
        lazy="select",              # load only when explicitly accessed
        cascade="all, delete-orphan",
    )

    # Escalations (1:many — each admin escalation is a new row)
    escalations = relationship(
        "ComplaintEscalation",
        foreign_keys="ComplaintEscalation.complaint_id",
        lazy="selectin",
        cascade="all, delete-orphan",
        order_by="ComplaintEscalation.created_at.asc()",
    )

    # Citizen feedback (1:1 after resolution)
    feedback = relationship(
        "ComplaintFeedback",
        back_populates="complaint",
        uselist=False,
        lazy="selectin",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return (
            f"<Complaint id={self.id!r} title={self.title!r} "
            f"status={self.status} ward={self.ward_id} dept={self.department_id}>"
        )
