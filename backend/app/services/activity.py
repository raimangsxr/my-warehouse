from sqlalchemy.orm import Session

from app.models.activity_event import ActivityEvent


def record_activity(
    db: Session,
    *,
    warehouse_id: str,
    actor_user_id: str,
    event_type: str,
    entity_type: str | None = None,
    entity_id: str | None = None,
    metadata: dict | None = None,
) -> None:
    db.add(
        ActivityEvent(
            warehouse_id=warehouse_id,
            actor_user_id=actor_user_id,
            event_type=event_type,
            entity_type=entity_type,
            entity_id=entity_id,
            metadata_json=metadata or {},
        )
    )
