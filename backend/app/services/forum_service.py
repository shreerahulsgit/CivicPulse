"""
services/forum_service.py — Zone Community Forum Business Logic

Responsibilities:
  - Resolve which zone a user belongs to
  - Fetch paginated message history
  - Post, soft-delete, and pin messages
  - Build serialisable message payloads for WebSocket broadcast
"""

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# ── Zone resolution ────────────────────────────────────────────────────────────

def get_zone_id_for_user(user, db: Session) -> int | None:
    """
    Return the zone_id the user belongs to.
      - Zonal officer: uses user.zone_id directly
      - Ward officer / citizen: looks up the zone via their ward
      - Admin: no zone (returns None — admin can pass zone_id explicitly)
    """
    from app.models.user import UserRole
    from app.models.ward import Ward

    if user.role == UserRole.ZONAL_OFFICER and user.zone_id:
        return user.zone_id

    # Ward officers and citizens — derive from ward
    ward_id = getattr(user, "ward_id", None)
    if ward_id:
        ward = db.get(Ward, ward_id)
        if ward and ward.zone_id:
            return ward.zone_id

    return None


# ── Message serialisation ─────────────────────────────────────────────────────

def _serialize(msg) -> dict:
    """Convert a ZoneForumMessage ORM object to a JSON-safe dict."""
    author = msg.author
    return {
        "id":            msg.id,
        "zone_id":       msg.zone_id,
        "user_id":       msg.user_id,
        "user_name":     author.full_name if author else "Unknown",
        "user_role":     author.role.value if author else "citizen",
        "avatar_url":    author.avatar_url if author else None,
        "content":       msg.content,
        "complaint_ref": msg.complaint_ref,
        "is_pinned":     msg.is_pinned,
        "created_at":    msg.created_at.isoformat() if msg.created_at else None,
    }


# ── Message history ────────────────────────────────────────────────────────────

def get_recent_messages(zone_id: int, db: Session, limit: int = 50, before_id: str | None = None) -> list[dict]:
    """Return the last `limit` non-deleted messages for a zone, newest-first then reversed."""
    from app.models.zone_forum import ZoneForumMessage

    q = (
        db.query(ZoneForumMessage)
        .filter(ZoneForumMessage.zone_id == zone_id, ZoneForumMessage.is_deleted == False)
    )

    if before_id:
        # Cursor-based pagination: get messages older than the given ID
        anchor = db.get(ZoneForumMessage, before_id)
        if anchor:
            q = q.filter(ZoneForumMessage.created_at < anchor.created_at)

    messages = q.order_by(ZoneForumMessage.created_at.desc()).limit(limit).all()
    messages.reverse()   # chronological order
    return [_serialize(m) for m in messages]


def get_pinned_messages(zone_id: int, db: Session) -> list[dict]:
    from app.models.zone_forum import ZoneForumMessage
    msgs = (
        db.query(ZoneForumMessage)
        .filter(
            ZoneForumMessage.zone_id == zone_id,
            ZoneForumMessage.is_pinned == True,
            ZoneForumMessage.is_deleted == False,
        )
        .order_by(ZoneForumMessage.created_at.desc())
        .limit(5)
        .all()
    )
    return [_serialize(m) for m in msgs]


# ── Post message ──────────────────────────────────────────────────────────────

def post_message(
    zone_id: int,
    user,
    content: str,
    db: Session,
    complaint_ref: str | None = None,
) -> dict:
    """Create and persist a new forum message. Returns serialised payload."""
    from app.models.zone_forum import ZoneForumMessage

    content = content.strip()
    if not content:
        raise ValueError("Message content cannot be empty.")
    if len(content) > 1000:
        raise ValueError("Message too long (max 1000 characters).")

    msg = ZoneForumMessage(
        id            = str(uuid.uuid4()),
        zone_id       = zone_id,
        user_id       = user.id,
        content       = content,
        complaint_ref = complaint_ref,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    logger.info("Forum msg zone=%d by=%s", zone_id, user.id)
    return _serialize(msg)


# ── Delete message ────────────────────────────────────────────────────────────

def delete_message(msg_id: str, requesting_user, db: Session) -> bool:
    """
    Soft-delete a message.
    Users can delete their own; officers can delete any in their zone.
    Returns True if deleted, False if not found / not allowed.
    """
    from app.models.zone_forum import ZoneForumMessage
    from app.models.user import UserRole

    msg = db.get(ZoneForumMessage, msg_id)
    if not msg or msg.is_deleted:
        return False

    is_own     = msg.user_id == requesting_user.id
    is_officer = requesting_user.role in (
        UserRole.WARD_OFFICER, UserRole.ZONAL_OFFICER, UserRole.ADMIN
    )

    if not (is_own or is_officer):
        return False

    msg.is_deleted = True
    db.commit()
    return True


# ── Pin / unpin message ───────────────────────────────────────────────────────

def toggle_pin(msg_id: str, officer, db: Session) -> dict | None:
    """
    Toggle pin status of a message (officers only).
    Enforces max 5 pinned messages per zone.
    Returns updated serialised message or None on failure.
    """
    from app.models.zone_forum import ZoneForumMessage
    from app.models.user import UserRole

    if officer.role not in (UserRole.WARD_OFFICER, UserRole.ZONAL_OFFICER, UserRole.ADMIN):
        raise PermissionError("Only officers can pin messages.")

    msg = db.get(ZoneForumMessage, msg_id)
    if not msg or msg.is_deleted:
        return None

    if not msg.is_pinned:
        # Check pin limit
        pinned_count = (
            db.query(ZoneForumMessage)
            .filter(
                ZoneForumMessage.zone_id  == msg.zone_id,
                ZoneForumMessage.is_pinned == True,
                ZoneForumMessage.is_deleted == False,
            )
            .count()
        )
        if pinned_count >= 5:
            raise ValueError("Maximum 5 messages can be pinned per zone.")

    msg.is_pinned = not msg.is_pinned
    db.commit()
    db.refresh(msg)
    return _serialize(msg)
