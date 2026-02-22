import base64
import hashlib

from jose import jwe

from app.core.config import settings


def _encryption_key_bytes() -> bytes:
    raw = f"{settings.secret_encryption_key}:{settings.jwt_secret}".encode("utf-8")
    return hashlib.sha256(raw).digest()


def encrypt_secret(plain_text: str) -> str:
    token_bytes = jwe.encrypt(plain_text, _encryption_key_bytes(), algorithm="dir", encryption="A256GCM")
    if isinstance(token_bytes, bytes):
        return token_bytes.decode("utf-8")
    return str(token_bytes)


def decrypt_secret(cipher_text: str) -> str:
    plain_bytes = jwe.decrypt(cipher_text, _encryption_key_bytes())
    if isinstance(plain_bytes, bytes):
        return plain_bytes.decode("utf-8")
    return str(plain_bytes)


def mask_secret(value: str | None) -> str | None:
    if not value:
        return None
    if len(value) <= 4:
        return "*" * len(value)
    return f"{value[:2]}{'*' * (len(value) - 4)}{value[-2:]}"


def is_encrypted(value: str | None) -> bool:
    if not value:
        return False
    try:
        base64.urlsafe_b64decode(value.split(".")[0] + "==")
        return value.count(".") >= 4
    except Exception:  # noqa: BLE001
        return False
