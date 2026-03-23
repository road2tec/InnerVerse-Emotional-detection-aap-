"""
Phase 3: Text Emotion Detection Models
Pydantic request/response schemas for the POST /detect-text-emotion endpoint
"""

from pydantic import BaseModel, Field, field_validator
from typing import Dict, Optional
from datetime import datetime


class TextEmotionDetectRequest(BaseModel):
    """Request body for POST /detect-text-emotion"""
    text: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="Free-form text describing how the user feels",
        examples=["I am feeling very stressed today."],
    )
    user_id: Optional[str] = Field(
        None,
        description="Optional authenticated user ID to persist history",
    )
    age_group: Optional[str] = Field(
        None,
        description="User age group for personalised recommendations (child/teen/adult/senior)",
    )

    @field_validator("text")
    @classmethod
    def text_must_not_be_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Text must not be empty or only whitespace.")
        return v.strip()


class TextEmotionDetectResponse(BaseModel):
    """
    Response for POST /detect-text-emotion
    Matches exactly the Phase 3 spec:
      { "emotion": "stress", "confidence": 0.87 }
    Plus extended fields for the mobile app.
    """
    emotion: str = Field(..., description="Primary detected emotion")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score (0–1)")

    # Extended fields
    all_emotions: Dict[str, float] = Field(
        default={},
        description="Scores for all Phase 3 emotion labels",
    )
    model_used: str = Field(
        default="sklearn-lr-pipeline",
        description="Model path used for inference, e.g. 'sklearn-lr-pipeline', 'keyword', or 'hybrid-rule+sklearn-lr-pipeline'",
    )
    input_text: str = Field(default="", description="The original input text")
    history_id: Optional[str] = Field(
        None,
        description="MongoDB _id of the saved emotion_history record",
    )
    processed_at: str = Field(
        default_factory=lambda: datetime.utcnow().isoformat() + "Z",
        description="UTC timestamp of processing",
    )


class EmotionModelInfoResponse(BaseModel):
    """Response for GET /detect-text-emotion/model-info"""
    model_name: str
    status: str
    emotion_labels: list
    type: str
