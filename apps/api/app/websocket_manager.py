"""Session-scoped WebSocket fanout for interview events."""

from typing import Dict, Set

from fastapi import WebSocket, WebSocketDisconnect

class ConnectionManager:
    """Keeps each authenticated socket in exactly one interview-session room."""

    def __init__(self) -> None:
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, session_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.setdefault(session_id, set()).add(websocket)

    def disconnect(self, session_id: str, websocket: WebSocket) -> None:
        connections = self.active_connections.get(session_id)
        if connections is None:
            return
        connections.discard(websocket)
        if not connections:
            self.active_connections.pop(session_id, None)

    async def broadcast_transcript(self, session_id: str, message: dict) -> None:
        disconnected: set[WebSocket] = set()
        for websocket in tuple(self.active_connections.get(session_id, set())):
            try:
                await websocket.send_json(message)
            except (WebSocketDisconnect, RuntimeError, OSError):
                disconnected.add(websocket)
        for websocket in disconnected:
            self.disconnect(session_id, websocket)

    async def broadcast_state_change(
        self, session_id: str, state: str, metadata: dict | None = None
    ) -> None:
        await self.broadcast_transcript(
            session_id,
            {"type": "state_change", "state": state, "metadata": metadata or {}},
        )

    def get_active_sessions(self) -> list[str]:
        return list(self.active_connections)

    def get_connection_count(self, session_id: str) -> int:
        return len(self.active_connections.get(session_id, set()))


connection_manager = ConnectionManager()
