"""
api/forum.py — Zone Community Forum Endpoints

REST:
  GET  /forum/my/messages              — history for calling user's zone
  GET  /forum/{zone_id}/messages       — history (admin / explicit zone)
  POST /forum/{zone_id}/messages       — post message
  DELETE /forum/{zone_id}/messages/{id}— delete message
  POST /forum/{zone_id}/messages/{id}/pin — toggle pin (officers)
  GET  /forum/{zone_id}/pinned         — pinned messages
  GET  /forum/my/zone                  — resolve user's zone info

WebSocket:
  WS   /ws/forum/{zone_id}             — real-time channel (token in query param)
"""

import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.user import User, UserRole
from app.services.forum_service import (
    delete_message,
    get_pinned_messages,
    get_recent_messages,
    get_zone_id_for_user,
    post_message,
    toggle_pin,
)
from app.websocket.connection_manager import forum_manager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/forum", tags=["Forum"])


# ── Helper ─────────────────────────────────────────────────────────────────────

def _resolve_zone(user: User, db: Session) -> int:
    zone_id = get_zone_id_for_user(user, db)
    if not zone_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is not linked to a zone yet. Submit a complaint first to join your zone's forum.",
        )
    return zone_id


def _ensure_zone_access(user: User, zone_id: int, db: Session) -> None:
    """Verify the user belongs to this zone (admin and citizens bypass — citizens
    choose their zone manually so we trust the zone_id they present)."""
    if user.role == UserRole.ADMIN:
        return
    # Citizens joined via zone picker — allow any zone
    if user.role == UserRole.CITIZEN:
        return
    # Officers must match their assigned zone
    user_zone = get_zone_id_for_user(user, db)
    if user_zone != zone_id:
        raise HTTPException(status_code=403, detail="You do not belong to this zone.")


# ── Schemas ────────────────────────────────────────────────────────────────────

class PostMessageRequest(BaseModel):
    content:       str
    complaint_ref: str | None = None


# ── REST Endpoints ─────────────────────────────────────────────────────────────

