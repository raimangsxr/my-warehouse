from datetime import UTC, datetime, timedelta
import logging
import secrets

from fastapi import APIRouter, Body, Depends, HTTPException, Request, Response, status
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
from app.utils.datetime import ensure_utc, utcnow

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)

def _refresh_days(remember_me: bool) -> int:
    return settings.persistent_login_days if remember_me else settings.refresh_token_days


def _persistent_token_expires_at() -> datetime:
    return datetime.max.replace(tzinfo=UTC)


def _refresh_cookie_path() -> str:
    return f"{settings.api_v1_prefix}/auth"


def _set_refresh_cookie(response: Response, refresh_token: str, remember_me: bool) -> None:
    max_age = _refresh_days(remember_me) * 24 * 60 * 60
    response.set_cookie(
        key=settings.auth_cookie_name,
        value=refresh_token,
        max_age=max_age,
        expires=max_age,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite=settings.auth_cookie_samesite,
        path=_refresh_cookie_path(),
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.auth_cookie_name,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite=settings.auth_cookie_samesite,
        path=_refresh_cookie_path(),
    )


def _issue_token_pair(db: Session, user_id: str, remember_me: bool) -> TokenResponse:
    access_token = build_access_token(user_id, remember_me=remember_me)
    refresh_token = build_refresh_token(user_id, expires_in_days=_refresh_days(remember_me))
    if remember_me:
        db.add(
            RefreshToken(
                user_id=user_id,
                token_hash=hash_token(access_token),
                expires_at=_persistent_token_expires_at(),
            )
        )
    db.add(
        RefreshToken(
            user_id=user_id,
            token_hash=hash_token(refresh_token),
            expires_at=utcnow() + timedelta(days=_refresh_days(remember_me)),
        )
    )
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


def _extract_bearer_token(request: Request) -> str | None:
    authorization = request.headers.get("authorization", "").strip()
    if not authorization.lower().startswith("bearer "):
        return None
    return authorization[7:].strip() or None


def _revoke_token_values(db: Session, token_values: set[str]) -> None:
    if not token_values:
        return
    token_hashes = [hash_token(token) for token in token_values]
    db.execute(update(RefreshToken).where(RefreshToken.token_hash.in_(token_hashes)).values(revoked=True))


def _resolve_refresh_token(request: Request, payload: RefreshRequest | None) -> tuple[str | None, bool]:
    cookie_token = request.cookies.get(settings.auth_cookie_name)
    body_token = payload.refresh_token if payload else None
    remember_me = bool(cookie_token or (payload and payload.remember_me))
    return cookie_token or body_token, remember_me


@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, db: Session = Depends(get_db)) -> UserResponse:
    normalized_email = payload.email.lower()
    logger.debug("Signup requested email=%s", normalized_email)
    exists = db.scalar(select(User).where(User.email == normalized_email))
    if exists:
        logger.error("Signup rejected: email already exists email=%s", normalized_email)
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
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)) -> TokenResponse:
    normalized_email = payload.email.lower()
    logger.debug("Login requested email=%s", normalized_email)
    user = db.scalar(select(User).where(User.email == normalized_email))
    if user is None or not verify_password(payload.password, user.password_hash):
        logger.error("Login rejected for email=%s", normalized_email)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    tokens = _issue_token_pair(db, user.id, payload.remember_me)
    db.commit()
    if payload.remember_me:
        _set_refresh_cookie(response, tokens.refresh_token, remember_me=True)
    else:
        _clear_refresh_cookie(response)
    logger.info("Login successful user_id=%s", user.id)
    return tokens


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    request: Request,
    response: Response,
    payload: RefreshRequest | None = Body(default=None),
    db: Session = Depends(get_db),
) -> TokenResponse:
    logger.debug("Refresh token requested")
    refresh_token_value, remember_me = _resolve_refresh_token(request, payload)
    if not refresh_token_value:
        logger.error("Refresh rejected: no refresh token provided")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token required")

    try:
        token_payload = decode_token(refresh_token_value)
    except Exception as exc:  # noqa: BLE001
        logger.error("Refresh rejected: token decode failed")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token") from exc

    if token_payload.get("type") != "refresh":
        logger.error("Refresh rejected: invalid token type type=%s", token_payload.get("type"))
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token type")

    token_hash_value = hash_token(refresh_token_value)
    stored = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash_value))
    if stored is None or stored.revoked or ensure_utc(stored.expires_at) < utcnow():
        logger.error("Refresh rejected: token expired/revoked")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired")

    _revoke_token_values(
        db,
        {
            refresh_token_value,
            *([token] if (token := _extract_bearer_token(request)) else []),
        },
    )
    tokens = _issue_token_pair(db, stored.user_id, remember_me)
    db.commit()
    if remember_me:
        _set_refresh_cookie(response, tokens.refresh_token, remember_me=True)
    else:
        _clear_refresh_cookie(response)
    logger.info("Refresh successful user_id=%s", stored.user_id)
    return tokens


@router.post("/logout", response_model=MessageResponse)
def logout(
    request: Request,
    response: Response,
    payload: RefreshRequest | None = Body(default=None),
    db: Session = Depends(get_db),
) -> MessageResponse:
    token_values = {
        token
        for token in (
            payload.refresh_token if payload else None,
            request.cookies.get(settings.auth_cookie_name),
            _extract_bearer_token(request),
        )
        if token
    }
    _revoke_token_values(db, token_values)
    db.commit()
    _clear_refresh_cookie(response)
    logger.info("Logout completed: refresh token revoked")
    return MessageResponse(message="Logged out")


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)) -> ForgotPasswordResponse:
    normalized_email = payload.email.lower()
    logger.debug("Forgot-password requested email=%s", normalized_email)
    user = db.scalar(select(User).where(User.email == normalized_email))
    if user is None:
        logger.error("Forgot-password requested for non-existing email=%s", normalized_email)
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

    if reset_token is None or reset_token.used or ensure_utc(reset_token.expires_at) < utcnow():
        logger.error("Reset-password rejected: invalid or expired token")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token")

    user = db.scalar(select(User).where(User.id == reset_token.user_id))
    if user is None:
        logger.error("Reset-password rejected: user not found user_id=%s", reset_token.user_id)
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
        logger.error("Change-password rejected: current password mismatch user_id=%s", current_user.id)
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
