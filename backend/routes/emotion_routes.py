"""
Emotion Detection Routes
Supports: text, voice (audio file), facial (image file)
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import Optional
from datetime import datetime

from models.emotion_model import TextEmotionRequest, EmotionResult, EmotionHistoryCreate, DetectionMethod
from services.emotion_service import detect_emotion_from_text, detect_emotion_from_image, detect_emotion_from_audio
from utils.db import get_async_db

router = APIRouter()


async def save_emotion_history(db, emotion_result: dict, method: str, user_id: Optional[str], input_text: Optional[str], age_group: Optional[str]):
    """Save emotion detection result to history."""
    history_collection = db["emotion_history"]
    doc = {
        "user_id": user_id,
        "emotion": emotion_result["emotion"],
        "confidence": emotion_result["confidence"],
        "all_emotions": emotion_result.get("all_emotions", {}),
        "detection_method": method,
        "input_text": input_text,
        "age_group": age_group,
        "created_at": datetime.utcnow(),
    }
    await history_collection.insert_one(doc)


@router.post("/text")
async def detect_emotion_text(request: TextEmotionRequest):
    """
    Detect emotion from text input.
    Returns detected emotion with confidence score.
    """
    try:
        result = detect_emotion_from_text(request.text)
        db = get_async_db()
        if db is not None:
            await save_emotion_history(db, result, "text", request.user_id, request.text, None)
        return {
            "success": True,
            "detection_method": "text",
            "input_text": request.text,
            "emotion": result["emotion"],
            "confidence": result["confidence"],
            "all_emotions": result["all_emotions"],
            "processed_at": datetime.utcnow(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Emotion detection failed: {str(e)}")


@router.post("/facial")
async def detect_emotion_facial(
    image: UploadFile = File(..., description="Face image file (jpg/png)"),
    user_id: Optional[str] = Form(None),
    age_group: Optional[str] = Form(None),
):
    """
    Detect emotion from facial expression (image).
    Accepts a face image and returns detected emotion.
    """
    allowed_types = ["image/jpeg", "image/png", "image/jpg", "image/webp"]
    if image.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid image format. Use JPEG or PNG.")

    try:
        image_bytes = await image.read()
        result = detect_emotion_from_image(image_bytes)
        db = get_async_db()
        if db is not None:
            await save_emotion_history(db, result, "facial", user_id, None, age_group)
        return {
            "success": True,
            "detection_method": "facial",
            "emotion": result["emotion"],
            "confidence": result["confidence"],
            "all_emotions": result["all_emotions"],
            "processed_at": datetime.utcnow(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Facial emotion detection failed: {str(e)}")


@router.post("/voice")
async def detect_emotion_voice(
    audio: UploadFile = File(..., description="Audio file (wav/mp3)"),
    user_id: Optional[str] = Form(None),
    age_group: Optional[str] = Form(None),
):
    """
    Detect emotion from voice/audio input.
    Accepts an audio file and returns detected emotion.
    """
    allowed_types = ["audio/wav", "audio/mpeg", "audio/mp3", "audio/x-wav", "audio/wave"]
    if audio.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid audio format. Use WAV or MP3.")

    try:
        audio_bytes = await audio.read()
        result = detect_emotion_from_audio(audio_bytes)
        db = get_async_db()
        if db is not None:
            await save_emotion_history(db, result, "voice", user_id, None, age_group)
        return {
            "success": True,
            "detection_method": "voice",
            "emotion": result["emotion"],
            "confidence": result["confidence"],
            "all_emotions": result["all_emotions"],
            "processed_at": datetime.utcnow(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Voice emotion detection failed: {str(e)}")


@router.get("/history")
async def get_emotion_history(limit: int = 10):
    """Get recent emotion detection history (anonymous)."""
    db = get_async_db()
    history_collection = db["emotion_history"]
    cursor = history_collection.find({}, sort=[("created_at", -1)], limit=limit)
    history = []
    async for record in cursor:
        record["id"] = str(record["_id"])
        del record["_id"]
        history.append(record)
    return {"history": history, "total": len(history)}
