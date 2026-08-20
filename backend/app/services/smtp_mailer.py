from email.message import EmailMessage
from email.utils import formataddr
import smtplib
import socket
import ssl
from typing import Literal

from app.models.smtp_setting import SMTPSetting
from app.services.secret_store import decrypt_secret


SMTP_TIMEOUT_SECONDS = 10
SMTPErrorCode = Literal["authentication", "connection", "timeout", "delivery"]


class SMTPConfigurationError(ValueError):
    """The stored SMTP settings cannot be used safely."""


class SMTPDeliveryError(RuntimeError):
    """A sanitized SMTP failure safe to map to a user-facing category."""

    def __init__(self, code: SMTPErrorCode):
        self.code = code
        super().__init__(code)


def _password_for(setting: SMTPSetting) -> str | None:
    if not setting.username:
        return None
    if not setting.password_encrypted:
        raise SMTPConfigurationError("SMTP password is required when username is configured")
    try:
        return decrypt_secret(setting.password_encrypted)
    except Exception as exc:  # noqa: BLE001
        raise SMTPConfigurationError("SMTP password cannot be decrypted") from exc


def _message(
    setting: SMTPSetting,
    *,
    to_email: str,
    subject: str,
    body: str,
) -> EmailMessage:
    message = EmailMessage()
    message["From"] = (
        formataddr((setting.from_name, setting.from_address))
        if setting.from_name
        else setting.from_address
    )
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(body)
    return message


def send_smtp_message(
    setting: SMTPSetting,
    *,
    to_email: str,
    subject: str,
    body: str,
) -> None:
    if setting.encryption_mode not in {"starttls", "ssl", "none"}:
        raise SMTPConfigurationError("Unsupported SMTP encryption mode")
    if not setting.host or not setting.from_address:
        raise SMTPConfigurationError("SMTP settings are incomplete")

    password = _password_for(setting)
    try:
        message = _message(setting, to_email=to_email, subject=subject, body=body)
    except (TypeError, ValueError) as exc:
        raise SMTPConfigurationError("SMTP message headers are invalid") from exc

    try:
        if setting.encryption_mode == "ssl":
            client_context = smtplib.SMTP_SSL(
                setting.host,
                setting.port,
                timeout=SMTP_TIMEOUT_SECONDS,
                context=ssl.create_default_context(),
            )
        else:
            client_context = smtplib.SMTP(
                setting.host,
                setting.port,
                timeout=SMTP_TIMEOUT_SECONDS,
            )

        with client_context as client:
            if setting.encryption_mode == "starttls":
                client.ehlo()
                client.starttls(context=ssl.create_default_context())
                client.ehlo()
            if setting.username and password is not None:
                client.login(setting.username, password)
            client.send_message(message)
    except smtplib.SMTPAuthenticationError as exc:
        raise SMTPDeliveryError("authentication") from exc
    except (TimeoutError, socket.timeout) as exc:
        raise SMTPDeliveryError("timeout") from exc
    except (smtplib.SMTPConnectError, smtplib.SMTPServerDisconnected, OSError) as exc:
        raise SMTPDeliveryError("connection") from exc
    except smtplib.SMTPException as exc:
        raise SMTPDeliveryError("delivery") from exc
