def signup_and_login(client, email: str) -> dict[str, str]:
    client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "password123", "display_name": email.split("@")[0]},
    )
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "password123"})
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def create_warehouse(client, headers) -> str:
    res = client.post("/api/v1/warehouses", json={"name": "Shared"}, headers=headers)
    assert res.status_code == 201
    return res.json()["id"]


def test_invites_acceptance_and_membership(client):
    owner_headers = signup_and_login(client, "owner-s5@example.com")
    guest_headers = signup_and_login(client, "guest-s5@example.com")
    warehouse_id = create_warehouse(client, owner_headers)

    invite = client.post(
        f"/api/v1/warehouses/{warehouse_id}/invites",
        json={"email": "guest-s5@example.com"},
        headers=owner_headers,
    )
    assert invite.status_code == 201
    invite_token = invite.json()["invite_token"]
    assert invite_token

    accept = client.post(f"/api/v1/invites/{invite_token}/accept", headers=guest_headers)
    assert accept.status_code == 200
    assert accept.json()["warehouse_id"] == warehouse_id

    guest_warehouses = client.get("/api/v1/warehouses", headers=guest_headers)
    assert guest_warehouses.status_code == 200
    assert any(row["id"] == warehouse_id for row in guest_warehouses.json())

    reuse = client.post(f"/api/v1/invites/{invite_token}/accept", headers=guest_headers)
    assert reuse.status_code == 400


def test_activity_and_trash_restore_events(client):
    headers = signup_and_login(client, "activity-s5@example.com")
    warehouse_id = create_warehouse(client, headers)

    box_res = client.post(
        f"/api/v1/warehouses/{warehouse_id}/boxes",
        json={"name": "TrashBox"},
        headers=headers,
    )
    assert box_res.status_code == 201
    box = box_res.json()

    item_res = client.post(
        f"/api/v1/warehouses/{warehouse_id}/items",
        json={"box_id": box["id"], "name": "Old Lamp"},
        headers=headers,
    )
    assert item_res.status_code == 201
    item = item_res.json()

    delete_item = client.delete(f"/api/v1/warehouses/{warehouse_id}/items/{item['id']}", headers=headers)
    assert delete_item.status_code == 200

    deleted_items = client.get(
        f"/api/v1/warehouses/{warehouse_id}/items",
        params={"include_deleted": True},
        headers=headers,
    )
    assert deleted_items.status_code == 200
    assert any(row["id"] == item["id"] and row["deleted_at"] is not None for row in deleted_items.json())

    restore_item = client.post(f"/api/v1/warehouses/{warehouse_id}/items/{item['id']}/restore", headers=headers)
    assert restore_item.status_code == 200
    assert restore_item.json()["deleted_at"] is None

    activity = client.get(f"/api/v1/warehouses/{warehouse_id}/activity", headers=headers)
    assert activity.status_code == 200
    event_types = [row["event_type"] for row in activity.json()]
    assert "item.deleted" in event_types
    assert "item.restored" in event_types


# ---------------------------------------------------------------------------
# Email service tests
# ---------------------------------------------------------------------------

def test_invite_sends_email_when_smtp_configured(client, monkeypatch):
    """When SMTP is configured, creating an invite should trigger send_invite_email."""
    from app.api.v1.endpoints import warehouses as wh_endpoint

    sent_calls: list[dict] = []

    def fake_send(db, warehouse_id, warehouse_name, invitee_email, invite_url, invited_by_name=None):
        sent_calls.append(
            {
                "warehouse_id": warehouse_id,
                "invitee_email": invitee_email,
                "invite_url": invite_url,
            }
        )
        return True

    monkeypatch.setattr(wh_endpoint, "send_invite_email", fake_send)

    owner_headers = signup_and_login(client, "email-owner@example.com")
    warehouse_id = create_warehouse(client, owner_headers)

    invite = client.post(
        f"/api/v1/warehouses/{warehouse_id}/invites",
        json={"email": "guest-email@example.com"},
        headers=owner_headers,
    )
    assert invite.status_code == 201
    data = invite.json()
    assert "invite_url" in data

    # Email service was called once with correct args
    assert len(sent_calls) == 1
    assert sent_calls[0]["warehouse_id"] == warehouse_id
    assert sent_calls[0]["invitee_email"] == "guest-email@example.com"
    assert sent_calls[0]["invite_url"] == data["invite_url"]


def test_invite_succeeds_even_when_email_fails(client, monkeypatch):
    """A failing email send must not prevent the invite from being created."""
    from app.api.v1.endpoints import warehouses as wh_endpoint

    def failing_send(*args, **kwargs):
        return False  # simulates SMTP failure

    monkeypatch.setattr(wh_endpoint, "send_invite_email", failing_send)

    owner_headers = signup_and_login(client, "email-fail-owner@example.com")
    warehouse_id = create_warehouse(client, owner_headers)

    invite = client.post(
        f"/api/v1/warehouses/{warehouse_id}/invites",
        json={"email": "guest-fail@example.com"},
        headers=owner_headers,
    )
    assert invite.status_code == 201
    assert invite.json()["invite_token"]


def test_invite_without_email_skips_send(client, monkeypatch):
    """When no invitee email is provided, send_invite_email should not be called."""
    from app.api.v1.endpoints import warehouses as wh_endpoint

    sent_calls: list[dict] = []

    def fake_send(*args, **kwargs):
        sent_calls.append({})
        return True

    monkeypatch.setattr(wh_endpoint, "send_invite_email", fake_send)

    owner_headers = signup_and_login(client, "email-noemail-owner@example.com")
    warehouse_id = create_warehouse(client, owner_headers)

    invite = client.post(
        f"/api/v1/warehouses/{warehouse_id}/invites",
        json={},  # no email field
        headers=owner_headers,
    )
    assert invite.status_code == 201
    assert len(sent_calls) == 0


def test_email_service_no_smtp_returns_false():
    """send_invite_email returns False when no SMTP settings exist for the warehouse."""
    from unittest.mock import MagicMock

    from app.services.email import send_invite_email

    mock_db = MagicMock()
    mock_db.scalar.return_value = None  # no SMTP setting

    result = send_invite_email(
        db=mock_db,
        warehouse_id="nonexistent-wh",
        warehouse_name="Test WH",
        invitee_email="someone@example.com",
        invite_url="http://localhost:4200/invites/abc",
    )
    assert result is False


def test_email_service_incomplete_smtp_returns_false():
    """send_invite_email returns False when SMTP host is missing."""
    from unittest.mock import MagicMock

    from app.services.email import send_invite_email

    mock_setting = MagicMock()
    mock_setting.host = ""
    mock_setting.from_address = "noreply@example.com"

    mock_db = MagicMock()
    mock_db.scalar.return_value = mock_setting

    result = send_invite_email(
        db=mock_db,
        warehouse_id="wh-id",
        warehouse_name="Test WH",
        invitee_email="someone@example.com",
        invite_url="http://localhost:4200/invites/abc",
    )
    assert result is False
