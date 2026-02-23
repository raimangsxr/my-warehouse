import uuid


def signup_and_login(client, email: str) -> dict[str, str]:
    client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "password123", "display_name": email.split("@")[0]},
    )
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "password123"})
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def create_warehouse(client, headers, name: str) -> str:
    res = client.post("/api/v1/warehouses", json={"name": name}, headers=headers)
    assert res.status_code == 201
    return res.json()["id"]


def create_box(client, headers, warehouse_id: str, name: str) -> str:
    res = client.post(
        f"/api/v1/warehouses/{warehouse_id}/boxes",
        json={"name": name},
        headers=headers,
    )
    assert res.status_code == 201
    return res.json()["id"]


def test_export_import_roundtrip_between_warehouses(client):
    headers = signup_and_login(client, "slice8-transfer@example.com")

    source_warehouse_id = create_warehouse(client, headers, "Source")
    source_box_id = create_box(client, headers, source_warehouse_id, "Source Box")

    created_item = client.post(
        f"/api/v1/warehouses/{source_warehouse_id}/items",
        json={"box_id": source_box_id, "name": "LED Bulb", "description": "E27"},
        headers=headers,
    )
    assert created_item.status_code == 201
    source_item_id = created_item.json()["id"]

    stock = client.post(
        f"/api/v1/warehouses/{source_warehouse_id}/items/{source_item_id}/stock/adjust",
        json={"delta": 1, "command_id": str(uuid.uuid4())},
        headers=headers,
    )
    assert stock.status_code == 200

    exported = client.get(f"/api/v1/warehouses/{source_warehouse_id}/export", headers=headers)
    assert exported.status_code == 200
    snapshot = exported.json()
    assert snapshot["warehouse"]["name"] == "Source"
    assert len(snapshot["boxes"]) == 1
    assert len(snapshot["items"]) == 1
    assert len(snapshot["stock_movements"]) == 1

    target_warehouse_id = create_warehouse(client, headers, "Target")
    imported = client.post(
        f"/api/v1/warehouses/{target_warehouse_id}/import",
        json=snapshot,
        headers=headers,
    )
    assert imported.status_code == 200
    imported_body = imported.json()
    assert imported_body["boxes_upserted"] == 1
    assert imported_body["items_upserted"] == 1
    assert imported_body["stock_movements_upserted"] == 1

    target_items = client.get(f"/api/v1/warehouses/{target_warehouse_id}/items", headers=headers)
    assert target_items.status_code == 200
    items_body = target_items.json()
    assert len(items_body) == 1
    assert items_body[0]["name"] == "LED Bulb"
    assert items_body[0]["stock"] == 1

    target_boxes = client.get(f"/api/v1/warehouses/{target_warehouse_id}/boxes/tree", headers=headers)
    assert target_boxes.status_code == 200
    assert len(target_boxes.json()) == 1
