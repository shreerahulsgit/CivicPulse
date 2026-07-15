"""
models/notification.py — In-App Notification Model

Table: notifications

Stores per-user in-app notifications for all complaint lifecycle events.
Notifications are lightweight records — no heavy payloads, just structured messages.

Notification Types (NotificationType enum):
  complaint_created     — Citizen submitted a complaint
  complaint_assigned    — Officer was assigned
  status_changed        — Status transitioned (any transition)
  progress_update       — Officer posted a progress update
  complaint_resolved    — Complaint resolved
  duplicate_detected    — Complaint flagged as duplicate

Lifecycle:
  is_read starts as False.
  PATCH /notifications/{id}/read → is_read = True
  PATCH /notifications/read-all  → all user notifications → is_read = True

Index strategy:
  (user_id, is_read) composite index for fast unread-count queries.
  (user_id, created_at) for paginated list queries.
"""

import uuid
import enum

from sqlalchemy import (
    Boolean, DateTime, Enum as SAEnum,
    ForeignKey, Index, String, Text, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base


class NotificationType(str, enum.Enum):
    COMPLAINT_CREATED   = "complaint_created"
    COMPLAINT_ASSIGNED  = "complaint_assigned"
    STATUS_CHANGED      = "status_changed"
    PROGRESS_UPDATE     = "progress_update"
    COMPLAINT_RESOLVED  = "complaint_resolved"
    DUPLICATE_DETECTED  = "duplicate_detected"


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(
        String(200), nullable=False,
    )
    message: Mapped[str] = mapped_column(
        Text, nullable=False,
    )
    type: Mapped[NotificationType] = mapped_column(
        SAEnum(NotificationType, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        index=True,
    )
    # Optional reference to the related complaint
    complaint_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("complaints.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    is_read: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False,
    )
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    user = relationship("User", foreign_keys=[user_id], lazy="selectin")

    # ── Composite indexes ─────────────────────────────────────────────────────
    __table_args__ = (
        Index("ix_notifications_user_read",       "user_id", "is_read"),
        Index("ix_notifications_user_created_at", "user_id", "created_at"),
    )

    def __repr__(self) -> str:
        return (
            f"<Notification id={self.id!r} user={self.user_id!r} "
            f"type={self.type} read={self.is_read}>"
        )
