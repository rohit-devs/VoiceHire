"""
User Management Endpoints
"""

from typing import Literal, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.auth import get_current_user
from app.models import CandidateProfile, User

router = APIRouter()


class UserCreate(BaseModel):
    """User creation request (guest profile update)"""
    email: EmailStr
    first_name: str | None = None
    last_name: str | None = None


class UserResponse(BaseModel):
    """User response model"""
    id: str
    email: str | None
    first_name: str | None
    last_name: str | None
    target_role: str | None = None
    background: str | None = None
    default_interview_persona: str
    default_interview_difficulty: str
    
    class Config:
        from_attributes = True


@router.post("/register", response_model=UserResponse, include_in_schema=False)
async def register_user(
    user: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Compatibility alias that updates only the currently authenticated guest user."""
    row = await db.scalar(select(User).where(User.id == current_user["id"]))
    if row is None:
        raise HTTPException(status_code=404, detail="User not found")
    row.email = user.email
    row.first_name = user.first_name
    row.last_name = user.last_name
    await db.commit()
    return UserResponse(
        id=row.id,
        email=row.email,
        first_name=row.first_name,
        last_name=row.last_name,
        default_interview_persona=row.default_interview_persona,
        default_interview_difficulty=row.default_interview_difficulty,
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """
    Get current authenticated user profile.
    Requires a valid guest identity.
    """
    row = await db.scalar(select(User).where(User.id == user["id"]))
    if row is None:
        raise HTTPException(status_code=404, detail="User not found")
    profile = await db.scalar(
        select(CandidateProfile)
        .where(CandidateProfile.user_id == row.id)
        .order_by(CandidateProfile.updated_at.desc(), CandidateProfile.id.desc())
    )
    return UserResponse(
        id=row.id,
        email=row.email,
        first_name=row.first_name,
        last_name=row.last_name,
        target_role=profile.target_role if profile else None,
        background=row.background,
        default_interview_persona=row.default_interview_persona,
        default_interview_difficulty=row.default_interview_difficulty,
    )


class UserUpdate(BaseModel):
    first_name: Optional[str] = Field(default=None, max_length=100)
    last_name: Optional[str] = Field(default=None, max_length=100)
    target_role: str | None = Field(default=None, max_length=100)
    background: str | None = Field(default=None, max_length=20_000)
    default_interview_persona: Literal[
        "friendly_founder", "technical_lead", "hr_recruiter", "stress_interviewer"
    ] | None = None
    default_interview_difficulty: Literal["easy", "medium", "hard"] | None = None


@router.put("/me", response_model=UserResponse)
async def update_current_user(
    update_data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """
    Update current user profile.
    """
    row = await db.scalar(select(User).where(User.id == user["id"]))
    if row is None:
        raise HTTPException(status_code=404, detail="User not found")
    values = update_data.model_dump(exclude_unset=True)
    if "first_name" in values:
        row.first_name = values["first_name"]
    if "last_name" in values:
        row.last_name = values["last_name"]
    if values.get("default_interview_persona") is not None:
        row.default_interview_persona = values["default_interview_persona"]
    if values.get("default_interview_difficulty") is not None:
        row.default_interview_difficulty = values["default_interview_difficulty"]
    if "background" in values:
        row.background = values["background"]
    if "target_role" in values or "background" in values:
        profile = await db.scalar(
            select(CandidateProfile)
            .where(CandidateProfile.user_id == row.id)
            .order_by(CandidateProfile.updated_at.desc(), CandidateProfile.id.desc())
        )
        if profile is None and values.get("target_role"):
            profile = CandidateProfile(user_id=row.id, target_role=values["target_role"])
            db.add(profile)
        if profile is not None and values.get("target_role") is not None:
            profile.target_role = values["target_role"]
    await db.commit()
    profile = await db.scalar(
        select(CandidateProfile)
        .where(CandidateProfile.user_id == row.id)
        .order_by(CandidateProfile.updated_at.desc(), CandidateProfile.id.desc())
    )
    return UserResponse(
        id=row.id,
        email=row.email,
        first_name=row.first_name,
        last_name=row.last_name,
        target_role=profile.target_role if profile else None,
        background=row.background,
        default_interview_persona=row.default_interview_persona,
        default_interview_difficulty=row.default_interview_difficulty,
    )
