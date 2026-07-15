"""
websocket/connection_manager.py — Zone Forum WebSocket Hub

Manages all active WebSocket connections per zone.
Thread-safe broadcast via asyncio.

Usage:
    manager = ZoneConnectionManager()
    await manager.connect(websocket, zone_id)
    await manager.broadcast(zone_id, payload_dict)
    manager.disconnect(websocket, zone_id)
"""

import asyncio
import json
import logging
from collections import defaultdict
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ZoneConnectionManager:
    """Tracks WebSocket connections keyed by zone_id."""

    def __init__(self) -> None:
        # zone_id (int) → set of active WebSocket connections
        self._connections: dict[int, set[WebSocket]] = defaultdict(set)

    async def connect(self, websocket: WebSocket, zone_id: int) -> None:
        await websocket.accept()
        self._connections[zone_id].add(websocket)
        logger.debug("WS connect zone=%d total=%d", zone_id, len(self._connections[zone_id]))

    def disconnect(self, websocket: WebSocket, zone_id: int) -> None:
        self._connections[zone_id].discard(websocket)
        logger.debug("WS disconnect zone=%d total=%d", zone_id, len(self._connections[zone_id]))

    async def broadcast(self, zone_id: int, payload: dict) -> None:
        """Send JSON payload to all connected clients in the zone."""
        dead: list[WebSocket] = []
        text = json.dumps(payload, default=str)
        for ws in list(self._connections.get(zone_id, [])):
            try:
                await ws.send_text(text)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws, zone_id)

    def active_count(self, zone_id: int) -> int:
        return len(self._connections.get(zone_id, []))


# Singleton shared across the app
forum_manager = ZoneConnectionManager()
