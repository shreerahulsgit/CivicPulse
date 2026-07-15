"""
api/notifications.py — Notification & Preference Endpoints

All endpoints require JWT authentication.

Notification endpoints:
  GET   /notifications                    — Paginated list (newest first)
  GET   /notifications/unread-count       — Quick unread badge count
  PATCH /notifications/{id}/read          — Mark single notification read
  PATCH /notifications/read-all           — Mark all notifications read

Preference endpoints:
  GET   /notification-preferences         — Get current preferences
  PATCH /notification-preferences         — Update preferences (partial)
"""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.schemas.notification import (
    NotificationListResponse,
    NotificationPreferenceResponse,
    NotificationPreferenceUpdate,
    NotificationResponse,
    UnreadCountResponse,
)
from app.services.notification_service import (
    get_notifications,
    get_preference,
    get_unread_count,
    mark_all_read,
    mark_notification_read,
    update_preference,
)

logger = logging.getLogger(__name__)

# ── Separate routers — different URL prefixes ────────────────────────────────
notif_router = APIRouter(prefix="/notifications",          tags=["Notifications"])
pref_router  = APIRouter(prefix="/notification-preferences", tags=["Notifications"])


# ═══════════════════════════════════════════════════════════════════════════════
# Notification CRUD
# ═══════════════════════════════════════════════════════════════════════════════

@notif_router.get(
    "",
    response_model=NotificationListResponse,
    summary="List my notifications (newest first)",
)
def list_notifications(
    skip:        int  = Query(default=0,     ge=0,                  description="Pagination offset"),
    limit:       int  = Query(default=20,    ge=1,    le=100,       description="Page size"),
    unread_only: bool = Query(default=False,                        description="Only unread notifications"),
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
) -> NotificationListResponse:
    return get_notifications(
        db          = db,
        user_id     = current_user.id,
        skip        = skip,
        limit       = limit,
        unread_only = unread_only,
    )


@notif_router.get(
    "/unread-count",
    response_model=UnreadCountResponse,
    summary="Get unread notification count",
)
def unread_count(
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
) -> UnreadCountResponse:
    return get_unread_count(db, current_user.id)


@notif_router.patch(
    "/read-all",
    status_code=status.HTTP_200_OK,
    summary="Mark all notifications as read",
)
def read_all(
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
) -> dict:
    count = mark_all_read(db, current_user.id)
    return {"marked_read": count, "message": f"{count} notification(s) marked as read."}


@notif_router.patch(
    "/{notification_id}/read",
    response_model=NotificationResponse,
    status_code=status.HTTP_200_OK,
    summary="Mark a single notification as read",
)
def read_one(
    notification_id: str,
    current_user:    User    = Depends(get_current_user),
    db:              Session = Depends(get_db),
) -> NotificationResponse:
    try:
        return mark_notification_read(db, notification_id, current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


# ═══════════════════════════════════════════════════════════════════════════════
# Preferences
# ═══════════════════════════════════════════════════════════════════════════════

@pref_router.get(
    "",
    response_model=NotificationPreferenceResponse,
    summary="Get my notification preferences",
)
def get_prefs(
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
) -> NotificationPreferenceResponse:
    return get_preference(db, current_user.id)


@pref_router.patch(
    "",
    response_model=NotificationPreferenceResponse,
    status_code=status.HTTP_200_OK,
    summary="Update notification preferences",
    description="Partial update — only fields provided will be changed.",
)
def update_prefs(
    payload:      NotificationPreferenceUpdate,
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
) -> NotificationPreferenceResponse:
    return update_preference(db, current_user.id, payload)
