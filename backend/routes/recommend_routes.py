"""
Phase 6: Activity Recommendation Routes
POST /recommend-activity  → exact spec endpoint
GET  /recommendations     → same functionality via GET (convenience)
GET  /recommendations/all → full matrix
GET  /recommendations/emotions → supported emotions & age groups
"""

import logging
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, field_validator

from services.recommendation_service import (
    get_activity_recommendations,
    get_all_emotions,
    get_all_age_groups,
    age_to_group,
    get_recommendations_matrix,
)
from utils.db import get_async_db

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── Pydantic Schemas ──────────────────────────────────────────────────────────

class RecommendActivityRequest(BaseModel):
    """
    Phase 6 spec request:
      { "emotion": "sad", "age": 24 }
    Also accepts optional age_group and user_id fields.
    """
    emotion: str = Field(..., description="Detected emotion (e.g. sad, happy, angry)")
    age: Optional[int] = Field(None, ge=0, le=120, description="Numeric age — auto-converted to age group")
    age_group: Optional[str] = Field(None, description="Explicit age group: child | teen | adult | senior")
    user_id: Optional[str] = Field(None, description="Optional user ID for history tracking")

    @field_validator("emotion")
    @classmethod
    def emotion_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("emotion must not be empty")
        return v.strip().lower()


class RecommendActivityResponse(BaseModel):
    """
    Phase 6 spec response:
      { "activities": ["Meditation", "Watch Movie", "Talk with Friends"] }
    Plus extended display fields.
    """
    # ── Spec-required ──────────────────────────────────────────────────────────
    activities: List[str]

    # ── Extended fields ────────────────────────────────────────────────────────
    emotion: str
    age_group: str
    description: str = ""
    total_available: int = 0
    generated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")


# ─── POST /recommend-activity (Exact Phase 6 Spec) ────────────────────────────

@router.post(
    "/recommend-activity",
    response_model=RecommendActivityResponse,
    summary="Get activity recommendations (Phase 6)",
    description="""
Given an **emotion** and **age** (or **age_group**), returns a curated list of
recommended activities.

**Emotions supported (all phases):**
happy · sad · angry · frustrated · neutral · excited · stressed · fear · surprise

**Age groups:**
child (≤12) · teen (13–19) · adult (20–59) · senior (60+)

**Example:**
```json
POST /recommend-activity
{ "emotion": "sad", "age": 24 }

→ { "activities": ["Meditation", "Watch a favourite movie", "Talk with friends"] }
```
    """,
    tags=["Phase 6 — Recommendations"],
)
async def recommend_activity(body: RecommendActivityRequest):
    result = get_activity_recommendations(
        emotion=body.emotion,
        age_group=body.age_group,
        age=body.age,
    )

    # Optionally save recommendation event to DB
    db = get_async_db()
    if db is not None and body.user_id:
        try:
            await db["recommendation_history"].insert_one({
                "user_id": body.user_id,
                "emotion": result["emotion"],
                "age_group": result["age_group"],
                "activities": result["activities"],
                "created_at": datetime.utcnow(),
            })
        except Exception as e:
            logger.warning(f"Could not save recommendation history: {e}")

    return RecommendActivityResponse(
        activities=result["activities"],
        emotion=result["emotion"],
        age_group=result["age_group"],
        description=result["description"],
        total_available=result["total_available"],
    )


# ─── GET /recommendations (convenience alias with query params) ──────────────

@router.get(
    "/",
    response_model=RecommendActivityResponse,
    summary="Get recommendations via GET (convenience)",
    tags=["Phase 6 — Recommendations"],
)
async def get_recommendations_get(
    emotion: str = Query(..., description="Emotion label"),
    age: Optional[int] = Query(None, ge=0, le=120, description="User age"),
    age_group: Optional[str] = Query(None, description="Age group override"),
):
    result = get_activity_recommendations(emotion=emotion, age_group=age_group, age=age)
    return RecommendActivityResponse(**result)


# ─── GET /recommendations/all ────────────────────────────────────────────────

@router.get(
    "/all",
    summary="Get full recommendation matrix",
    tags=["Phase 6 — Recommendations"],
)
async def get_all_recommendations_matrix():
    """Returns overview of all 36 (emotion × age_group) recommendation sets."""
    return {
        "matrix": get_recommendations_matrix(),
        "total_emotions": len(get_all_emotions()),
        "emotions": get_all_emotions(),
        "age_groups": get_all_age_groups(),
    }


# ─── GET /recommendations/emotions ───────────────────────────────────────────

@router.get(
    "/emotions",
    summary="List supported emotions + age groups",
    tags=["Phase 6 — Recommendations"],
)
async def get_supported_emotions():
    return {
        "emotions": get_all_emotions(),
        "age_groups": get_all_age_groups(),
        "note": "POST /recommend-activity also handles aliases: joy→happy, anger→angry, etc.",
    }
