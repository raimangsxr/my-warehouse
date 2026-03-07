import logging

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.membership import Membership
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.services.security import decode_token, hash_token
from app.utils.datetime import ensure_utc, utcnow

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.api_v1_prefix}/auth/login")
logger = logging.getLogger(__name__)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )
    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        token_type = payload.get("type")
        if not user_id or token_type != "access":
            logger.error("Invalid access token payload sub=%s type=%s", user_id, token_type)
            raise credentials_exception
        if payload.get("remember_me"):
            stored = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_token(token)))
            if stored is None or stored.revoked or ensure_utc(stored.expires_at) < utcnow():
                logger.error("Persistent access token revoked or missing user_id=%s", user_id)
                raise credentials_exception
        logger.debug("Access token decoded for user_id=%s", user_id)
    except JWTError as exc:
        logger.error("JWT validation failed while resolving current user")
        raise credentials_exception from exc

    user = db.scalar(select(User).where(User.id == user_id))
    if user is None:
        logger.error("Access token sub=%s references missing user", user_id)
        raise credentials_exception
    logger.debug("Resolved authenticated user user_id=%s", user.id)
    return user


def require_warehouse_membership(
    warehouse_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Membership:
    membership = db.scalar(
        select(Membership).where(
            Membership.warehouse_id == warehouse_id,
            Membership.user_id == current_user.id,
        )
    )
    if membership is None:
        logger.error(
            "Warehouse access denied warehouse_id=%s user_id=%s",
            warehouse_id,
            current_user.id,
        )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No access to warehouse")
    logger.debug(
        "Warehouse membership validated warehouse_id=%s user_id=%s",
        warehouse_id,
        current_user.id,
    )
    return membership
