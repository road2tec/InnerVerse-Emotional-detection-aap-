"""
Phase 3: Text Emotion Detection Route
POST  /detect-text-emotion   → detect emotion from text, save to history
GET   /detect-text-emotion/model-info  → model status & labels
GET   /detect-text-emotion/history    → paginated emotion history
"""

from fastapi import APIRouter, HTTPException, status, Depends, Query
from datetime import datetime
from bson import ObjectId
from typing import Optional

from models.text_emotion_model import (
    TextEmotionDetectRequest,
    TextEmotionDetectResponse,
    EmotionModelInfoResponse,
)
from services.text_emotion_service import detect_text_emotion, get_model_info
from utils.db import get_async_db
from utils.middleware import get_optional_user

router = APIRouter()


# ─── POST /detect-text-emotion ──────────────────────────────────────────────────

@router.post(
    "",
    response_model=TextEmotionDetectResponse,
    summary="Detect emotion from text (Phase 3)",
    description="""
Analyse free-form text and return the detected emotion with a confidence score.

**Phase 3 emotion labels:** happy · sad · angry · frustrated · neutral · excited · stressed

Uses a user-trained scikit-learn pipeline as the primary model.
Applies predefined contextual rules (hybrid) for strong patterns, and
falls back to keyword analysis if model artifacts are unavailable.

The result is stored in the **emotion_history** MongoDB collection.
    """,
)
async def detect_text_emotion_endpoint(
    body: TextEmotionDetectRequest,
    current_user: Optional[dict] = Depends(get_optional_user),
):
    """
    POST /detect-text-emotion
    Request:  { "text": "I feel very stressed today", "user_id": "...", "age_group": "adult" }
    Response: { "emotion": "stressed", "confidence": 0.87, ... }
    """
    # Run ML inference
    result = detect_text_emotion(body.text)

    # Determine user context
    user_id = body.user_id
    age_group = body.age_group or "adult"

    # If authenticated user is making the request, prefer their real ID
    if current_user:
        user_id = str(current_user["_id"])
        age_group = current_user.get("age_group", age_group)

    # ── Persist to emotion_history ─────────────────────────────────────────────
    history_id: Optional[str] = None
    db = get_async_db()
    if db is not None:
        try:
            history_doc = {
                "user_id": user_id,
                "age_group": age_group,
                "emotion": result["emotion"],
                "confidence": result["confidence"],
                "all_emotions": result.get("all_emotions", {}),
                "detection_method": "text",
                "model_used": result.get("model", "unknown"),
                "input_text": body.text,
                "processed_at": result.get("processed_at"),
                "created_at": datetime.utcnow(),
            }
            insert_result = await db["emotion_history"].insert_one(history_doc)
            history_id = str(insert_result.inserted_id)
        except Exception as e:
            # Don't fail the request just because history saving failed
            import logging
            logging.getLogger(__name__).error(f"Failed to save emotion history: {e}")

    return TextEmotionDetectResponse(
        emotion=result["emotion"],
        confidence=result["confidence"],
        all_emotions=result.get("all_emotions", {}),
        model_used=result.get("model", "unknown"),
        input_text=body.text,
        history_id=history_id,
        processed_at=result.get("processed_at", datetime.utcnow().isoformat() + "Z"),
    )


# ─── GET /detect-text-emotion/model-info ──────────────────────────────────────

@router.get(
    "/model-info",
    response_model=EmotionModelInfoResponse,
    summary="Get text emotion model status",
)
async def text_emotion_model_info():
    """Returns whether the BERT model is loaded or keyword fallback is active."""
    return get_model_info()


# ─── GET /detect-text-emotion/history ─────────────────────────────────────────

@router.get(
    "/history",
    summary="Get text emotion detection history (paginated)",
)
async def get_text_emotion_history(
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    limit: int = Query(20, ge=1, le=100, description="Number of records to return"),
    skip: int = Query(0, ge=0, description="Number of records to skip (for pagination)"),
):
    """Retrieve stored emotion_history records for text detections."""
    db = get_async_db()
    query = {"detection_method": "text"}
    if user_id:
        query["user_id"] = user_id

    total = await db["emotion_history"].count_documents(query)
    cursor = db["emotion_history"].find(
        query,
        sort=[("created_at", -1)],
        skip=skip,
        limit=limit,
    )
    records = []
    async for rec in cursor:
        rec["id"] = str(rec["_id"])
        del rec["_id"]
        records.append(rec)

    return {
        "records": records,
        "total": total,
        "limit": limit,
        "skip": skip,
        "has_more": (skip + limit) < total,
    }
