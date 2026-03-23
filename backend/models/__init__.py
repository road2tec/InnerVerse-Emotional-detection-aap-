"""
Models package - Phase 2 updated
"""
from .user_model import (
    SignupRequest,
    LoginRequest,
    UserResponse,
    AuthTokenResponse,
    ProfileResponse,
    UpdateProfileRequest,
    UserInDB,
    AgeGroup,
    compute_age_group,
    # Backward compat aliases
    UserCreate,
    Token,
)
from .emotion_model import TextEmotionRequest, EmotionResult, EmotionHistoryCreate, DetectionMethod
from .recommendation_model import RecommendationRequest, RecommendationResponse, EmotionRecommendationFull

__all__ = [
    # Phase 2 auth
    "SignupRequest",
    "LoginRequest",
    "UserResponse",
    "AuthTokenResponse",
    "ProfileResponse",
    "UpdateProfileRequest",
    "UserInDB",
    "AgeGroup",
    "compute_age_group",
    # Aliases
    "UserCreate",
    "Token",
    # Emotion
    "TextEmotionRequest",
    "EmotionResult",
    "EmotionHistoryCreate",
    "DetectionMethod",
    # Recommendations
    "RecommendationRequest",
    "RecommendationResponse",
    "EmotionRecommendationFull",
]
