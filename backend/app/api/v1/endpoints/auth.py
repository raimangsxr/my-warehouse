from datetime import UTC, datetime, timedelta
import logging
import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.password_reset_token import PasswordResetToken
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    RefreshRequest,
    ResetPasswordRequest,
    SignupRequest,
    TokenResponse,
    UserResponse,
)
from app.schemas.common import MessageResponse
from app.services.security import (
    build_access_token,
    build_refresh_token,
    decode_token,
    hash_password,
    hash_token,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)


def utcnow() -> datetime:
    # SQLite retorna datetimes naive; usamos UTC naive consistente en bootstrap local.
    return datetime.now(UTC).replace(tzinfo=None)


@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, db: Session = Depends(get_db)) -> UserResponse:
    normalized_email = payload.email.lower()
    logger.debug("Signup requested email=%s", normalized_email)
    exists = db.scalar(select(User).where(User.email == normalized_email))
    if exists:
        logger.info("Signup rejected: email already exists email=%s", normalized_email)
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")

    user = User(
        email=normalized_email,
        password_hash=hash_password(payload.password),
        display_name=payload.display_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info("User signup completed user_id=%s email=%s", user.id, user.email)
    return UserResponse.model_validate(user)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    normalized_email = payload.email.lower()
    logger.debug("Login requested email=%s", normalized_email)
    user = db.scalar(select(User).where(User.email == normalized_email))
    if user is None or not verify_password(payload.password, user.password_hash):
        logger.info("Login rejected for email=%s", normalized_email)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    access_token = build_access_token(user.id)
    refresh_token = build_refresh_token(user.id)
    token_row = RefreshToken(
        user_id=user.id,
        token_hash=hash_token(refresh_token),
        expires_at=utcnow() + timedelta(days=settings.refresh_token_days),
    )
    db.add(token_row)
    db.commit()
    logger.info("Login successful user_id=%s", user.id)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)) -> TokenResponse:
    logger.debug("Refresh token requested")
    try:
        token_payload = decode_token(payload.refresh_token)
    except Exception as exc:  # noqa: BLE001
        logger.info("Refresh rejected: token decode failed")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token") from exc

    if token_payload.get("type") != "refresh":
        logger.info("Refresh rejected: invalid token type type=%s", token_payload.get("type"))
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token type")

    token_hash_value = hash_token(payload.refresh_token)
    stored = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash_value))
    if stored is None or stored.revoked or stored.expires_at < utcnow():
        logger.info("Refresh rejected: token expired/revoked")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired")

    stored.revoked = True
    access_token = build_access_token(stored.user_id)
    new_refresh = build_refresh_token(stored.user_id)
    db.add(
        RefreshToken(
            user_id=stored.user_id,
            token_hash=hash_token(new_refresh),
            expires_at=utcnow() + timedelta(days=settings.refresh_token_days),
        )
    )
    db.commit()
    logger.info("Refresh successful user_id=%s", stored.user_id)
    return TokenResponse(access_token=access_token, refresh_token=new_refresh)


@router.post("/logout", response_model=MessageResponse)
def logout(payload: RefreshRequest, db: Session = Depends(get_db)) -> MessageResponse:
    token_hash_value = hash_token(payload.refresh_token)
    db.execute(update(RefreshToken).where(RefreshToken.token_hash == token_hash_value).values(revoked=True))
    db.commit()
    logger.info("Logout completed: refresh token revoked")
    return MessageResponse(message="Logged out")


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)) -> ForgotPasswordResponse:
    normalized_email = payload.email.lower()
    logger.debug("Forgot-password requested email=%s", normalized_email)
    user = db.scalar(select(User).where(User.email == normalized_email))
    if user is None:
        logger.info("Forgot-password requested for non-existing email=%s", normalized_email)
        return ForgotPasswordResponse(message="If the email exists, reset instructions were generated")

    raw_token = secrets.token_urlsafe(32)
    token_hash_value = hash_token(raw_token)
    db.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash_value,
            expires_at=utcnow() + timedelta(hours=1),
        )
    )
    db.commit()
    logger.info("Forgot-password token issued user_id=%s", user.id)

    # Dev bootstrap: expose token until SMTP flow is fully wired.
    return ForgotPasswordResponse(
        message="Reset token generated",
        reset_token=raw_token,
    )


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)) -> MessageResponse:
    token_hash_value = hash_token(payload.token)
    reset_token = db.scalar(
        select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash_value)
    )

    if reset_token is None or reset_token.used or reset_token.expires_at < utcnow():
        logger.info("Reset-password rejected: invalid or expired token")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token")

    user = db.scalar(select(User).where(User.id == reset_token.user_id))
    if user is None:
        logger.info("Reset-password rejected: user not found user_id=%s", reset_token.user_id)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.password_hash = hash_password(payload.new_password)
    reset_token.used = True
    db.execute(update(RefreshToken).where(RefreshToken.user_id == user.id).values(revoked=True))
    db.commit()
    logger.info("Password reset completed user_id=%s", user.id)
    return MessageResponse(message="Password reset successfully")


@router.post("/change-password", response_model=MessageResponse)
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    logger.debug("Change-password requested user_id=%s", current_user.id)
    if not verify_password(payload.current_password, current_user.password_hash):
        logger.info("Change-password rejected: current password mismatch user_id=%s", current_user.id)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")

    current_user.password_hash = hash_password(payload.new_password)
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == current_user.id)
        .values(revoked=True)
    )
    db.commit()
    logger.info("Password changed user_id=%s", current_user.id)
    return MessageResponse(message="Password changed")


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)) -> UserResponse:
    logger.debug("User profile requested user_id=%s", current_user.id)
    return UserResponse.model_validate(current_user)
