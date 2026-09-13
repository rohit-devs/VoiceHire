"""
Agora token + channel routes. Works with real Agora credentials OR demo tokens.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.auth import require_clerk_jwt

router = APIRouter(tags=["Agora"])


class TokenRequest(BaseModel):
    channel_name: str
    uid: int
    role: str = "publisher"  # publisher | subscriber


class TokenResponse(BaseModel):
    token: str
    channel_name: str
    uid: int
    app_id: str
    expires_in_seconds: int


@router.post("/token", response_model=TokenResponse)
async def create_token(req: TokenRequest, user=Depends(require_clerk_jwt)):
    # Validate inputs
    if req.uid <= 0:
        raise HTTPException(status_code=400, detail="uid must be positive")
    if req.role not in ("publisher", "subscriber"):
        raise HTTPException(status_code=400, detail="role must be publisher or subscriber")

    # ── Real Agora token ──
    if settings.agora_enabled:
        try:
            from app.agora.tokens import generate_agora_token
            token = generate_agora_token(req.channel_name, req.uid, req.role)
            return TokenResponse(
                token=token,
                channel_name=req.channel_name,
                uid=req.uid,
                app_id=settings.AGORA_APP_ID,
                expires_in_seconds=settings.AGORA_TOKEN_EXPIRATION,
            )
        except Exception as exc:
            # Don't crash — fall through to demo token
            print(f"[Agora] Real token failed ({exc}), using demo token")

    # ── Demo token (frontend can still join a dummy channel for UI testing) ──
    import secrets
    demo_token = f"demo-{secrets.token_urlsafe(32)}"
    return TokenResponse(
        token=demo_token,
        channel_name=req.channel_name,
        uid=req.uid,
        app_id=settings.AGORA_APP_ID or "demo-app-id",
        expires_in_seconds=3600,
    )


from app.auth import require_clerk_jwt, get_current_user as _user_guard


@router.post("/channel/join")
async def channel_join(data: dict, user: dict = Depends(_user_guard)):
    return {"status": "joined", "channel": data.get("channel_name"), "mode": "demo" if not settings.agora_enabled else "live"}


@router.post("/channel/leave")
async def channel_leave(data: dict, user: dict = Depends(_user_guard)):
    return {"status": "left", "channel": data.get("channel_name")}
