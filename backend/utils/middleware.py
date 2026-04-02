"""
Auth Middleware - FastAPI dependency for protected routes
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from utils.auth import decode_token
from utils.db import get_async_db

# Use HTTPBearer (accepts "Authorization: Bearer <token>" header)
bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
):
    """
    FastAPI dependency - extracts and verifies JWT, returns user document.
    Raises 401 if token is missing or invalid.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated. Please login or signup first.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not credentials:
        raise credentials_exception

    email = decode_token(credentials.credentials)
    if not email:
        raise credentials_exception

    db = get_async_db()
    user = await db["users"].find_one({"email": email, "is_active": True})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found or deactivated.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
):
    """
    Optional auth dependency - returns user if token is valid, else None.
    Used for endpoints that work both authenticated and anonymously.
    """
    if not credentials:
        return None
    email = decode_token(credentials.credentials)
    if not email:
        return None
    db = get_async_db()
    user = await db["users"].find_one({"email": email, "is_active": True})
    return user
