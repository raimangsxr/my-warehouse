from sqlalchemy.orm import Session

from app.models.change_log import ChangeLog


def append_change_log(
    db: Session,
    *,
    warehouse_id: str,
    entity_type: str,
    action: str,
    entity_id: str | None = None,
    entity_version: int | None = None,
    payload: dict | None = None,
) -> ChangeLog:
    entry = ChangeLog(
        warehouse_id=warehouse_id,
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        entity_version=entity_version,
        payload_json=payload or {},
    )
    db.add(entry)
    return entry
