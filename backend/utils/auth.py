"""
Authentication Utilities - Phase 2 Enhanced
JWT creation/verification + bcrypt password hashing
"""

import bcrypt
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
import os
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY: str = os.getenv("SECRET_KEY", "emotion-app-secret-key-2024-phase2")
ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60))


# ─── Password utilities ────────────────────────────────────────────────────────

def hash_password(plain_password: str) -> str:
    """Hash a plain-text password with bcrypt directly (bypassing passlib bugs)."""
    pwd_bytes = plain_password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain-text password against its bcrypt hash directly."""
    try:
        return bcrypt.checkpw(
            plain_password.encode('utf-8'),
            hashed_password.encode('utf-8')
        )
    except Exception:
        return False


# ─── JWT utilities ─────────────────────────────────────────────────────────────

def create_access_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    Create a signed JWT access token.
    Payload includes: sub (email), iat (issued at), exp (expiry).
    """
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({
        "iat": now,
        "exp": expire,
        "type": "access",
    })
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[str]:
    """
    Decode a JWT token and return the subject (email).
    Returns None if the token is invalid or expired.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: Optional[str] = payload.get("sub")
        token_type: Optional[str] = payload.get("type")
        if token_type != "access":
            return None
        return email
    except JWTError:
        return None


def get_token_expiry_seconds() -> int:
    """Return token lifetime in seconds."""
    return ACCESS_TOKEN_EXPIRE_MINUTES * 60
