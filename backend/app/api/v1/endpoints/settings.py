import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.llm import DEFAULT_GEMINI_MODEL_PRIORITY, normalize_model_priority
from app.db.session import get_db
from app.models.item import Item
from app.models.llm_setting import LLMSetting
from app.models.membership import Membership
from app.models.smtp_setting import SMTPSetting
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.setting import (
    LLMReprocessRequest,
    LLMReprocessResponse,
    LLMSettingsResponse,
    LLMSettingsUpdateRequest,
    SMTPSettingsResponse,
    SMTPSettingsUpdateRequest,
    SMTPTestRequest,
)
from app.services.activity import record_activity
from app.services.llm_enrichment import generate_tags_and_aliases
from app.services.secret_store import decrypt_secret, encrypt_secret, mask_secret
from app.services.smtp_mailer import SMTPConfigurationError, SMTPDeliveryError, send_smtp_message

router = APIRouter(prefix="/settings", tags=["settings"])
logger = logging.getLogger(__name__)

SMTP_DELIVERY_DETAILS = {
    "authentication": "El servidor SMTP rechazó las credenciales.",
    "connection": "No se pudo conectar con el servidor SMTP.",
    "timeout": "El servidor SMTP tardó demasiado en responder.",
    "delivery": "El servidor SMTP rechazó el mensaje.",
}


def _ensure_membership(db: Session, warehouse_id: str, user_id: str) -> None:
    membership = db.scalar(
        select(Membership).where(
            Membership.warehouse_id == warehouse_id,
            Membership.user_id == user_id,
        )
    )
    if membership is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No access to warehouse")


