import uuid


def signup_and_login(client, email: str) -> dict[str, str]:
    client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "password123", "display_name": email.split("@")[0]},
    )
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "password123"})
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def create_warehouse(client, headers) -> str:
    res = client.post("/api/v1/warehouses", json={"name": "Sync WH"}, headers=headers)
    assert res.status_code == 201
    return res.json()["id"]


def create_box(client, headers, warehouse_id: str) -> str:
    res = client.post(
        f"/api/v1/warehouses/{warehouse_id}/boxes",
        json={"name": "Tools"},
        headers=headers,
    )
    assert res.status_code == 201
    return res.json()["id"]


def test_sync_push_pull_and_conflict_resolution(client):
    headers = signup_and_login(client, "slice7-sync@example.com")
    warehouse_id = create_warehouse(client, headers)
    box_id = create_box(client, headers, warehouse_id)

    offline_item_id = str(uuid.uuid4())
    push = client.post(
        "/api/v1/sync/push",
        json={
            "warehouse_id": warehouse_id,
            "device_id": "device-a",
            "commands": [
                {
                    "command_id": str(uuid.uuid4()),
                    "type": "item.create",
                    "entity_id": offline_item_id,
                    "payload": {"box_id": box_id, "name": "Battery Pack"},
                },
                {
                    "command_id": str(uuid.uuid4()),
                    "type": "stock.adjust",
                    "entity_id": offline_item_id,
                    "payload": {"delta": 1},
                },
            ],
        },
        headers=headers,
    )
    assert push.status_code == 200
    push_body = push.json()
    assert len(push_body["applied_command_ids"]) == 2
    assert push_body["conflicts"] == []
    assert push_body["last_seq"] >= 1

    pull = client.get(
        "/api/v1/sync/pull",
        params={"warehouse_id": warehouse_id, "since_seq": 0},
        headers=headers,
    )
    assert pull.status_code == 200
    pull_body = pull.json()
    assert pull_body["last_seq"] >= 1
    assert any(change["entity_type"] == "item" and change["action"] == "create" for change in pull_body["changes"])

    item_before = client.get(f"/api/v1/warehouses/{warehouse_id}/items/{offline_item_id}", headers=headers)
    assert item_before.status_code == 200
    base_version = item_before.json()["version"]

    server_update = client.patch(
        f"/api/v1/warehouses/{warehouse_id}/items/{offline_item_id}",
        json={"name": "Battery Pack Server"},
        headers=headers,
    )
    assert server_update.status_code == 200

    conflict_push = client.post(
        "/api/v1/sync/push",
        json={
            "warehouse_id": warehouse_id,
            "device_id": "device-a",
            "commands": [
                {
                    "command_id": str(uuid.uuid4()),
                    "type": "item.update",
                    "entity_id": offline_item_id,
                    "base_version": base_version,
                    "payload": {"name": "Battery Pack Client"},
                }
            ],
        },
        headers=headers,
    )
    assert conflict_push.status_code == 200
    conflict_body = conflict_push.json()
    assert conflict_body["applied_command_ids"] == []
    assert len(conflict_body["conflicts"]) == 1

    conflict_id = conflict_body["conflicts"][0]["id"]
    resolve = client.post(
        "/api/v1/sync/resolve",
        json={
            "warehouse_id": warehouse_id,
            "conflict_id": conflict_id,
            "resolution": "keep_client",
        },
        headers=headers,
    )
    assert resolve.status_code == 200
    assert resolve.json()["conflict"]["status"] == "resolved"

    item_after = client.get(f"/api/v1/warehouses/{warehouse_id}/items/{offline_item_id}", headers=headers)
    assert item_after.status_code == 200
    assert item_after.json()["name"] == "Battery Pack Client"


def test_sync_push_idempotency_skips_processed_command(client):
    headers = signup_and_login(client, "slice7-idempotent@example.com")
    warehouse_id = create_warehouse(client, headers)
    box_id = create_box(client, headers, warehouse_id)

    created_item = client.post(
        f"/api/v1/warehouses/{warehouse_id}/items",
        json={"box_id": box_id, "name": "Tape"},
        headers=headers,
    )
    assert created_item.status_code == 201
    item_id = created_item.json()["id"]

    command_id = str(uuid.uuid4())
    payload = {
        "warehouse_id": warehouse_id,
        "device_id": "device-b",
        "commands": [
            {
                "command_id": command_id,
                "type": "stock.adjust",
                "entity_id": item_id,
                "payload": {"delta": 1},
            }
        ],
    }

    first = client.post("/api/v1/sync/push", json=payload, headers=headers)
    assert first.status_code == 200
    assert first.json()["applied_command_ids"] == [command_id]

    second = client.post("/api/v1/sync/push", json=payload, headers=headers)
    assert second.status_code == 200
    assert second.json()["applied_command_ids"] == []
    assert command_id in second.json()["skipped_command_ids"]
