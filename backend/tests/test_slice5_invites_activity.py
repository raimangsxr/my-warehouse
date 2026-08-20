from datetime import UTC, datetime


def signup_and_login(client, email: str) -> dict[str, str]:
    client.post(
        "/api/auth/signup",
        json={"email": email, "password": "password123", "display_name": email.split("@")[0]},
    )
    login = client.post("/api/auth/login", json={"email": email, "password": "password123"})
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def create_warehouse(client, headers) -> str:
    res = client.post("/api/warehouses", json={"name": "Shared"}, headers=headers)
    assert res.status_code == 201
    return res.json()["id"]


def test_invites_acceptance_and_membership(client):
    owner_headers = signup_and_login(client, "owner-s5@example.com")
    guest_headers = signup_and_login(client, "guest-s5@example.com")
    warehouse_id = create_warehouse(client, owner_headers)

    invite = client.post(
        f"/api/warehouses/{warehouse_id}/invites",
        json={"email": "guest-s5@example.com"},
        headers=owner_headers,
    )
    assert invite.status_code == 201
    assert invite.json()["email_delivery_status"] == "not_configured"
    invite_token = invite.json()["invite_token"]
    assert invite_token

    accept = client.post(f"/api/invites/{invite_token}/accept", headers=guest_headers)
    assert accept.status_code == 200
    assert accept.json()["warehouse_id"] == warehouse_id

    guest_warehouses = client.get("/api/warehouses", headers=guest_headers)
    assert guest_warehouses.status_code == 200
    assert any(row["id"] == warehouse_id for row in guest_warehouses.json())

    reuse = client.post(f"/api/invites/{invite_token}/accept", headers=guest_headers)
    assert reuse.status_code == 400


def test_invite_sends_email_with_usable_link(client, monkeypatch):
    from app.api.v1.endpoints import warehouses as warehouses_endpoint

    owner_headers = signup_and_login(client, "owner-mail-s5@example.com")
    warehouse_id = create_warehouse(client, owner_headers)
    smtp_put = client.put(
        "/api/settings/smtp",
        params={"warehouse_id": warehouse_id},
        json={
            "host": "smtp.example.com",
            "port": 587,
            "username": "mailer",
            "password": "secret-pass",
            "encryption_mode": "starttls",
            "from_address": "noreply@example.com",
            "from_name": "My Warehouse",
        },
        headers=owner_headers,
    )
    assert smtp_put.status_code == 200
    deliveries = []
    monkeypatch.setattr(
        warehouses_endpoint,
        "send_smtp_message",
        lambda setting, **message: deliveries.append((setting.host, message)),
    )

    response = client.post(
        f"/api/warehouses/{warehouse_id}/invites",
        json={"email": "guest-mail-s5@example.com"},
        headers=owner_headers,
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["email_delivery_status"] == "sent"
    assert payload["email_delivery_message"] == "Invitación enviada por correo."
    assert deliveries[0][0] == "smtp.example.com"
    assert deliveries[0][1]["to_email"] == "guest-mail-s5@example.com"
    assert "Shared" in deliveries[0][1]["subject"]
    assert payload["invite_url"] in deliveries[0][1]["body"]


def test_invite_survives_smtp_failure_and_can_be_accepted(client, monkeypatch):
    from app.api.v1.endpoints import warehouses as warehouses_endpoint
    from app.services.smtp_mailer import SMTPDeliveryError

    owner_headers = signup_and_login(client, "owner-failed-mail-s5@example.com")
    guest_headers = signup_and_login(client, "guest-failed-mail-s5@example.com")
    warehouse_id = create_warehouse(client, owner_headers)
    client.put(
        "/api/settings/smtp",
        params={"warehouse_id": warehouse_id},
        json={
            "host": "smtp.example.com",
            "port": 587,
            "username": "mailer",
            "password": "secret-pass",
            "encryption_mode": "starttls",
            "from_address": "noreply@example.com",
        },
        headers=owner_headers,
    )
    monkeypatch.setattr(
        warehouses_endpoint,
        "send_smtp_message",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(SMTPDeliveryError("connection")),
    )

    response = client.post(
        f"/api/warehouses/{warehouse_id}/invites",
        json={"email": "guest-failed-mail-s5@example.com"},
        headers=owner_headers,
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["email_delivery_status"] == "failed"
    assert "secret-pass" not in response.text
    accepted = client.post(
        f"/api/invites/{payload['invite_token']}/accept",
        headers=guest_headers,
    )
    assert accepted.status_code == 200


def test_invite_acceptance_normalizes_aware_utc_expiration(client, monkeypatch):
    from app.api.v1.endpoints import warehouses as warehouses_endpoint

    fixed_now = datetime(2026, 8, 20, 12, 0, tzinfo=UTC)
    monkeypatch.setattr(warehouses_endpoint, "utcnow", lambda: fixed_now)
    owner_headers = signup_and_login(client, "owner-aware-s5@example.com")
    guest_headers = signup_and_login(client, "guest-aware-s5@example.com")
    warehouse_id = create_warehouse(client, owner_headers)
    invite = client.post(
        f"/api/warehouses/{warehouse_id}/invites",
        json={"email": "guest-aware-s5@example.com"},
        headers=owner_headers,
    )

    accepted = client.post(
        f"/api/invites/{invite.json()['invite_token']}/accept",
        headers=guest_headers,
    )

    assert accepted.status_code == 200


def test_invite_rejects_a_different_authenticated_email(client):
    owner_headers = signup_and_login(client, "owner-wrong-s5@example.com")
    wrong_headers = signup_and_login(client, "wrong-s5@example.com")
    warehouse_id = create_warehouse(client, owner_headers)
    invite = client.post(
        f"/api/warehouses/{warehouse_id}/invites",
        json={"email": "expected-s5@example.com"},
        headers=owner_headers,
    )

    response = client.post(
        f"/api/invites/{invite.json()['invite_token']}/accept",
        headers=wrong_headers,
    )

    assert response.status_code == 403


def test_activity_and_trash_restore_events(client):
    headers = signup_and_login(client, "activity-s5@example.com")
    warehouse_id = create_warehouse(client, headers)

    box_res = client.post(
        f"/api/warehouses/{warehouse_id}/boxes",
        json={"name": "TrashBox"},
        headers=headers,
    )
    assert box_res.status_code == 201
    box = box_res.json()

    item_res = client.post(
        f"/api/warehouses/{warehouse_id}/items",
        json={"box_id": box["id"], "name": "Old Lamp"},
        headers=headers,
    )
    assert item_res.status_code == 201
    item = item_res.json()

    delete_item = client.delete(f"/api/warehouses/{warehouse_id}/items/{item['id']}", headers=headers)
    assert delete_item.status_code == 200

    deleted_items = client.get(
        f"/api/warehouses/{warehouse_id}/items",
        params={"include_deleted": True},
        headers=headers,
    )
    assert deleted_items.status_code == 200
    assert any(row["id"] == item["id"] and row["deleted_at"] is not None for row in deleted_items.json())

    restore_item = client.post(f"/api/warehouses/{warehouse_id}/items/{item['id']}/restore", headers=headers)
    assert restore_item.status_code == 200
    assert restore_item.json()["deleted_at"] is None

    activity = client.get(f"/api/warehouses/{warehouse_id}/activity", headers=headers)
    assert activity.status_code == 200
    event_types = [row["event_type"] for row in activity.json()]
    assert "item.deleted" in event_types
    assert "item.restored" in event_types