@router.get("/zones", summary="List all available zones for manual forum join")
def list_zones(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.models.zone import Zone
    zones = db.query(Zone).order_by(Zone.zone_number).all()
    return [
        {"zone_id": z.id, "zone_name": z.zone_name, "zone_number": z.zone_number}
        for z in zones
    ]


@router.get("/my/zone", summary="Resolve calling user's zone")
def get_my_zone(
    zone_id: int | None = Query(None, description="Explicit zone override (manual pick)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.models.zone import Zone
    from app.models.ward import Ward

    # If an explicit zone_id was passed (GPS detect or manual pick), use it directly
    if zone_id:
        zone = db.get(Zone, zone_id)
        if not zone:
            raise HTTPException(status_code=404, detail="Zone not found.")
        return {
            "zone_id":    zone.id,
            "zone_name":  zone.zone_name,
            "ward_number": None,
        }

    # Otherwise auto-resolve from user's linked ward
    resolved_zone_id = get_zone_id_for_user(current_user, db)
    if not resolved_zone_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="not_linked",
        )
    zone    = db.get(Zone, resolved_zone_id)
    ward_id = getattr(current_user, "ward_id", None)
    ward    = db.get(Ward, ward_id) if ward_id else None

    return {
        "zone_id":    resolved_zone_id,
        "zone_name":  zone.zone_name if zone else f"Zone {resolved_zone_id}",
        "ward_number": ward.ward_number if ward else None,
    }


@router.get("/my/messages", summary="Get my zone's forum history")
def get_my_zone_messages(
    limit:     int = Query(50, ge=1, le=100),
    before_id: str | None = Query(None),
    zone_id:   int | None = Query(None, description="Explicit zone_id for manual-picker users"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Use explicit zone_id if provided (manual-picker / GPS users have no ward)
    if zone_id:
        return get_recent_messages(zone_id, db, limit=limit, before_id=before_id)
    resolved = _resolve_zone(current_user, db)
    return get_recent_messages(resolved, db, limit=limit, before_id=before_id)


@router.get("/{zone_id}/messages", summary="Get zone forum history")
def get_zone_messages(
    zone_id:   int,
    limit:     int = Query(50, ge=1, le=100),
    before_id: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_zone_access(current_user, zone_id, db)
    return get_recent_messages(zone_id, db, limit=limit, before_id=before_id)


@router.get("/{zone_id}/pinned", summary="Get pinned messages")
def get_pinned(
    zone_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_zone_access(current_user, zone_id, db)
    return get_pinned_messages(zone_id, db)


@router.post("/{zone_id}/messages", summary="Post a message to zone forum")
async def post_zone_message(
    zone_id: int,
    body: PostMessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_zone_access(current_user, zone_id, db)
    try:
        msg = post_message(zone_id, current_user, body.content, db, body.complaint_ref)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Broadcast via WebSocket to all connected clients in this zone
    await forum_manager.broadcast(zone_id, {"type": "new_message", "message": msg})
    return msg


@router.delete("/{zone_id}/messages/{msg_id}", status_code=204, summary="Delete a message")
async def delete_zone_message(
    zone_id: int,
    msg_id:  str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_zone_access(current_user, zone_id, db)
    ok = delete_message(msg_id, current_user, db)
    if not ok:
        raise HTTPException(status_code=404, detail="Message not found or already deleted.")
    await forum_manager.broadcast(zone_id, {"type": "delete_message", "msg_id": msg_id})


@router.post("/{zone_id}/messages/{msg_id}/pin", summary="Toggle pin (officers)")
async def pin_zone_message(
    zone_id: int,
    msg_id:  str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_zone_access(current_user, zone_id, db)
    try:
        updated = toggle_pin(msg_id, current_user, db)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not updated:
        raise HTTPException(status_code=404, detail="Message not found.")
    await forum_manager.broadcast(zone_id, {"type": "pin_update", "message": updated})
    return updated


# ── WebSocket Endpoint ─────────────────────────────────────────────────────────

@router.websocket("/ws/{zone_id}")
async def forum_websocket(
    websocket: WebSocket,
    zone_id: int,
    token: str = Query(..., description="JWT auth token"),
):
    """
    WebSocket endpoint for real-time forum chat.
    Authenticate via ?token=<JWT> query param (standard for WS).
    """
    from app.api.deps import verify_token_string
    from app.database.session import SessionLocal

    # MUST accept before close: browser needs the HTTP->WS upgrade
    # to receive a close code, otherwise it logs a hard connection error.
    await websocket.accept()

    db = SessionLocal()
    try:
        user = verify_token_string(token, db)
    except Exception:
        await websocket.send_text(json.dumps({"type": "error", "detail": "Unauthorized"}))
        await websocket.close(code=4001, reason="Unauthorized")
        db.close()
        return

    # Zone check: officers stay in their zone; citizens can join any zone (manual pick)
    if user.role not in (UserRole.ADMIN,):
        user_zone = get_zone_id_for_user(user, db)
        if (
            user_zone is not None
            and user_zone != zone_id
            and user.role in (UserRole.WARD_OFFICER, UserRole.ZONAL_OFFICER)
        ):
            await websocket.send_text(json.dumps({"type": "error", "detail": "Not your zone"}))
            await websocket.close(code=4003, reason="Not your zone")
            db.close()
            return

    forum_manager._connections[zone_id].add(websocket)
    logger.info("Forum WS connected: zone=%d user=%s role=%s", zone_id, user.id, user.role)

    try:
        # Send history on connect
        history = get_recent_messages(zone_id, db, limit=50)
        pinned  = get_pinned_messages(zone_id, db)
        await websocket.send_text(json.dumps({
            "type":    "init",
            "history": history,
            "pinned":  pinned,
            "zone_id": zone_id,
            "active_users": forum_manager.active_count(zone_id),
        }, default=str))

        # Listen for incoming messages
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue

            msg_type = data.get("type")

            if msg_type == "message":
                content       = str(data.get("content", "")).strip()
                complaint_ref = data.get("complaint_ref")
                if not content:
                    continue
                try:
                    msg = post_message(zone_id, user, content, db, complaint_ref)
                    await forum_manager.broadcast(zone_id, {"type": "new_message", "message": msg})
                except ValueError as e:
                    await websocket.send_text(json.dumps({"type": "error", "detail": str(e)}))

            elif msg_type == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))

    except WebSocketDisconnect:
        logger.info("Forum WS disconnected: zone=%d user=%s", zone_id, user.id)
    finally:
        forum_manager.disconnect(websocket, zone_id)
        db.close()
