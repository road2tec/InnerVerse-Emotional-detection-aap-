"""
Pydantic Models for Recommendations
"""

from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


class RecommendationRequest(BaseModel):
    emotion: str = Field(..., description="Detected emotion")
    age_group: str = Field(..., description="User age group: child, teen, adult, senior")
    user_id: Optional[str] = Field(None, description="User ID if authenticated")
    location_type: Optional[str] = Field(None, description="Location context: home, office, outdoor, etc.")


class ActivityRecommendation(BaseModel):
    emotion: str
    age_group: str
    activities: List[str]
    description: str


class RecommendationResponse(BaseModel):
    emotion: str
    age_group: str
    activities: List[str]
    description: str
    recommendation_id: Optional[str] = None
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    ai_generated: Optional[bool] = Field(False, description="Whether recommendations were AI-generated")
    model_used: Optional[str] = Field("static", description="Model used for generation (e.g., gpt-3.5-turbo)")


class EmotionRecommendationFull(BaseModel):
    """Combined response with emotion detection + recommendations."""
    emotion_result: dict
    recommendations: RecommendationResponse
