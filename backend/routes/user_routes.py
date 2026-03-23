"""
User Auth Routes - Phase 2
Implements the exact endpoints required:
  POST /api/users/signup   → Register new user
  POST /api/users/login    → JSON login (email + password)
  GET  /api/users/profile  → Authenticated profile with stats
  PATCH /api/users/profile → Update profile fields
  GET  /api/users/history/{user_id} → Emotion history
"""

from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import OAuth2PasswordRequestForm
from datetime import datetime
from bson import ObjectId

from models.user_model import (
    SignupRequest,
    LoginRequest,
    UserResponse,
    AuthTokenResponse,
    ProfileResponse,
    UpdateProfileRequest,
    compute_age_group,
)
from utils.db import get_async_db
from utils.auth import hash_password, verify_password, create_access_token, get_token_expiry_seconds
from utils.middleware import get_current_user

router = APIRouter()


# ─── Helper ────────────────────────────────────────────────────────────────────

def _build_user_response(user: dict) -> UserResponse:
    """Convert a MongoDB user document to UserResponse."""
    return UserResponse(
        id=str(user["_id"]),
        name=user.get("name", user.get("username", "User")),
        email=user["email"],
        age=user["age"],
        age_group=user.get("age_group", compute_age_group(user["age"])),
        created_at=user["created_at"],
    )


def _build_token_response(user: dict) -> AuthTokenResponse:
    """Build the full auth response: token + user payload."""
    access_token = create_access_token(data={"sub": user["email"]})
    return AuthTokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=get_token_expiry_seconds(),
        user=_build_user_response(user),
    )


# ─── POST /signup ──────────────────────────────────────────────────────────────

@router.post(
    "/signup",
    response_model=AuthTokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Sign up a new user",
    description="Register a new user account. Returns a JWT token on success.",
)
async def signup(body: SignupRequest):
    db = get_async_db()
    users = db["users"]

    # Duplicate check
    if await users.find_one({"email": body.email}):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    age_group = compute_age_group(body.age)

    user_doc = {
        "name": body.name,
        "email": body.email,
        "password": hash_password(body.password),   # bcrypt hash
        "age": body.age,
        "age_group": age_group,
        "created_at": datetime.utcnow(),
        "is_active": True,
    }

    result = await users.insert_one(user_doc)
    user_doc["_id"] = result.inserted_id

    return _build_token_response(user_doc)


# ─── POST /login ───────────────────────────────────────────────────────────────

@router.post(
    "/login",
    response_model=AuthTokenResponse,
    summary="Login with email + password",
    description="Accepts JSON body {email, password}. Returns JWT on success.",
)
async def login(body: LoginRequest):
    db = get_async_db()
    user = await db["users"].find_one({"email": body.email, "is_active": True})

    if not user or not verify_password(body.password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return _build_token_response(user)


# ─── OAuth2 form login (for Swagger UI "Authorize" button) ────────────────────

@router.post(
    "/login/form",
    response_model=AuthTokenResponse,
    include_in_schema=True,
    summary="OAuth2 form login (Swagger UI compatible)",
)
async def login_form(form_data: OAuth2PasswordRequestForm = Depends()):
    """Used by Swagger /docs Authorize button."""
    return await login(LoginRequest(email=form_data.username, password=form_data.password))


# ─── GET /profile ──────────────────────────────────────────────────────────────

@router.get(
    "/profile",
    response_model=ProfileResponse,
    summary="Get authenticated user profile",
    description="Requires Bearer token. Returns profile + emotion detection stats.",
)
async def get_profile(current_user: dict = Depends(get_current_user)):
    db = get_async_db()

    # Count total detections for this user
    user_id = str(current_user["_id"])
    total = await db["emotion_history"].count_documents({"user_id": user_id})

    # Get the most recent emotion
    last_record = await db["emotion_history"].find_one(
        {"user_id": user_id},
        sort=[("created_at", -1)],
    )
    last_emotion = last_record["emotion"] if last_record else None

    return ProfileResponse(
        id=user_id,
        name=current_user.get("name", current_user.get("username", "User")),
        email=current_user["email"],
        age=current_user["age"],
        age_group=current_user.get("age_group", compute_age_group(current_user["age"])),
        created_at=current_user["created_at"],
        total_detections=total,
        last_emotion=last_emotion,
    )


# ─── PATCH /profile ────────────────────────────────────────────────────────────

@router.patch(
    "/profile",
    response_model=UserResponse,
    summary="Update profile (name / age)",
)
async def update_profile(
    body: UpdateProfileRequest,
    current_user: dict = Depends(get_current_user),
):
    db = get_async_db()
    update_fields: dict = {}

    if body.name is not None:
        update_fields["name"] = body.name.strip()
    if body.age is not None:
        update_fields["age"] = body.age
        update_fields["age_group"] = compute_age_group(body.age)

    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update.")

    await db["users"].update_one(
        {"_id": current_user["_id"]},
        {"$set": update_fields},
    )
    updated = await db["users"].find_one({"_id": current_user["_id"]})
    return _build_user_response(updated)


# ─── GET /history/{user_id} ────────────────────────────────────────────────────

@router.get(
    "/history/{user_id}",
    summary="Get emotion detection history for a user",
)
async def get_user_history(user_id: str, limit: int = 20):
    db = get_async_db()
    cursor = db["emotion_history"].find(
        {"user_id": user_id},
        sort=[("created_at", -1)],
        limit=limit,
    )
    history = []
    async for rec in cursor:
        rec["id"] = str(rec["_id"])
        del rec["_id"]
        history.append(rec)

    return {"user_id": user_id, "history": history, "total": len(history)}
