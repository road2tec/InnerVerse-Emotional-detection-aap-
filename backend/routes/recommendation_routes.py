"""
Recommendation Routes - Get activity recommendations based on emotion
Enhanced with AI-powered dynamic recommendations
"""

from fastapi import APIRouter, HTTPException, Query
from datetime import datetime
from typing import Optional

from models.recommendation_model import RecommendationRequest, RecommendationResponse
from services.ai_recommendation_service import get_ai_activity_recommendations, is_ai_available
from utils.db import get_async_db

router = APIRouter()


@router.post("/", response_model=RecommendationResponse)
async def get_recommendations(request: RecommendationRequest):
    """
    Get activity recommendations based on detected emotion and age group.
    Uses AI-powered recommendations with static fallback.
    """
    try:
        # Prepare user context for AI (optional)
        user_context = {}
        if hasattr(request, 'location_type') and request.location_type:
            user_context['location_type'] = request.location_type

        # Get recommendations using AI or fallback
        recommendations = get_ai_activity_recommendations(
            emotion=request.emotion.lower(),
            age_group=request.age_group.lower(),
            user_context=user_context if user_context else None
        )

        # Structure the response
        return RecommendationResponse(
            emotion=recommendations["emotion"],
            age_group=recommendations["age_group"],
            activities=recommendations["activities"],
            description=recommendations["description"],
            recommendation_id=f"rec_{request.emotion}_{request.age_group}_{int(datetime.utcnow().timestamp())}",
            generated_at=datetime.utcnow(),
            ai_generated=recommendations.get("ai_generated", False),
            model_used=recommendations.get("model_used", "static")
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate recommendations: {str(e)}")


@router.get("/all")
async def get_all_recommendations():
    """Get all available recommendations and supported emotions/age groups."""

    # Get static data from database (if any) and supported categories
    supported_emotions = [
        "happy", "sad", "angry", "anxious", "neutral",
        "surprised", "disgusted", "fearful", "excited", "stressed"
    ]

    supported_age_groups = ["child", "teen", "adult", "senior"]

    ai_status = is_ai_available()

    return {
        "supported_emotions": supported_emotions,
        "supported_age_groups": supported_age_groups,
        "ai_recommendations_available": ai_status,
        "total_emotions": len(supported_emotions),
        "message": "AI-powered dynamic recommendations active" if ai_status else "Static recommendations available"
    }


@router.get("/emotions")
async def get_supported_emotions():
    """Get list of all supported emotions and age groups."""
    return {
        "emotions": [
            "happy", "sad", "angry", "anxious",
            "neutral", "surprised", "disgusted", "fearful",
            "excited", "stressed"
        ],
        "age_groups": ["child", "teen", "adult", "senior"],
        "ai_powered": is_ai_available()
    }


@router.get("/sample")
async def get_sample_recommendation(
    emotion: str = Query(..., description="Emotion to get sample for"),
    age_group: str = Query(..., description="Age group (child/teen/adult/senior)")
):
    """Get a sample recommendation for testing purposes."""

    try:
        recommendations = get_ai_activity_recommendations(
            emotion=emotion.lower(),
            age_group=age_group.lower(),
            use_ai=True
        )

        return {
            "sample_recommendation": recommendations,
            "ai_generated": recommendations.get("ai_generated", False),
            "timestamp": datetime.utcnow()
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to get sample: {str(e)}")


@router.get("/status")
async def get_recommendation_status():
    """Get the current status of the recommendation system."""

    ai_available = is_ai_available()

    return {
        "service_status": "operational",
        "ai_recommendations": ai_available,
        "fallback_available": True,
        "supported_emotions_count": 10,
        "supported_age_groups_count": 4,
        "last_updated": datetime.utcnow()
    }
