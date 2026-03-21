"""Email service — sends invitation emails via SMTP when configured.

Errors are logged but never raised so that invite creation is never blocked.
"""

import logging
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.smtp_setting import SMTPSetting
from app.services.secret_store import decrypt_secret

logger = logging.getLogger(__name__)


def _get_smtp_setting(db: Session, warehouse_id: str) -> SMTPSetting | None:
    return db.scalar(select(SMTPSetting).where(SMTPSetting.warehouse_id == warehouse_id))


def _send_email(
    setting: SMTPSetting,
    to_email: str,
    subject: str,
    body_text: str,
    body_html: str,
    password: str | None,
) -> None:
    """Low-level SMTP send. Raises on any failure (caller decides how to handle)."""
    from_display = f"{setting.from_name} <{setting.from_address}>" if setting.from_name else setting.from_address

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_display
    msg["To"] = to_email
    msg.attach(MIMEText(body_text, "plain", "utf-8"))
    msg.attach(MIMEText(body_html, "html", "utf-8"))

    encryption_mode = (setting.encryption_mode or "starttls").lower()

    if encryption_mode == "ssl":
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(setting.host, setting.port, context=context) as smtp:
            if setting.username and password:
                smtp.login(setting.username, password)
            smtp.sendmail(setting.from_address, [to_email], msg.as_string())
    else:
        # starttls or none
        with smtplib.SMTP(setting.host, setting.port) as smtp:
            if encryption_mode == "starttls":
                smtp.starttls(context=ssl.create_default_context())
            if setting.username and password:
                smtp.login(setting.username, password)
            smtp.sendmail(setting.from_address, [to_email], msg.as_string())


def send_invite_email(
    db: Session,
    warehouse_id: str,
    warehouse_name: str,
    invitee_email: str,
    invite_url: str,
    invited_by_name: str | None = None,
) -> bool:
    """Send an invitation email.

    Returns True on success, False on any failure (error is logged, not raised).
    """
    setting = _get_smtp_setting(db, warehouse_id)
    if setting is None:
        logger.debug("No SMTP settings for warehouse_id=%s — skipping invite email", warehouse_id)
        return False

    if not setting.host or not setting.from_address:
        logger.debug("SMTP settings incomplete for warehouse_id=%s — skipping invite email", warehouse_id)
        return False

    try:
        password: str | None = None
        if setting.password_encrypted:
            try:
                password = decrypt_secret(setting.password_encrypted)
            except Exception:  # noqa: BLE001
                logger.error(
                    "Failed to decrypt SMTP password for warehouse_id=%s — skipping invite email",
                    warehouse_id,
                )
                return False

        inviter_label = invited_by_name or "Un miembro"
        subject = f"Invitación al almacén «{warehouse_name}»"
        body_text = (
            f"{inviter_label} te ha invitado a unirte al almacén «{warehouse_name}».\n\n"
            f"Acepta la invitación aquí:\n{invite_url}\n\n"
            "Este enlace expira según la configuración de la invitación."
        )
        body_html = (
            f"<p>{inviter_label} te ha invitado a unirte al almacén <strong>{warehouse_name}</strong>.</p>"
            f'<p><a href="{invite_url}">Aceptar invitación</a></p>'
            f"<p>O copia este enlace en tu navegador:<br><code>{invite_url}</code></p>"
            "<p><small>Este enlace expira según la configuración de la invitación.</small></p>"
        )

        _send_email(setting, invitee_email, subject, body_text, body_html, password)

        logger.info("Invite email sent warehouse_id=%s to=%s", warehouse_id, invitee_email)
        return True

    except Exception as exc:  # noqa: BLE001
        logger.error(
            "Failed to send invite email warehouse_id=%s to=%s error=%s",
            warehouse_id,
            invitee_email,
            exc,
        )
        return False


def send_test_email(db: Session, warehouse_id: str, to_email: str) -> None:
    """Send a test email to verify SMTP configuration.

    Raises ValueError if settings are missing/incomplete.
    Raises any smtplib/socket exception on delivery failure.
    """
    setting = _get_smtp_setting(db, warehouse_id)
    if setting is None:
        raise ValueError("SMTP settings not configured")
    if not setting.host or not setting.from_address:
        raise ValueError("SMTP settings incomplete")

    password: str | None = None
    if setting.password_encrypted:
        password = decrypt_secret(setting.password_encrypted)

    subject = "Test de configuración SMTP — my-warehouse"
    body_text = "Este es un email de prueba enviado desde my-warehouse para verificar la configuración SMTP."
    body_html = (
        "<p>Este es un email de prueba enviado desde <strong>my-warehouse</strong> "
        "para verificar la configuración SMTP.</p>"
    )

    _send_email(setting, to_email, subject, body_text, body_html, password)
    logger.info("Test email sent warehouse_id=%s to=%s", warehouse_id, to_email)
