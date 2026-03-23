"""
Emotion Based Activity Recommendation System
Backend - FastAPI Application Entry Point - Enhanced with Error Handling
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import os

from routes import emotion_routes, user_routes, recommendation_routes, text_emotion_routes, voice_emotion_routes, face_emotion_routes
from routes.recommend_routes import router as recommend_router
from routes.history_routes import router as history_router
from utils.db import connect_to_mongo, close_mongo_connection
from utils.error_handler import setup_error_handlers, success_response

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle"""
    try:
        # Startup
        logger.info("🚀 Starting Emotion Recommendation API...")
        await connect_to_mongo()
        logger.info("✅ Application startup complete")
        yield
    except Exception as e:
        logger.error(f"❌ Startup error: {e}")
        raise
    finally:
        # Shutdown
        logger.info("🔄 Shutting down application...")
        await close_mongo_connection()
        logger.info("✅ Application shutdown complete")


app = FastAPI(
    title="Emotion Based Activity Recommendation System API",
    description="AI-powered emotion detection and activity recommendations with enhanced error handling",
    version="8.0.0",
    lifespan=lifespan,
    docs_url="/docs",  # Swagger UI
    redoc_url="/redoc",  # ReDoc UI
)

# Setup enhanced error handlers
setup_error_handlers(app)

# Enhanced CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to specific domains
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


# Health check with detailed status
@app.get("/", tags=["Health"])
async def root():
    """Root endpoint with system status"""
    return success_response({
        "service": "Emotion Based Activity Recommendation System API",
        "version": "8.0.0",
        "status": "operational",
        "features": {
            "ai_recommendations": True,
            "emotion_detection": ["text", "voice", "face"],
            "user_management": True,
            "history_tracking": True,
            "error_handling": "enhanced"
        },
        "phases": [
            "1: Setup & Infrastructure",
            "2: Authentication & Users",
            "3: Text Emotion Detection",
            "4: Voice Emotion Detection",
            "5: Facial Emotion Detection",
            "6: AI Activity Recommendations",
            "7: History & Analytics",
            "8: Enhanced Error Handling"
        ]
    })


@app.get("/health", tags=["Health"])
async def health_check():
    """Detailed health check endpoint"""
    try:
        # Test database connection
        from utils.db import get_async_db
        db = get_async_db()
        await db.admin.command('ping')
        db_status = "healthy"
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        db_status = "unhealthy"

    # Test AI service
    try:
        from services.ai_recommendation_service import is_ai_available
        ai_status = "available" if is_ai_available() else "unavailable"
    except Exception as e:
        logger.error(f"AI service health check failed: {e}")
        ai_status = "error"

    health_data = {
        "status": "healthy" if db_status == "healthy" else "degraded",
        "timestamp": "2026-03-21T12:25:00Z",
        "services": {
            "database": db_status,
            "ai_recommendations": ai_status,
            "api": "healthy"
        },
        "version": "8.0.0",
        "environment": os.getenv("ENVIRONMENT", "development")
    }

    return success_response(health_data, "System health check completed")


# API Status endpoint for mobile app connectivity testing
@app.get("/api/status", tags=["Health"])
async def api_status():
    """API status for mobile app connectivity testing"""
    return success_response({
        "api_status": "operational",
        "version": "8.0.0",
        "endpoints_available": True,
        "ai_recommendations": True,
        "message": "API is ready to serve requests"
    })


# Include Routers with enhanced error handling
try:
    # Core API routes
    app.include_router(
        user_routes.router,
        prefix="/api/users",
        tags=["Authentication & Users"]
    )

    app.include_router(
        emotion_routes.router,
        prefix="/api/emotion",
        tags=["Emotion Detection"]
    )

    app.include_router(
        recommendation_routes.router,
        prefix="/api/recommendations",
        tags=["AI Recommendations"]
    )

    # Specialized emotion detection routes
    app.include_router(
        text_emotion_routes.router,
        prefix="/api/detect-text-emotion",
        tags=["Text Emotion Detection"]
    )

    app.include_router(
        voice_emotion_routes.router,
        prefix="/api/detect-voice-emotion",
        tags=["Voice Emotion Detection"]
    )

    app.include_router(
        face_emotion_routes.router,
        prefix="/api/detect-face-emotion",
        tags=["Face Emotion Detection"]
    )

    # Activity recommendation routes
    app.include_router(
        recommend_router,
        prefix="/api/recommend-activity",
        tags=["Activity Recommendations"]
    )

    # History and analytics
    app.include_router(
        history_router,
        prefix="/api/history",
        tags=["History & Analytics"]
    )

    # Legacy compatibility routes
    app.include_router(
        user_routes.router,
        prefix="",
        tags=["Legacy Auth"],
        include_in_schema=False
    )

    logger.info("✅ All API routes configured successfully")

except Exception as e:
    logger.error(f"❌ Failed to configure routes: {e}")
    raise


if __name__ == "__main__":
    try:
        import uvicorn

        # Get configuration from environment
        host = os.getenv("HOST", "0.0.0.0")
        port = int(os.getenv("PORT", 8000))
        debug = os.getenv("DEBUG", "True").lower() == "true"

        logger.info(f"🚀 Starting server on {host}:{port} (debug={debug})")

        uvicorn.run(
            "app:app",
            host=host,
            port=port,
            reload=debug,
            log_level="info" if debug else "warning"
        )

    except Exception as e:
        logger.error(f"❌ Failed to start server: {e}")
        raise