@router.get("/smtp", response_model=SMTPSettingsResponse)
def get_smtp_settings(
    warehouse_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SMTPSettingsResponse:
    _ensure_membership(db, warehouse_id, current_user.id)
    setting = db.scalar(select(SMTPSetting).where(SMTPSetting.warehouse_id == warehouse_id))
    if setting is None:
        return SMTPSettingsResponse(warehouse_id=warehouse_id, has_password=False)

    password_masked = None
    if setting.password_encrypted:
        try:
            password_masked = mask_secret(decrypt_secret(setting.password_encrypted))
        except Exception:  # noqa: BLE001
            password_masked = "***"

    return SMTPSettingsResponse(
        warehouse_id=warehouse_id,
        host=setting.host,
        port=setting.port,
        username=setting.username,
        encryption_mode=setting.encryption_mode,
        from_address=setting.from_address,
        from_name=setting.from_name,
        has_password=bool(setting.password_encrypted),
        password_masked=password_masked,
    )


@router.put("/smtp", response_model=SMTPSettingsResponse)
def update_smtp_settings(
    warehouse_id: str,
    payload: SMTPSettingsUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SMTPSettingsResponse:
    _ensure_membership(db, warehouse_id, current_user.id)
    setting = db.scalar(select(SMTPSetting).where(SMTPSetting.warehouse_id == warehouse_id))
    if setting is None:
        setting = SMTPSetting(
            warehouse_id=warehouse_id,
            host=payload.host,
            port=payload.port,
            username=payload.username,
            encryption_mode=payload.encryption_mode,
            from_address=payload.from_address,
            from_name=payload.from_name,
            updated_by=current_user.id,
        )
        db.add(setting)

    setting.host = payload.host
    setting.port = payload.port
    setting.username = payload.username
    setting.encryption_mode = payload.encryption_mode
    setting.from_address = payload.from_address
    setting.from_name = payload.from_name
    setting.updated_by = current_user.id
    if payload.password is not None:
        setting.password_encrypted = encrypt_secret(payload.password)

    record_activity(
        db,
        warehouse_id=warehouse_id,
        actor_user_id=current_user.id,
        event_type="settings.smtp.updated",
        entity_type="smtp_setting",
        entity_id=warehouse_id,
    )
    db.commit()
    return get_smtp_settings(warehouse_id=warehouse_id, current_user=current_user, db=db)


@router.post("/smtp/test", response_model=MessageResponse)
def test_smtp_settings(
    warehouse_id: str,
    payload: SMTPTestRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    _ensure_membership(db, warehouse_id, current_user.id)
    setting = db.scalar(select(SMTPSetting).where(SMTPSetting.warehouse_id == warehouse_id))
    if setting is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="SMTP settings not configured")

    try:
        send_smtp_message(
            setting,
            to_email=str(payload.to_email),
            subject="Prueba SMTP de My Warehouse",
            body="Tu configuración SMTP funciona correctamente.",
        )
    except SMTPConfigurationError:
        logger.warning("SMTP test rejected due to invalid configuration warehouse_id=%s", warehouse_id)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La configuración SMTP está incompleta o no es válida.",
        ) from None
    except SMTPDeliveryError as exc:
        logger.warning(
            "SMTP test delivery failed warehouse_id=%s failure=%s",
            warehouse_id,
            exc.code,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=SMTP_DELIVERY_DETAILS[exc.code],
        ) from None

    logger.info("SMTP test delivered warehouse_id=%s", warehouse_id)
    return MessageResponse(message=f"Correo de prueba enviado a {payload.to_email}.")


@router.get("/llm", response_model=LLMSettingsResponse)
def get_llm_settings(
    warehouse_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LLMSettingsResponse:
    _ensure_membership(db, warehouse_id, current_user.id)
    setting = db.scalar(select(LLMSetting).where(LLMSetting.warehouse_id == warehouse_id))
    if setting is None:
        return LLMSettingsResponse(
            warehouse_id=warehouse_id,
            provider="gemini",
            language="es",
            model_priority=list(DEFAULT_GEMINI_MODEL_PRIORITY),
            intake_parallelism=4,
            auto_tags_enabled=True,
            auto_alias_enabled=True,
            has_api_key=False,
            api_key_value=None,
        )

    api_key_value = None
    if setting.api_key_encrypted:
        try:
            api_key_value = decrypt_secret(setting.api_key_encrypted)
        except Exception:  # noqa: BLE001
            api_key_value = None

    return LLMSettingsResponse(
        warehouse_id=warehouse_id,
        provider=setting.provider,
        language=setting.language,
        model_priority=normalize_model_priority(setting.model_priority),
        intake_parallelism=max(1, min(int(getattr(setting, "intake_parallelism", 4) or 4), 8)),
        auto_tags_enabled=setting.auto_tags_enabled,
        auto_alias_enabled=setting.auto_alias_enabled,
        has_api_key=bool(setting.api_key_encrypted),
        api_key_value=api_key_value,
    )


@router.put("/llm", response_model=LLMSettingsResponse)
def update_llm_settings(
    warehouse_id: str,
    payload: LLMSettingsUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LLMSettingsResponse:
    _ensure_membership(db, warehouse_id, current_user.id)
    setting = db.scalar(select(LLMSetting).where(LLMSetting.warehouse_id == warehouse_id))
    if setting is None:
        setting = LLMSetting(
            warehouse_id=warehouse_id,
            provider=payload.provider,
            language=payload.language,
            model_priority=list(payload.model_priority),
            intake_parallelism=payload.intake_parallelism,
            auto_tags_enabled=payload.auto_tags_enabled,
            auto_alias_enabled=payload.auto_alias_enabled,
            updated_by=current_user.id,
        )
        db.add(setting)

    setting.provider = payload.provider
    setting.language = payload.language
    setting.model_priority = list(payload.model_priority)
    setting.intake_parallelism = payload.intake_parallelism
    setting.auto_tags_enabled = payload.auto_tags_enabled
    setting.auto_alias_enabled = payload.auto_alias_enabled
    setting.updated_by = current_user.id
    if payload.api_key is not None:
        setting.api_key_encrypted = encrypt_secret(payload.api_key)

    record_activity(
        db,
        warehouse_id=warehouse_id,
        actor_user_id=current_user.id,
        event_type="settings.llm.updated",
        entity_type="llm_setting",
        entity_id=warehouse_id,
    )
    db.commit()
    return get_llm_settings(warehouse_id=warehouse_id, current_user=current_user, db=db)


@router.post("/llm/reprocess-item/{item_id}", response_model=LLMReprocessResponse)
def reprocess_llm_item(
    item_id: str,
    warehouse_id: str,
    payload: LLMReprocessRequest | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LLMReprocessResponse:
    _ensure_membership(db, warehouse_id, current_user.id)
    item = db.scalar(
        select(Item).where(
            Item.id == item_id,
            Item.warehouse_id == warehouse_id,
            Item.deleted_at.is_(None),
        )
    )
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    llm_setting = db.scalar(select(LLMSetting).where(LLMSetting.warehouse_id == warehouse_id))
    if llm_setting is None or not llm_setting.api_key_encrypted:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="LLM settings not configured")

    fields = payload.fields if payload is not None else ["tags", "aliases"]
    if not fields:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields selected to reprocess")
    selected_fields = set(fields)

    try:
        api_key = decrypt_secret(llm_setting.api_key_encrypted)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid LLM API key") from exc

    tags, aliases = generate_tags_and_aliases(
        item.name,
        item.description,
        api_key=api_key,
        output_language=llm_setting.language,
        model_priority=normalize_model_priority(llm_setting.model_priority),
    )
    if "tags" in selected_fields:
        item.tags = tags
    if "aliases" in selected_fields:
        item.aliases = aliases
    item.version += 1

    record_activity(
        db,
        warehouse_id=warehouse_id,
        actor_user_id=current_user.id,
        event_type="llm.reprocess.item",
        entity_type="item",
        entity_id=item.id,
        metadata={
            "processed_fields": sorted(selected_fields),
            "tags_count": len(item.tags or []),
            "aliases_count": len(item.aliases or []),
        },
    )
    db.commit()
    return LLMReprocessResponse(
        message="Item reprocessed",
        item_id=item.id,
        processed_fields=sorted(selected_fields),
        tags=item.tags or [],
        aliases=item.aliases or [],
    )
