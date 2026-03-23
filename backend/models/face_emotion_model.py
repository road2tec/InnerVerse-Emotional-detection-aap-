"""
Phase 5: Facial Emotion Detection Pydantic Models
"""
from pydantic import BaseModel, Field
from typing import Dict, Optional


class FaceEmotionDetectResponse(BaseModel):
    """
    Phase 5 response: { emotion, confidence }
    plus extended display fields.
    """
    # ── Spec-required ─────────────────────────────────────────────────────────
    emotion: str = Field(..., description="Detected primary emotion")
    confidence: float = Field(..., ge=0.0, le=1.0)

    # ── Extended fields ───────────────────────────────────────────────────────
    all_emotions: Dict[str, float] = Field(default={})
    model_used: str = Field(default="pixel-rules")
    face_detected: bool = Field(default=True)
    face_count: int = Field(default=1)
    bbox: Dict = Field(default={}, description="Face bounding box {x,y,w,h}")
    image_shape: Dict = Field(default={}, description="Image dimensions {width,height}")
    history_id: Optional[str] = Field(None)
    processed_at: Optional[str] = Field(None)


class FaceModelInfoResponse(BaseModel):
    active_model: str
    deepface_available: bool
    keras_model_available: bool
    pytorch_model_available: bool
    emotion_labels: list
    input_format: str
    face_detector: str
    note: str
