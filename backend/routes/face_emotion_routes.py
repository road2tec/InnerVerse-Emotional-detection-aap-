"""
Phase 5: Facial Emotion Detection Route
POST  /detect-face-emotion            → image upload → emotion result
GET   /detect-face-emotion/model-info → active model status
GET   /detect-face-emotion/history    → paginated detection history
"""

import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, Depends, Query
from bson import ObjectId

from models.face_emotion_model import FaceEmotionDetectResponse, FaceModelInfoResponse
from services.face_emotion_service import detect_face_emotion, get_face_model_info
from utils.db import get_async_db
from utils.middleware import get_optional_user

logger = logging.getLogger(__name__)
router = APIRouter()

# Max image size: 10 MB
_MAX_IMAGE_BYTES = 10 * 1024 * 1024

_SUPPORTED_IMAGE_TYPES = {
    "image/jpeg", "image/jpg", "image/png",
    "image/webp", "image/heic", "image/heif",
    "application/octet-stream",   # RN camera fallback
}


# ─── POST /detect-face-emotion ────────────────────────────────────────────────

@router.post(
    "",
    response_model=FaceEmotionDetectResponse,
    summary="Detect emotion from face image (Phase 5)",
    description="""
Upload a selfie/face image (JPEG/PNG) to detect facial emotions.

**Phase 5 emotion labels:** happy · sad · angry · surprise · neutral

**Processing pipeline:**
1. Decode image with OpenCV (`cv2.imdecode`)
2. Detect face(s) with Haar Cascade frontal-face detector
3. Crop & resize face ROI to 48×48 (FER2013 format)
4. Run CNN classifier (priority: DeepFace → Keras FER2013 → PyTorch → pixel-rules)
5. Save result to `emotion_history` collection

**Request (multipart form):**
- `image_file` — camera image (JPEG/PNG, max 10 MB)
- `user_id`    — optional user ID
- `age_group`  — optional age group
    """,
)
async def detect_face_emotion_endpoint(
    image_file: UploadFile = File(..., description="Face image (JPEG/PNG from camera)"),
    user_id: Optional[str] = Form(None),
    age_group: Optional[str] = Form("adult"),
    current_user: Optional[dict] = Depends(get_optional_user),
):
    # ── Validate ───────────────────────────────────────────────────────────────
    if image_file.content_type and image_file.content_type not in _SUPPORTED_IMAGE_TYPES:
        logger.warning(f"Unusual image MIME type: {image_file.content_type} — attempting anyway.")

    image_bytes = await image_file.read()

    if len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="Image file is empty.")
    if len(image_bytes) > _MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image too large. Max 10 MB.")

    # ── Auth context ───────────────────────────────────────────────────────────
    if current_user:
        user_id = str(current_user["_id"])
        age_group = current_user.get("age_group", age_group or "adult")

    # ── ML inference ───────────────────────────────────────────────────────────
    result = detect_face_emotion(image_bytes)
    processed_at = datetime.utcnow().isoformat() + "Z"

    if result.get("model_used") == "error":
        raise HTTPException(
            status_code=422,
            detail=f"Could not process image: {result.get('error', 'Unknown error')}",
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
                "detection_method": "facial",
                "model_used": result.get("model_used", "unknown"),
                "face_detected": result.get("face_detected", False),
                "face_count": result.get("face_count", 0),
                "bbox": result.get("bbox", {}),
                "processed_at": processed_at,
                "created_at": datetime.utcnow(),
            }
            ins = await db["emotion_history"].insert_one(history_doc)
            history_id = str(ins.inserted_id)
        except Exception as e:
            logger.error(f"Failed to save face emotion history: {e}")

    return FaceEmotionDetectResponse(
        emotion=result["emotion"],
        confidence=result["confidence"],
        all_emotions=result.get("all_emotions", {}),
        model_used=result.get("model_used", "pixel-rules"),
        face_detected=result.get("face_detected", True),
        face_count=result.get("face_count", 1),
        bbox=result.get("bbox", {}),
        image_shape=result.get("image_shape", {}),
        history_id=history_id,
        processed_at=processed_at,
    )


# ─── GET /detect-face-emotion/model-info ──────────────────────────────────────

@router.get("/model-info", response_model=FaceModelInfoResponse, summary="Face emotion model status")
async def face_emotion_model_info():
    return get_face_model_info()


# ─── GET /detect-face-emotion/history ─────────────────────────────────────────

@router.get("/history", summary="Face emotion detection history (paginated)")
async def get_face_emotion_history(
    user_id: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    skip: int = Query(0, ge=0),
):
    db = get_async_db()
    query = {"detection_method": "facial"}
    if user_id:
        query["user_id"] = user_id

    total = await db["emotion_history"].count_documents(query)
    cursor = db["emotion_history"].find(query, sort=[("created_at", -1)], skip=skip, limit=limit)
    records = []
    async for rec in cursor:
        rec["id"] = str(rec["_id"])
        del rec["_id"]
        records.append(rec)

    return {"records": records, "total": total, "limit": limit, "skip": skip, "has_more": (skip + limit) < total}
