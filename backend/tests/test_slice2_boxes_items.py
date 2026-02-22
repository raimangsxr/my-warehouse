from uuid import uuid4


def auth_headers(client):
    client.post(
        "/api/v1/auth/signup",
        json={"email": "slice2@example.com", "password": "password123", "display_name": "Slice2"},
    )
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "slice2@example.com", "password": "password123"},
    )
    token = login_res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def create_warehouse(client, headers):
    res = client.post("/api/v1/warehouses", json={"name": "Main"}, headers=headers)
    return res.json()["id"]


def test_boxes_tree_move_delete_restore(client):
    headers = auth_headers(client)
    warehouse_id = create_warehouse(client, headers)

    root_res = client.post(f"/api/v1/warehouses/{warehouse_id}/boxes", json={}, headers=headers)
    assert root_res.status_code == 201
    root = root_res.json()
    assert root["name"].startswith("Caja")

    child_res = client.post(
        f"/api/v1/warehouses/{warehouse_id}/boxes",
        json={"name": "Herramientas", "parent_box_id": root["id"]},
        headers=headers,
    )
    assert child_res.status_code == 201
    child = child_res.json()

    move_cycle = client.post(
        f"/api/v1/warehouses/{warehouse_id}/boxes/{root['id']}/move",
        json={"new_parent_box_id": child["id"]},
        headers=headers,
    )
    assert move_cycle.status_code == 400

    soft_delete_without_force = client.request(
        "DELETE",
        f"/api/v1/warehouses/{warehouse_id}/boxes/{root['id']}",
        json={"force": False},
        headers=headers,
    )
    assert soft_delete_without_force.status_code == 400

    soft_delete_force = client.request(
        "DELETE",
        f"/api/v1/warehouses/{warehouse_id}/boxes/{root['id']}",
        json={"force": True},
        headers=headers,
    )
    assert soft_delete_force.status_code == 200

    restore_child_first = client.post(
        f"/api/v1/warehouses/{warehouse_id}/boxes/{child['id']}/restore",
        headers=headers,
    )
    assert restore_child_first.status_code == 400

    restore_root = client.post(
        f"/api/v1/warehouses/{warehouse_id}/boxes/{root['id']}/restore",
        headers=headers,
    )
    assert restore_root.status_code == 200


def test_items_favorites_stock_and_batch(client):
    headers = auth_headers(client)
    warehouse_id = create_warehouse(client, headers)

    box = client.post(
        f"/api/v1/warehouses/{warehouse_id}/boxes",
        json={"name": "Raiz"},
        headers=headers,
    ).json()
    box2 = client.post(
        f"/api/v1/warehouses/{warehouse_id}/boxes",
        json={"name": "Destino"},
        headers=headers,
    ).json()

    item = client.post(
        f"/api/v1/warehouses/{warehouse_id}/items",
        json={
            "box_id": box["id"],
            "name": "Taladro",
            "description": "Taladro inalambrico",
            "tags": ["herramienta"],
            "aliases": ["drill"],
        },
        headers=headers,
    )
    assert item.status_code == 201
    item_id = item.json()["id"]

    fav = client.post(
        f"/api/v1/warehouses/{warehouse_id}/items/{item_id}/favorite",
        json={"is_favorite": True},
        headers=headers,
    )
    assert fav.status_code == 200
    assert fav.json()["is_favorite"] is True

    command_id = str(uuid4())
    inc_stock = client.post(
        f"/api/v1/warehouses/{warehouse_id}/items/{item_id}/stock/adjust",
        json={"delta": 1, "command_id": command_id},
        headers=headers,
    )
    assert inc_stock.status_code == 200
    assert inc_stock.json()["stock"] == 1

    # Same command_id should be idempotent.
    inc_stock_repeat = client.post(
        f"/api/v1/warehouses/{warehouse_id}/items/{item_id}/stock/adjust",
        json={"delta": 1, "command_id": command_id},
        headers=headers,
    )
    assert inc_stock_repeat.status_code == 200
    assert inc_stock_repeat.json()["stock"] == 1

    move_batch = client.post(
        f"/api/v1/warehouses/{warehouse_id}/items/batch",
        json={"item_ids": [item_id], "action": "move", "target_box_id": box2["id"]},
        headers=headers,
    )
    assert move_batch.status_code == 200

    item_after_move = client.get(
        f"/api/v1/warehouses/{warehouse_id}/items/{item_id}",
        headers=headers,
    )
    assert item_after_move.json()["box_id"] == box2["id"]

    favorites = client.get(
        f"/api/v1/warehouses/{warehouse_id}/items",
        params={"favorites_only": True},
        headers=headers,
    )
    assert favorites.status_code == 200
    assert len(favorites.json()) == 1

    delete_batch = client.post(
        f"/api/v1/warehouses/{warehouse_id}/items/batch",
        json={"item_ids": [item_id], "action": "delete"},
        headers=headers,
    )
    assert delete_batch.status_code == 200

    hidden_list = client.get(f"/api/v1/warehouses/{warehouse_id}/items", headers=headers)
    assert hidden_list.status_code == 200
    assert hidden_list.json() == []
