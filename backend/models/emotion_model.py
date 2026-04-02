"""
Pydantic Models for Emotion Detection
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class EmotionType(str, Enum):
    happy = "happy"
    sad = "sad"
    angry = "angry"
    anxious = "anxious"
    neutral = "neutral"
    surprised = "surprised"
    disgusted = "disgusted"
    fearful = "fearful"


class DetectionMethod(str, Enum):
    text = "text"
    voice = "voice"
    facial = "facial"


class TextEmotionRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000, description="Text to analyze for emotion")
    user_id: Optional[str] = Field(None, description="User ID if authenticated")


class VoiceEmotionRequest(BaseModel):
    user_id: Optional[str] = Field(None, description="User ID if authenticated")
    # Audio file will be sent as multipart/form-data


class FacialEmotionRequest(BaseModel):
    user_id: Optional[str] = Field(None, description="User ID if authenticated")
    # Image file will be sent as multipart/form-data


class EmotionResult(BaseModel):
    emotion: str = Field(..., description="Detected primary emotion")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score (0-1)")
    all_emotions: Dict[str, float] = Field(default={}, description="All emotion scores")
    detection_method: DetectionMethod
    processed_at: datetime = Field(default_factory=datetime.utcnow)


class EmotionHistoryCreate(BaseModel):
    user_id: Optional[str] = None
    emotion: str
    confidence: float
    all_emotions: Dict[str, float] = {}
    detection_method: str
    input_text: Optional[str] = None
    age_group: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class EmotionHistoryResponse(BaseModel):
    id: str
    user_id: Optional[str]
    emotion: str
    confidence: float
    detection_method: str
    input_text: Optional[str]
    created_at: datetime
