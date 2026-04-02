"""
Pydantic Models for Users - Phase 2 Enhanced
Database Schema:
  {
    name: string,
    email: string,
    password: string (hashed),
    age: number,
    created_at: datetime,
    age_group: string,
    is_active: bool
  }
"""

from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
from datetime import datetime
from enum import Enum


class AgeGroup(str, Enum):
    child = "child"    # 0-12
    teen = "teen"      # 13-19
    adult = "adult"    # 20-59
    senior = "senior"  # 60+


def compute_age_group(age: int) -> str:
    if age <= 12:
        return AgeGroup.child.value
    elif age <= 19:
        return AgeGroup.teen.value
    elif age <= 59:
        return AgeGroup.adult.value
    else:
        return AgeGroup.senior.value


# ─── Request models ────────────────────────────────────────────────────────────

class SignupRequest(BaseModel):
    """Phase 2 signup - matches database schema exactly."""
    name: str = Field(..., min_length=2, max_length=100, description="Full name")
    email: EmailStr = Field(..., description="Unique email address")
    password: str = Field(..., min_length=6, description="Password (min 6 chars)")
    age: int = Field(..., ge=1, le=120, description="User age")

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Name must not be blank")
        return v.strip()

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class LoginRequest(BaseModel):
    """JSON body login (email + password)."""
    email: EmailStr = Field(..., description="Registered email address")
    password: str = Field(..., description="Account password")


class UpdateProfileRequest(BaseModel):
    """Partial profile update."""
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    age: Optional[int] = Field(None, ge=1, le=120)


# ─── Response models ───────────────────────────────────────────────────────────

class UserResponse(BaseModel):
    """Safe user representation (no password)."""
    id: str
    name: str
    email: str
    age: int
    age_group: str
    created_at: datetime

    class Config:
        populate_by_name = True


class AuthTokenResponse(BaseModel):
    """Returned on successful signup/login."""
    access_token: str
    token_type: str = "bearer"
    expires_in: int          # seconds
    user: UserResponse


class ProfileResponse(BaseModel):
    """Full profile including stats."""
    id: str
    name: str
    email: str
    age: int
    age_group: str
    created_at: datetime
    total_detections: int = 0
    last_emotion: Optional[str] = None


# ─── DB internal model ─────────────────────────────────────────────────────────

class UserInDB(BaseModel):
    """MongoDB document structure."""
    name: str
    email: str
    password: str          # bcrypt hash stored as 'password'
    age: int
    age_group: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True


# ─── Backward compat aliases (used by Phase 1 routes) ─────────────────────────
UserCreate = SignupRequest
Token = AuthTokenResponse
