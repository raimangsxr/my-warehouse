from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.membership import Membership
from app.models.user import User
from app.services.security import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.api_v1_prefix}/auth/login")


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
            raise credentials_exception
    except JWTError as exc:
        raise credentials_exception from exc

    user = db.scalar(select(User).where(User.id == user_id))
    if user is None:
        raise credentials_exception
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
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No access to warehouse")
    return membership
