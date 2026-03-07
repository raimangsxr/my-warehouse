import secrets

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.box import Box


def normalize_short_code(value: str) -> str:
    return value.strip().upper()


def short_code_in_use(db: Session, short_code: str, *, exclude_box_id: str | None = None) -> bool:
    normalized = normalize_short_code(short_code)
    query = select(Box.id).where(func.upper(Box.short_code) == normalized)
    if exclude_box_id:
        query = query.where(Box.id != exclude_box_id)
    return db.scalar(query) is not None


def generate_unique_short_code(db: Session, *, exclude_box_id: str | None = None, max_attempts: int = 32) -> str:
    for _ in range(max_attempts):
        short_code = f"BX-{secrets.token_hex(3).upper()}"
        if not short_code_in_use(db, short_code, exclude_box_id=exclude_box_id):
            return short_code
    raise RuntimeError("Failed to generate unique box short code")


def coerce_unique_short_code(
    db: Session,
    preferred_short_code: str | None = None,
    *,
    exclude_box_id: str | None = None,
) -> str:
    if preferred_short_code:
        normalized = normalize_short_code(preferred_short_code)
        if not short_code_in_use(db, normalized, exclude_box_id=exclude_box_id):
            return normalized
    return generate_unique_short_code(db, exclude_box_id=exclude_box_id)
