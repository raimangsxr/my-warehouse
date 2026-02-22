import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from jose import jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def build_access_token(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=settings.access_token_minutes)
    payload = {"sub": user_id, "type": "access", "iat": int(now.timestamp()), "exp": int(exp.timestamp())}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def build_refresh_token(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    exp = now + timedelta(days=settings.refresh_token_days)
    # Include jti to avoid collisions when issuing multiple tokens in the same second.
    payload = {
        "sub": user_id,
        "type": "refresh",
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
        "jti": secrets.token_urlsafe(16),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
