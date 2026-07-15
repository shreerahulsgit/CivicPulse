"""
models/notification_preference.py — Per-User Notification Preferences

Table: notification_preferences

Stores per-user opt-in/opt-out settings for notification channels.
One row per user (1:1 relationship, lazily created on first preference update).

Defaults (if no row exists): email_enabled=True, in_app_enabled=True
"""

from sqlalchemy import Boolean, ForeignKey, String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base


class NotificationPreference(Base):
    __tablename__ = "notification_preferences"

    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,       # user_id IS the PK — one row per user
    )
    email_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True,
        comment="Whether to send email notifications",
    )
    in_app_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True,
        comment="Whether to create in-app notifications",
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # ── Relationship ──────────────────────────────────────────────────────────
    user = relationship("User", foreign_keys=[user_id], lazy="selectin")

    def __repr__(self) -> str:
        return (
            f"<NotificationPreference user={self.user_id!r} "
            f"email={self.email_enabled} in_app={self.in_app_enabled}>"
        )
