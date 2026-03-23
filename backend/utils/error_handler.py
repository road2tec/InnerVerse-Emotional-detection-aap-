"""
Enhanced Error Handler for FastAPI Backend
Prevents crashes and provides user-friendly error messages
"""

from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import logging
import traceback
from datetime import datetime
import os

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('error.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

class ErrorHandler:
    """Centralized error handling for the API"""

    @staticmethod
    def create_error_response(error_type: str, message: str, details: dict = None):
        """Create standardized error response"""
        return {
            "error": True,
            "error_type": error_type,
            "message": message,
            "details": details or {},
            "timestamp": datetime.utcnow().isoformat(),
            "success": False
        }

    @staticmethod
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        """Handle request validation errors"""
        logger.error(f"Validation error on {request.url}: {exc.errors()}")

        return JSONResponse(
            status_code=422,
            content=ErrorHandler.create_error_response(
                error_type="validation_error",
                message="Invalid request data",
                details={
                    "errors": exc.errors(),
                    "body": exc.body if hasattr(exc, 'body') else None
                }
            )
        )

    @staticmethod
    async def http_exception_handler(request: Request, exc: HTTPException):
        """Handle HTTP exceptions"""
        logger.error(f"HTTP error {exc.status_code} on {request.url}: {exc.detail}")

        return JSONResponse(
            status_code=exc.status_code,
            content=ErrorHandler.create_error_response(
                error_type="http_error",
                message=exc.detail,
                details={"status_code": exc.status_code}
            )
        )

    @staticmethod
    async def general_exception_handler(request: Request, exc: Exception):
        """Handle all other exceptions"""
        error_id = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

        logger.error(f"Unhandled error {error_id} on {request.url}: {str(exc)}")
        logger.error(traceback.format_exc())

        # Don't expose internal errors in production
        if os.getenv("DEBUG", "False").lower() == "true":
            message = str(exc)
            details = {
                "error_id": error_id,
                "exception_type": type(exc).__name__,
                "traceback": traceback.format_exc()
            }
        else:
            message = "Internal server error occurred"
            details = {"error_id": error_id}

        return JSONResponse(
            status_code=500,
            content=ErrorHandler.create_error_response(
                error_type="internal_error",
                message=message,
                details=details
            )
        )

    @staticmethod
    async def database_exception_handler(request: Request, exc: Exception):
        """Handle database-related errors"""
        logger.error(f"Database error on {request.url}: {str(exc)}")

        return JSONResponse(
            status_code=503,
            content=ErrorHandler.create_error_response(
                error_type="database_error",
                message="Database service temporarily unavailable",
                details={"retry_after": 30}
            )
        )

    @staticmethod
    async def ai_service_exception_handler(request: Request, exc: Exception):
        """Handle AI service errors"""
        logger.error(f"AI service error on {request.url}: {str(exc)}")

        return JSONResponse(
            status_code=503,
            content=ErrorHandler.create_error_response(
                error_type="ai_service_error",
                message="AI recommendation service temporarily unavailable. Using fallback recommendations.",
                details={
                    "fallback_available": True,
                    "service_status": "degraded"
                }
            )
        )

def setup_error_handlers(app):
    """Setup all error handlers for FastAPI app"""

    app.add_exception_handler(RequestValidationError, ErrorHandler.validation_exception_handler)
    app.add_exception_handler(HTTPException, ErrorHandler.http_exception_handler)
    app.add_exception_handler(Exception, ErrorHandler.general_exception_handler)

    logger.info("✅ Error handlers configured successfully")

# Utility functions for consistent error responses

def success_response(data, message="Success"):
    """Create standardized success response"""
    return {
        "success": True,
        "error": False,
        "message": message,
        "data": data,
        "timestamp": datetime.utcnow().isoformat()
    }

def error_response(message, error_type="error", status_code=400, details=None):
    """Create standardized error response for manual use"""
    return HTTPException(
        status_code=status_code,
        detail=ErrorHandler.create_error_response(error_type, message, details)
    )