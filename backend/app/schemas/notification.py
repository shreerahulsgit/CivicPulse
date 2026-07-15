"""
schemas/notification.py — Notification Pydantic v2 Schemas
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.models.notification import NotificationType


# ═══════════════════════════════════════════════════════════════════════════════
# Notification
# ═══════════════════════════════════════════════════════════════════════════════

class NotificationResponse(BaseModel):
    """Response model for a single notification."""
    id:           str
    user_id:      str
    title:        str
    message:      str
    type:         NotificationType
    complaint_id: Optional[str]
    is_read:      bool
    created_at:   datetime

    model_config = {"from_attributes": True}


class NotificationListResponse(BaseModel):
    """Paginated list of notifications."""
    total:       int
    unread:      int
    page:        int
    page_size:   int
    items:       list[NotificationResponse]


class UnreadCountResponse(BaseModel):
    unread_count: int


# ═══════════════════════════════════════════════════════════════════════════════
# Preferences
# ═══════════════════════════════════════════════════════════════════════════════

class NotificationPreferenceResponse(BaseModel):
    """Response model for notification preferences."""
    user_id:        str
    email_enabled:  bool
    in_app_enabled: bool
    updated_at:     datetime

    model_config = {"from_attributes": True}


class NotificationPreferenceUpdate(BaseModel):
    """Request body for updating notification preferences."""
    email_enabled:  Optional[bool] = Field(
        default=None,
        description="Enable/disable email notifications",
    )
    in_app_enabled: Optional[bool] = Field(
        default=None,
        description="Enable/disable in-app notifications",
    )
