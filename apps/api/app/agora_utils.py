"""
Agora RTC Token Generation and Utilities
Handles secure token generation for real-time voice channels
"""

import logging
import time
from agora_token_builder import RtcTokenBuilder
from app.config import settings

logger = logging.getLogger(__name__)


class AgoraTokenGenerator:
    """
    Generates Agora RTC tokens for secure channel access.
    Tokens expire after configured duration (default 1 hour).
    """
    
    @staticmethod
    def generate_token(
        channel_name: str,
        uid: int,
        role: str = "publisher",
        expire_seconds: int = 3600
    ) -> str:
        """
        Generate an Agora RTC token for channel access.
        
        Args:
            channel_name: Agora channel name (e.g., "vh-session-123")
            uid: User ID (numeric, unique within channel)
            role: "publisher" or "subscriber"
            expire_seconds: Token expiration time (default 3600 = 1 hour)
        
        Returns:
            RTC token string
            
        Raises:
            ValueError: If Agora credentials are missing
        """
        if not settings.AGORA_APP_ID or not settings.AGORA_APP_CERTIFICATE:
            raise ValueError("Agora credentials not configured")
        
        try:
            # The installed builder uses numeric Agora roles: publisher=1, subscriber=2.
            token_role = 1 if role == "publisher" else 2
            
            # Generate token
            token = RtcTokenBuilder.buildTokenWithUid(
                settings.AGORA_APP_ID,
                settings.AGORA_APP_CERTIFICATE,
                channel_name,
                uid,
                token_role,
                expire_seconds,
            )
            
            logger.info(
                f"✅ Generated Agora token for channel={channel_name}, uid={uid}, "
                f"role={role}, expires_in={expire_seconds}s"
            )
            return token
            
        except Exception as e:
            logger.error(f"❌ Failed to generate Agora token: {e}")
            raise


class AgoraChannelConfig:
    """
    Agora channel configuration for interview sessions.
    Ensures consistent channel naming and setup across sessions.
    """
    
    CHANNEL_PREFIX = "vh"  # VoiceHire prefix
    CANDIDATE_UID = 1      # Candidate always uses UID 1
    AI_AGENT_UID = 2       # AI agent always uses UID 2
    
    @staticmethod
    def generate_channel_name(session_id: str) -> str:
        """
        Generate Agora channel name from session ID.
        Format: vh-{session_id}
        """
        return f"{AgoraChannelConfig.CHANNEL_PREFIX}-{session_id}"
    
    @staticmethod
    def is_valid_channel_name(channel_name: str) -> bool:
        """
        Validate Agora channel name format.
        Must start with vh- and be alphanumeric with hyphens.
        """
        if not channel_name.startswith(f"{AgoraChannelConfig.CHANNEL_PREFIX}-"):
            return False
        
        # Agora channel name restrictions:
        # - 64 characters max
        # - Alphanumeric, hyphens, underscores only
        if len(channel_name) > 64:
            return False
        
        allowed_chars = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_")
        return all(c in allowed_chars for c in channel_name)


class AgoraEventHandler:
    """
    Handles Agora RTC SDK events.
    Bridges real-time voice events to backend state management.
    """
    
    # Event types
    USER_JOINED = "user_joined"
    USER_LEFT = "user_left"
    AUDIO_MUTED = "audio_muted"
    AUDIO_UNMUTED = "audio_unmuted"
    CONNECTION_STATE_CHANGED = "connection_state_changed"
    NETWORK_QUALITY = "network_quality"
    
    @staticmethod
    def parse_event(event_type: str, event_data: dict) -> dict:
        """
        Parse raw Agora event into standardized format.
        
        Returns:
            {
                "type": event_type,
                "timestamp": unix_timestamp_ms,
                "uid": user_id,
                "channel": channel_name,
                "data": event_specific_data
            }
        """
        return {
            "type": event_type,
            "timestamp": int(time.time() * 1000),
            "uid": event_data.get("uid"),
            "channel": event_data.get("channel"),
            "data": event_data
        }


class AgoraSessionState:
    """
    Tracks Agora session state (who's connected, audio status, etc.)
    """
    
    def __init__(self, channel_name: str):
        self.channel_name = channel_name
        self.connected_users = {}  # {uid: {"name": str, "audio_enabled": bool, "joined_at": timestamp}}
        self.created_at = time.time()
    
    def add_user(self, uid: int, name: str = None):
        """Record user joining the channel"""
        self.connected_users[uid] = {
            "uid": uid,
            "name": name or f"User-{uid}",
            "audio_enabled": True,
            "joined_at": time.time()
        }
    
    def remove_user(self, uid: int):
        """Record user leaving the channel"""
        if uid in self.connected_users:
            del self.connected_users[uid]
    
    def set_audio_enabled(self, uid: int, enabled: bool):
        """Update user's audio mute state"""
        if uid in self.connected_users:
            self.connected_users[uid]["audio_enabled"] = enabled
    
    def get_users(self) -> list:
        """Get all connected users"""
        return list(self.connected_users.values())
    
    def is_active(self) -> bool:
        """Check if channel has active participants"""
        return len(self.connected_users) > 0
