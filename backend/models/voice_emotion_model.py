"""
Phase 4: Voice Emotion Detection Pydantic Models
Request/response schemas for POST /detect-voice-emotion
"""

from pydantic import BaseModel, Field
from typing import Dict, Optional


class VoiceEmotionDetectResponse(BaseModel):
    """
    Phase 4 response: { emotion, confidence }
    + extended fields for mobile app display.
    """
    # ── Spec-required fields ──────────────────────────────────────────────────
    emotion: str = Field(..., description="Primary detected emotion")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score (0–1)")

    # ── Extended fields ───────────────────────────────────────────────────────
    all_emotions: Dict[str, float] = Field(default={}, description="Scores for all Phase 4 labels")
    model_used: str = Field(default="rule-based", description="'sklearn' | 'rule-based' | 'error'")
    features: Dict = Field(default={}, description="Extracted audio features (RMS, ZCR, tempo, ...)")
    duration_seconds: float = Field(default=0.0, description="Duration of the audio clip")
    history_id: Optional[str] = Field(None, description="MongoDB _id of saved emotion_history record")
    processed_at: Optional[str] = Field(None)


class VoiceModelInfoResponse(BaseModel):
    model_name: str
    model_type: str
    status: str
    emotion_labels: list
    feature_dimensions: int
    feature_set: str
