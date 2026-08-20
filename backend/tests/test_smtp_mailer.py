import smtplib
from types import SimpleNamespace

import pytest

from app.services import smtp_mailer


class FakeSMTP:
    def __init__(self, host, port, timeout):
        self.host = host
        self.port = port
        self.timeout = timeout
        self.ehlo_count = 0
        self.starttls_context = None
        self.login_args = None
        self.message = None

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def ehlo(self):
        self.ehlo_count += 1

    def starttls(self, *, context):
        self.starttls_context = context

    def login(self, username, password):
        self.login_args = (username, password)

    def send_message(self, message):
        self.message = message


def smtp_setting(**overrides):
    values = {
        "host": "smtp.example.com",
        "port": 587,
        "username": "mailer",
        "password_encrypted": "encrypted-password",
        "encryption_mode": "starttls",
        "from_address": "noreply@example.com",
        "from_name": "My Warehouse",
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_send_message_uses_starttls_auth_and_expected_headers(monkeypatch):
    fake = FakeSMTP("unused", 0, 0)
    monkeypatch.setattr(smtp_mailer.smtplib, "SMTP", lambda *args, **kwargs: fake)
    monkeypatch.setattr(smtp_mailer, "decrypt_secret", lambda value: "plain-secret")

    smtp_mailer.send_smtp_message(
        smtp_setting(),
        to_email="guest@example.com",
        subject="Invitación",
        body="Abre https://app.example/invites/token",
    )

    assert fake.starttls_context is not None
    assert fake.ehlo_count == 2
    assert fake.login_args == ("mailer", "plain-secret")
    assert fake.message["From"] == "My Warehouse <noreply@example.com>"
    assert fake.message["To"] == "guest@example.com"
    assert fake.message["Subject"] == "Invitación"
    assert "https://app.example/invites/token" in fake.message.get_content()


def test_send_message_uses_implicit_ssl_without_starttls(monkeypatch):
    fake = FakeSMTP("unused", 0, 0)
    monkeypatch.setattr(smtp_mailer.smtplib, "SMTP_SSL", lambda *args, **kwargs: fake)
    monkeypatch.setattr(smtp_mailer, "decrypt_secret", lambda value: "plain-secret")

    smtp_mailer.send_smtp_message(
        smtp_setting(encryption_mode="ssl", port=465),
        to_email="target@example.com",
        subject="Test",
        body="Body",
    )

    assert fake.starttls_context is None
    assert fake.login_args == ("mailer", "plain-secret")
    assert fake.message["To"] == "target@example.com"


def test_send_message_supports_plain_transport_without_auth(monkeypatch):
    fake = FakeSMTP("unused", 0, 0)
    monkeypatch.setattr(smtp_mailer.smtplib, "SMTP", lambda *args, **kwargs: fake)

    smtp_mailer.send_smtp_message(
        smtp_setting(
            encryption_mode="none",
            username=None,
            password_encrypted=None,
            from_name=None,
        ),
        to_email="target@example.com",
        subject="Test",
        body="Body",
    )

    assert fake.starttls_context is None
    assert fake.login_args is None
    assert fake.message["From"] == "noreply@example.com"


def test_send_message_sanitizes_authentication_failure(monkeypatch):
    class AuthenticationFailureSMTP(FakeSMTP):
        def login(self, username, password):
            raise smtplib.SMTPAuthenticationError(535, b"secret provider response")

    fake = AuthenticationFailureSMTP("unused", 0, 0)
    monkeypatch.setattr(smtp_mailer.smtplib, "SMTP", lambda *args, **kwargs: fake)
    monkeypatch.setattr(smtp_mailer, "decrypt_secret", lambda value: "plain-secret")

    with pytest.raises(smtp_mailer.SMTPDeliveryError) as exc_info:
        smtp_mailer.send_smtp_message(
            smtp_setting(),
            to_email="target@example.com",
            subject="Test",
            body="Body",
        )

    assert exc_info.value.code == "authentication"
    assert "secret" not in str(exc_info.value).lower()


def test_send_message_rejects_username_without_password():
    with pytest.raises(smtp_mailer.SMTPConfigurationError):
        smtp_mailer.send_smtp_message(
            smtp_setting(password_encrypted=None),
            to_email="target@example.com",
            subject="Test",
            body="Body",
        )
