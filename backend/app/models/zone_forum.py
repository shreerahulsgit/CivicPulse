"""
models/zone_forum.py — Zone Community Forum Message

Table: zone_forum_messages
One forum per zone. All users in the zone (citizens, officers) participate.
"""

import uuid
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base


class ZoneForumMessage(Base):
    __tablename__ = "zone_forum_messages"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    zone_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("zones.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # Optional: reference a complaint by its short UUID
    complaint_ref: Mapped[str | None] = mapped_column(
        String(36), nullable=True, default=None,
        comment="Linked complaint ID (optional)",
    )

    is_pinned:  Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # ── Relationships ──────────────────────────────────────────────────────────
    author = relationship("User", foreign_keys=[user_id], lazy="selectin")
    zone   = relationship("Zone", foreign_keys=[zone_id],  lazy="noload")

    def __repr__(self) -> str:
        return f"<ForumMsg id={self.id!r} zone={self.zone_id} by={self.user_id!r}>"
