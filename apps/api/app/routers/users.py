"""
User Management Endpoints
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.auth import get_current_user

router = APIRouter()


class UserCreate(BaseModel):
    """User creation request"""
    email: EmailStr
    first_name: str
    last_name: str
    clerk_id: str


class UserResponse(BaseModel):
    """User response model"""
    id: str
    email: str
    first_name: str | None
    last_name: str | None
    
    class Config:
        from_attributes = True


@router.post("/register", response_model=UserResponse)
async def register_user(
    user: UserCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Register a new user (called from Clerk webhook).
    """
    # TODO: Implement user registration
    return {"id": "user_id", "email": user.email, "first_name": user.first_name, "last_name": user.last_name}


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """
    Get current authenticated user profile.
    Requires valid Clerk JWT.
    """
    result = await db.execute(
        text("SELECT id, email, first_name, last_name FROM users WHERE id = :id"),
        {"id": user["id"]}
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(
        id=row.id,
        email=row.email,
        first_name=row.first_name,
        last_name=row.last_name,
    )


class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None


@router.put("/me", response_model=UserResponse)
async def update_current_user(
    update_data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """
    Update current user profile.
    """
    await db.execute(
        text("UPDATE users SET first_name = :first_name, last_name = :last_name WHERE id = :id"),
        {"first_name": update_data.first_name, "last_name": update_data.last_name, "id": user["id"]}
    )
    await db.commit()
    result = await db.execute(
        text("SELECT id, email, first_name, last_name FROM users WHERE id = :id"),
        {"id": user["id"]}
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(
        id=row.id,
        email=row.email,
        first_name=row.first_name,
        last_name=row.last_name,
    )
