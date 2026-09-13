"""
WebSocket Connection Management
Handles real-time transcript streaming and live metrics updates
"""

import asyncio
import json
import logging
from typing import Set, Dict
from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Manages WebSocket connections for a given interview session.
    Broadcasts transcript updates and real-time metrics to connected clients.
    """
    
    def __init__(self):
        # session_id -> Set[WebSocket]
        self.active_connections: Dict[str, Set[WebSocket]] = {}
    
    async def connect(self, session_id: str, websocket: WebSocket):
        """
        Accept a WebSocket connection for a session.
        """
        await websocket.accept()
        
        if session_id not in self.active_connections:
            self.active_connections[session_id] = set()
        
        self.active_connections[session_id].add(websocket)
        logger.info(f"✅ WebSocket connected for session {session_id} ({len(self.active_connections[session_id])} total)")
    
    def disconnect(self, session_id: str, websocket: WebSocket):
        """
        Remove a WebSocket connection.
        """
        if session_id in self.active_connections:
            self.active_connections[session_id].discard(websocket)
            logger.info(f"🔌 WebSocket disconnected for session {session_id} ({len(self.active_connections[session_id])} remaining)")
            
            # Clean up empty sessions
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]
    
    async def broadcast_transcript(self, session_id: str, message: dict):
        """
        Broadcast a transcript message to all connected clients for a session.
        
        message format:
        {
            "type": "transcript",
            "speaker": "candidate" | "interviewer",
            "text": "...",
            "timestamp_ms": 1234567890,
            "metrics": {
                "wpm": 120,
                "pause_ms": 500,
                "filler_words": ["um", "uh"]
            }
        }
        """
        if session_id not in self.active_connections:
            return
        
        disconnected = set()
        for websocket in self.active_connections[session_id]:
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting to websocket: {e}")
                disconnected.add(websocket)
        
        # Clean up disconnected sockets
        for ws in disconnected:
            self.disconnect(session_id, ws)
    
    async def broadcast_metrics(self, session_id: str, metrics: dict = None, **kwargs):
        """
        Broadcast real-time metrics update.
        
        Can be called as:
        - broadcast_metrics(session_id, metrics={...})
        - broadcast_metrics(session_id, clarity_score=82, ...)
        
        metrics/kwargs format:
        {
            "clarity_score": 82,
            "confidence_score": 79,
            "relevance_score": 91,
            "filler_words_count": 3,
            "avg_wpm": 125,
            "timestamp_ms": 1234567890
        }
        """
        # Support both dict and kwargs
        data = metrics or kwargs or {}
        await self.broadcast_transcript(session_id, {"type": "metrics", **data})
    
    async def broadcast_state_change(self, session_id: str, state: str, metadata: dict = None):
        """
        Broadcast interview state change.
        
        state: "intro" | "warmup" | "technical" | "behavioral" | "pressure" | "closing"
        """
        message = {
            "type": "state_change",
            "state": state,
            "metadata": metadata or {}
        }
        await self.broadcast_transcript(session_id, message)
    
    async def broadcast_ai_thinking(self, session_id: str, thinking_text: str = ""):
        """
        Broadcast that AI is thinking (for UI feedback).
        """
        message = {
            "type": "ai_thinking",
            "text": thinking_text or "AI is thinking..."
        }
        await self.broadcast_transcript(session_id, message)
    
    async def broadcast_evaluation_complete(self, session_id: str, report: dict):
        """
        Broadcast evaluation report completion.
        """
        message = {
            "type": "evaluation_complete",
            "report": report
        }
        await self.broadcast_transcript(session_id, message)
    
    def get_active_sessions(self) -> list:
        """Get list of active session IDs."""
        return list(self.active_connections.keys())
    
    def get_connection_count(self, session_id: str) -> int:
        """Get number of connected clients for a session."""
        return len(self.active_connections.get(session_id, set()))


# Global connection manager instance
connection_manager = ConnectionManager()
