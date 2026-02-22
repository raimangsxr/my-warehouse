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
