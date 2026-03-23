"""
Phase 4: Voice Emotion Detection Route
POST  /detect-voice-emotion          → multipart audio upload → emotion result
GET   /detect-voice-emotion/model-info → model status
GET   /detect-voice-emotion/history    → paginated detection history
"""

import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, Depends, Query, status
from bson import ObjectId

from models.voice_emotion_model import VoiceEmotionDetectResponse, VoiceModelInfoResponse
from services.voice_emotion_service import detect_voice_emotion, get_voice_model_info
from utils.db import get_async_db
from utils.middleware import get_optional_user

logger = logging.getLogger(__name__)
router = APIRouter()

# Max audio size: 25 MB
_MAX_AUDIO_BYTES = 25 * 1024 * 1024

# Supported audio MIME types from React Native audio recorders
_SUPPORTED_TYPES = {
    "audio/wav", "audio/wave", "audio/x-wav",
    "audio/mpeg", "audio/mp3", "audio/mp4", "audio/m4a",
    "audio/aac", "audio/ogg", "audio/webm",
    "application/octet-stream",   # fallback for RN AudioRecorderPlayer
}


# ─── POST /detect-voice-emotion ───────────────────────────────────────────────

@router.post(
    "",
    response_model=VoiceEmotionDetectResponse,
    summary="Detect emotion from voice recording (Phase 4)",
    description="""
Upload an audio file (WAV / M4A / MP3 / OGG) and receive the detected emotion.

**Phase 4 emotion labels:** happy · sad · angry · fear · neutral

**Processing pipeline:**
1. Decode audio with `librosa` (supports any format ffmpeg can read)
2. Extract 162-dimensional RAVDESS-style feature vector:
   - 40 MFCCs (mean + std)
   - 12 Chroma features
   - 40 Mel-Spectrogram bands
   - 7 Spectral contrast bands
   - Spectral centroid, ZCR, RMS energy, Tempo
3. Run sklearn model (if available) or rule-based acoustic classifier
4. Save result to `emotion_history` MongoDB collection

**Request (multipart form):**
- `audio_file` — audio recording file (required)
- `user_id`    — optional user ID string
- `age_group`  — optional age group for recommendations
    """,
)
async def detect_voice_emotion_endpoint(
    audio_file: UploadFile = File(..., description="Audio recording (.wav/.m4a/.mp3/.ogg)"),
    user_id: Optional[str] = Form(None, description="Optional user ID"),
    age_group: Optional[str] = Form("adult", description="Age group for recommendations"),
    current_user: Optional[dict] = Depends(get_optional_user),
):
    # ── Validate file ──────────────────────────────────────────────────────────
    if audio_file.content_type and audio_file.content_type not in _SUPPORTED_TYPES:
        logger.warning(f"Unusual content type: {audio_file.content_type} — attempting anyway.")

    audio_bytes = await audio_file.read()

    if len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="Audio file is empty.")

    if len(audio_bytes) > _MAX_AUDIO_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Audio file too large. Maximum size is {_MAX_AUDIO_BYTES // (1024*1024)} MB.",
        )

    # ── Auth context ───────────────────────────────────────────────────────────
    if current_user:
        user_id = str(current_user["_id"])
        age_group = current_user.get("age_group", age_group or "adult")

    # ── Run ML inference ───────────────────────────────────────────────────────
    result = detect_voice_emotion(audio_bytes, filename=audio_file.filename or "recording")
    processed_at = datetime.utcnow().isoformat() + "Z"

    if result.get("model_used") == "error":
        raise HTTPException(
            status_code=422,
            detail=f"Could not process audio: {result.get('error', 'Unknown error')}",
        )

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
                "detection_method": "voice",
                "model_used": result.get("model_used", "unknown"),
                "audio_features": result.get("features", {}),
                "duration_seconds": result.get("duration_seconds", 0.0),
                "processed_at": processed_at,
                "created_at": datetime.utcnow(),
            }
            insert_result = await db["emotion_history"].insert_one(history_doc)
            history_id = str(insert_result.inserted_id)
        except Exception as e:
            logger.error(f"Failed to save voice emotion history: {e}")

    return VoiceEmotionDetectResponse(
        emotion=result["emotion"],
        confidence=result["confidence"],
        all_emotions=result.get("all_emotions", {}),
        model_used=result.get("model_used", "rule-based"),
        features=result.get("features", {}),
        duration_seconds=result.get("duration_seconds", 0.0),
        history_id=history_id,
        processed_at=processed_at,
    )


# ─── GET /detect-voice-emotion/model-info ─────────────────────────────────────

@router.get(
    "/model-info",
    response_model=VoiceModelInfoResponse,
    summary="Get voice emotion model status",
)
async def voice_emotion_model_info():
    """Returns whether RAVDESS sklearn model is loaded or rule-based fallback is active."""
    return get_voice_model_info()


# ─── GET /detect-voice-emotion/history ────────────────────────────────────────

@router.get(
    "/history",
    summary="Get voice emotion detection history (paginated)",
)
async def get_voice_emotion_history(
    user_id: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    skip: int = Query(0, ge=0),
):
    db = get_async_db()
    query = {"detection_method": "voice"}
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
