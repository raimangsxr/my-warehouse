"""Tests for real SMTP invite email sending and the email_sent response field."""
from unittest.mock import MagicMock, patch


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def signup_and_login(client, email: str) -> dict[str, str]:
    client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "password123", "display_name": email.split("@")[0]},
    )
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "password123"})
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def create_warehouse(client, headers) -> str:
    res = client.post("/api/v1/warehouses", json={"name": "EmailTestWH"}, headers=headers)
    assert res.status_code == 201
    return res.json()["id"]


def configure_smtp(client, headers, warehouse_id: str) -> None:
    res = client.put(
        "/api/v1/settings/smtp",
        params={"warehouse_id": warehouse_id},
        json={
            "host": "smtp.example.com",
            "port": 587,
            "username": "user@example.com",
            "password": "smtp-secret",
            "encryption_mode": "starttls",
            "from_address": "noreply@example.com",
            "from_name": "My Warehouse",
        },
        headers=headers,
    )
    assert res.status_code == 200


# ---------------------------------------------------------------------------
# email_sent field in invite response
# ---------------------------------------------------------------------------

def test_invite_email_sent_true_when_smtp_configured(client):
    """email_sent=True when SMTP is configured and smtplib succeeds."""
    headers = signup_and_login(client, "inv-email-ok@example.com")
    warehouse_id = create_warehouse(client, headers)
    configure_smtp(client, headers, warehouse_id)

    with patch("smtplib.SMTP") as mock_smtp_cls:
        mock_smtp = MagicMock()
        mock_smtp_cls.return_value.__enter__ = MagicMock(return_value=mock_smtp)
        mock_smtp_cls.return_value.__exit__ = MagicMock(return_value=False)

        res = client.post(
            f"/api/v1/warehouses/{warehouse_id}/invites",
            json={"email": "guest@example.com"},
            headers=headers,
        )

    assert res.status_code == 201
    data = res.json()
    assert data["email_sent"] is True
    # sendmail was called with the correct recipient
    mock_smtp.sendmail.assert_called_once()
    call_args = mock_smtp.sendmail.call_args
    assert "guest@example.com" in call_args[0][1]


def test_invite_email_sent_false_when_no_smtp(client):
    """email_sent=False when no SMTP settings exist."""
    headers = signup_and_login(client, "inv-no-smtp@example.com")
    warehouse_id = create_warehouse(client, headers)

    res = client.post(
        f"/api/v1/warehouses/{warehouse_id}/invites",
        json={"email": "guest@example.com"},
        headers=headers,
    )
    assert res.status_code == 201
    assert res.json()["email_sent"] is False


def test_invite_email_sent_false_when_smtp_fails(client):
    """email_sent=False when SMTP connection fails; invite still created."""
    headers = signup_and_login(client, "inv-smtp-fail@example.com")
    warehouse_id = create_warehouse(client, headers)
    configure_smtp(client, headers, warehouse_id)

    with patch("smtplib.SMTP", side_effect=ConnectionRefusedError("refused")):
        res = client.post(
            f"/api/v1/warehouses/{warehouse_id}/invites",
            json={"email": "guest@example.com"},
            headers=headers,
        )

    assert res.status_code == 201
    data = res.json()
    assert data["email_sent"] is False
    assert data["invite_token"]  # invite was still created


def test_invite_email_sent_false_when_no_invitee_email(client):
    """email_sent=False when invite has no email (link-only invite)."""
    headers = signup_and_login(client, "inv-no-email@example.com")
    warehouse_id = create_warehouse(client, headers)
    configure_smtp(client, headers, warehouse_id)

    res = client.post(
        f"/api/v1/warehouses/{warehouse_id}/invites",
        json={},
        headers=headers,
    )
    assert res.status_code == 201
    assert res.json()["email_sent"] is False


# ---------------------------------------------------------------------------
# SMTP test endpoint
# ---------------------------------------------------------------------------

def test_smtp_test_endpoint_sends_real_email(client):
    """POST /settings/smtp/test actually calls smtplib when SMTP is configured."""
    headers = signup_and_login(client, "smtp-test-real@example.com")
    warehouse_id = create_warehouse(client, headers)
    configure_smtp(client, headers, warehouse_id)

    with patch("smtplib.SMTP") as mock_smtp_cls:
        mock_smtp = MagicMock()
        mock_smtp_cls.return_value.__enter__ = MagicMock(return_value=mock_smtp)
        mock_smtp_cls.return_value.__exit__ = MagicMock(return_value=False)

        res = client.post(
            "/api/v1/settings/smtp/test",
            params={"warehouse_id": warehouse_id},
            json={"to_email": "admin@example.com"},
            headers=headers,
        )

    assert res.status_code == 200
    assert res.json()["message"] == "Test email sent successfully"
    mock_smtp.sendmail.assert_called_once()
    call_args = mock_smtp.sendmail.call_args
    assert "admin@example.com" in call_args[0][1]


def test_smtp_test_endpoint_returns_400_when_not_configured(client):
    """POST /settings/smtp/test returns 400 when no SMTP settings exist."""
    headers = signup_and_login(client, "smtp-test-none@example.com")
    warehouse_id = create_warehouse(client, headers)

    res = client.post(
        "/api/v1/settings/smtp/test",
        params={"warehouse_id": warehouse_id},
        json={"to_email": "admin@example.com"},
        headers=headers,
    )
    assert res.status_code == 400
    assert "not configured" in res.json()["detail"].lower()


def test_smtp_test_endpoint_returns_400_on_connection_error(client):
    """POST /settings/smtp/test returns 400 with error detail on SMTP failure."""
    headers = signup_and_login(client, "smtp-test-fail@example.com")
    warehouse_id = create_warehouse(client, headers)
    configure_smtp(client, headers, warehouse_id)

    with patch("smtplib.SMTP", side_effect=ConnectionRefusedError("Connection refused")):
        res = client.post(
            "/api/v1/settings/smtp/test",
            params={"warehouse_id": warehouse_id},
            json={"to_email": "admin@example.com"},
            headers=headers,
        )

    assert res.status_code == 400
    assert res.json()["detail"]  # error message propagated


# ---------------------------------------------------------------------------
# send_test_email unit tests
# ---------------------------------------------------------------------------

def test_send_test_email_raises_when_no_setting():
    """send_test_email raises ValueError when no SMTP setting exists."""
    from app.services.email import send_test_email

    mock_db = MagicMock()
    mock_db.scalar.return_value = None

    try:
        send_test_email(mock_db, "wh-id", "test@example.com")
        assert False, "Should have raised"
    except ValueError as exc:
        assert "not configured" in str(exc).lower()


def test_send_test_email_raises_when_incomplete():
    """send_test_email raises ValueError when SMTP host is missing."""
    from app.services.email import send_test_email

    mock_setting = MagicMock()
    mock_setting.host = ""
    mock_setting.from_address = "noreply@example.com"
    mock_setting.password_encrypted = None

    mock_db = MagicMock()
    mock_db.scalar.return_value = mock_setting

    try:
        send_test_email(mock_db, "wh-id", "test@example.com")
        assert False, "Should have raised"
    except ValueError as exc:
        assert "incomplete" in str(exc).lower()
