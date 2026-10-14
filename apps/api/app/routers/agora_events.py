"""
Agora Event Handlers
Handles voice activity detection, channel events, and other Agora callbacks.
"""

import logging
import time
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.auth import get_current_user
from app.interview.orchestrator import InterviewOrchestrator
from app.models import AgoraEventLog, InterviewSession

logger = logging.getLogger(__name__)
router = APIRouter()


class AgoraEventRequest(BaseModel):
    """Model for Agora event received from SDK"""
    event_type: str  # "vad_start", "vad_end", "user_joined", "user_left", etc.
    channel_name: str
    uid: int
    event_data: dict = {}


@router.post("/events/vad")
async def handle_vad_event(
    request: AgoraEventRequest,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """
    Handle Voice Activity Detection (VAD) events from Agora.
    
    Used for detecting candidate interruptions:
    - When candidate speaks while AI is speaking → interruption detected
    - Orchestrator handles the interruption (stops TTS, logs event)
    - Returns immediately so Agora agent can respond
    
    Event types:
    - 'vad_start': Candidate began speaking
    - 'vad_end': Candidate stopped speaking
    - 'user_joined': User joined channel
    - 'user_left': User left channel
    
    Returns:
    - `status`: "acknowledged" to confirm receipt
    - `action_taken`: Description of what happened (e.g., "interruption handled")
    """
    try:
        logger.info(
            f"🎙️  VAD Event - Type: {request.event_type}, Channel: {request.channel_name}, "
            f"UID: {request.uid}"
        )

        # Look up session by agora channel
        session = await db.scalar(
            select(InterviewSession).where(
                InterviewSession.agora_channel == request.channel_name
            )
        )
        session_id = session.id if session else None

        # Verify session ownership
        if session and session.user_id != user["id"]:
            raise HTTPException(status_code=403, detail="Access denied to this session")

        # Record VAD event in database for analytics
        db.add(
            AgoraEventLog(
                session_id=session_id,
                event_type=request.event_type,
                event_data={"channel_name": request.channel_name, **request.event_data},
                user_uid=request.uid,
                timestamp_ms=int(time.time() * 1000),
            )
        )
        await db.commit()
        
        # Handle interruption detection
        action_taken = "logged"
        if request.event_type == "vad_start":
            # Candidate started speaking - this may interrupt AI TTS
            logger.info(f"⚠️  Candidate voice activity detected on {request.channel_name}")
            
            if session:
                from app.routers.interviews import orchestrators
                existing = orchestrators.get(str(session.id))
                if existing:
                    await existing.handle_interruption()
                    action_taken = "interruption_handled"
                else:
                    await InterviewOrchestrator(str(session.id)).handle_interruption()
                    action_taken = "interruption_handled_no_orchestrator"
            else:
                action_taken = "interruption_session_not_found"
        
        return {
            "status": "acknowledged",
            "event_type": request.event_type,
            "channel_name": request.channel_name,
            "action_taken": action_taken
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to handle VAD event: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to process VAD event")


@router.post("/events/channel")
async def handle_channel_event(
    request: AgoraEventRequest,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """
    Handle channel events (user joined, user left, etc.).
    
    Event types:
    - 'user_joined': A user (candidate or AI agent) joined the channel
    - 'user_left': A user left the channel
    - 'channel_created': Channel was created
    - 'channel_destroyed': Channel was destroyed
    """
    try:
        logger.info(
            f"📻 Channel Event - Type: {request.event_type}, Channel: {request.channel_name}, "
            f"UID: {request.uid}"
        )

        # Look up session by channel name for ownership verification
        session = await db.scalar(
            select(InterviewSession).where(
                InterviewSession.agora_channel == request.channel_name
            )
        )

        if session and session.user_id != user["id"]:
            raise HTTPException(status_code=403, detail="Access denied to this session")

        # Determine session_id (may be None for pre-session channel events)
        session_id = session.id if session else None

        # Record event
        db.add(
            AgoraEventLog(
                session_id=session_id,
                event_type=request.event_type,
                event_data={"channel_name": request.channel_name, **request.event_data},
                user_uid=request.uid,
                timestamp_ms=int(time.time() * 1000),
            )
        )
        await db.commit()
        
        return {
            "status": "acknowledged",
            "event_type": request.event_type,
            "channel_name": request.channel_name
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to handle channel event: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to process channel event")
