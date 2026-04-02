"""
AI-Powered Activity Recommendation Service
==========================================
Uses OpenAI API to generate personalized activity recommendations based on:
- Detected emotion (happy, sad, angry, etc.)
- User age group (child, teen, adult, senior)
- Cultural context and preferences

This service generates dynamic, contextual recommendations instead of static mappings.
"""

import os
import json
import logging
from typing import Dict, List, Optional
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AIRecommendationService:
    """AI-powered recommendation service using OpenAI API."""

    def __init__(self):
        """Initialize the AI recommendation service."""
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.model = os.getenv("AI_MODEL", "gpt-3.5-turbo")
        self.use_ai = os.getenv("USE_AI_RECOMMENDATIONS", "True").lower() == "true"

        if self.use_ai and not self.api_key:
            logger.warning("AI API key not found. Falling back to static recommendations.")
            self.use_ai = False

        if self.use_ai:
            try:
                # Check if this is an OpenRouter API key (starts with sk-or-)
                if self.api_key.startswith("sk-or-"):
                    # Use OpenRouter API endpoint
                    self.client = OpenAI(
                        api_key=self.api_key,
                        base_url="https://openrouter.ai/api/v1"
                    )
                    logger.info("✅ AI Recommendation Service initialized with OpenRouter API")
                else:
                    # Use standard OpenAI API
                    self.client = OpenAI(api_key=self.api_key)
                    logger.info("✅ AI Recommendation Service initialized with OpenAI API")

            except Exception as e:
                logger.error(f"❌ Failed to initialize AI client: {e}")
                self.use_ai = False

    def generate_ai_recommendations(
        self,
        emotion: str,
        age_group: str,
        user_context: Optional[Dict] = None
    ) -> Dict:
        """
        Generate AI-powered activity recommendations.

        Args:
            emotion: Detected emotion (happy, sad, angry, etc.)
            age_group: User age group (child, teen, adult, senior)
            user_context: Optional context (location, preferences, time of day)

        Returns:
            Dict with emotion, age_group, activities, description, and AI-generated flag
        """
        try:
            # Create the prompt for AI
            prompt = self._create_recommendation_prompt(emotion, age_group, user_context)

            # Call OpenRouter/OpenAI API
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert wellness and activity recommendation assistant. Provide helpful, safe, and age-appropriate activity suggestions for different emotional states."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                max_tokens=400,
                temperature=0.7,
                extra_headers={
                    "HTTP-Referer": "https://emotion-app.local",
                    "X-Title": "Emotion Activity Recommendation App"
                } if self.api_key.startswith("sk-or-") else {}
            )

            # Parse AI response
            response_content = response.choices[0].message.content

            # Try to extract JSON if there's additional text
            try:
                # First try direct parsing
                ai_result = json.loads(response_content)
            except json.JSONDecodeError:
                # Try to find JSON within the response
                import re
                json_match = re.search(r'\{.*\}', response_content, re.DOTALL)
                if json_match:
                    ai_result = json.loads(json_match.group())
                else:
                    raise ValueError("No valid JSON found in response")

            # Structure the response
            recommendation = {
                "emotion": emotion,
                "age_group": age_group,
                "activities": ai_result.get("activities", [])[:5],  # Limit to 5 activities
                "description": ai_result.get("description", ""),
                "ai_generated": True,
                "model_used": self.model
            }

            logger.info(f"✅ AI recommendations generated for {emotion} - {age_group}")
            return recommendation

        except Exception as e:
            logger.error(f"❌ AI recommendation failed: {e}")
            # Fallback to static recommendations
            return self._get_fallback_recommendation(emotion, age_group)

    def _create_recommendation_prompt(
        self,
        emotion: str,
        age_group: str,
        user_context: Optional[Dict] = None
    ) -> str:
        """Create a detailed prompt for the AI to generate recommendations."""

        # Age group descriptions
        age_descriptions = {
            "child": "children (ages 5-12)",
            "teen": "teenagers (ages 13-19)",
            "adult": "adults (ages 20-59)",
            "senior": "seniors (ages 60+)"
        }

        age_desc = age_descriptions.get(age_group, "adults")

        # Context information
        context_info = ""
        if user_context:
            if "time_of_day" in user_context:
                context_info += f"Time: {user_context['time_of_day']}. "
            if "location_type" in user_context:
                context_info += f"Location: {user_context['location_type']}. "

        # Create the prompt
        prompt = f"""
Generate 5 specific activity recommendations for {age_desc} who are feeling {emotion}.

Requirements:
- Activities should be safe, healthy, and age-appropriate
- Consider the emotional state and what would be most helpful
- Include both indoor and outdoor options when possible
- Be specific (e.g., "Take a 10-minute walk outside" not just "exercise")
- Cultural sensitivity and accessibility awareness
{context_info}

Emotion Context:
- Happy: Activities to celebrate and maintain positive mood
- Sad: Gentle, comforting activities that provide emotional support
- Angry: Activities to release tension and calm down safely
- Anxious/Stressed: Calming, grounding activities to reduce anxiety
- Neutral: Productive or engaging activities to boost mood
- Excited: Channels high energy in positive directions

IMPORTANT: Return ONLY a valid JSON object with this exact structure (no additional text):
{{
  "activities": [
    "Specific activity 1 with actionable details",
    "Specific activity 2 with actionable details",
    "Specific activity 3 with actionable details",
    "Specific activity 4 with actionable details",
    "Specific activity 5 with actionable details"
  ],
  "description": "Brief explanation of why these activities suit this emotional state for this age group"
}}
"""

        return prompt.strip()

    def _get_fallback_recommendation(self, emotion: str, age_group: str) -> Dict:
        """Fallback to static recommendations if AI fails."""
        # Import the static recommendation service as fallback
        from .recommendation_service import get_activity_recommendations

        static_rec = get_activity_recommendations(emotion, age_group)
        static_rec["ai_generated"] = False
        static_rec["fallback_reason"] = "AI service unavailable"

        logger.info(f"📋 Using static fallback for {emotion} - {age_group}")
        return static_rec

# Global service instance
ai_recommendation_service = AIRecommendationService()

def get_ai_activity_recommendations(
    emotion: str,
    age_group: str,
    user_context: Optional[Dict] = None,
    use_ai: bool = True
) -> Dict:
    """
    Main function to get activity recommendations (AI or static fallback).

    Args:
        emotion: Detected emotion
        age_group: User age group
        user_context: Optional context information
        use_ai: Whether to use AI (can be overridden)

    Returns:
        Recommendation dictionary with activities and metadata
    """
    if use_ai and ai_recommendation_service.use_ai:
        return ai_recommendation_service.generate_ai_recommendations(
            emotion, age_group, user_context
        )
    else:
        return ai_recommendation_service._get_fallback_recommendation(emotion, age_group)

def is_ai_available() -> bool:
    """Check if AI recommendation service is available."""
    return ai_recommendation_service.use_ai