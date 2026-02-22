def auth_headers(client):
    client.post(
        "/api/v1/auth/signup",
        json={"email": "slice3@example.com", "password": "password123", "display_name": "Slice3"},
    )
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "slice3@example.com", "password": "password123"},
    )
    token = login_res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def create_warehouse(client, headers):
    res = client.post("/api/v1/warehouses", json={"name": "Main"}, headers=headers)
    return res.json()["id"]


def create_box(client, headers, warehouse_id, name, parent_box_id=None):
    payload = {"name": name}
    if parent_box_id is not None:
        payload["parent_box_id"] = parent_box_id
    res = client.post(f"/api/v1/warehouses/{warehouse_id}/boxes", json=payload, headers=headers)
    return res.json()


def create_item(client, headers, warehouse_id, payload):
    res = client.post(f"/api/v1/warehouses/{warehouse_id}/items", json=payload, headers=headers)
    assert res.status_code == 201
    return res.json()


def test_search_relevance_path_and_tag_cloud(client):
    headers = auth_headers(client)
    warehouse_id = create_warehouse(client, headers)

    root = create_box(client, headers, warehouse_id, "Garage")
    shelf = create_box(client, headers, warehouse_id, "Shelf", root["id"])
    attic = create_box(client, headers, warehouse_id, "Attic")

    exact = create_item(
        client,
        headers,
        warehouse_id,
        {"box_id": shelf["id"], "name": "drill", "tags": ["tool"], "aliases": ["borer"]},
    )
    prefix = create_item(
        client,
        headers,
        warehouse_id,
        {"box_id": shelf["id"], "name": "drill bits", "tags": ["accessory"], "aliases": []},
    )
    alias_match = create_item(
        client,
        headers,
        warehouse_id,
        {"box_id": shelf["id"], "name": "Taladro pesado", "tags": ["power"], "aliases": ["drill-driver"]},
    )
    tag_match = create_item(
        client,
        headers,
        warehouse_id,
        {"box_id": shelf["id"], "name": "Perforador", "tags": ["drill"], "aliases": []},
    )
    path_only = create_item(
        client,
        headers,
        warehouse_id,
        {"box_id": attic["id"], "name": "Winter coat", "tags": ["season"], "aliases": []},
    )

    search = client.get(
        f"/api/v1/warehouses/{warehouse_id}/items",
        params={"q": "drill"},
        headers=headers,
    )
    assert search.status_code == 200
    ids = [row["id"] for row in search.json()]
    assert ids[0] == exact["id"]
    assert ids[1] == prefix["id"]
    assert ids[2] == alias_match["id"]
    assert ids[3] == tag_match["id"]

    path_search = client.get(
        f"/api/v1/warehouses/{warehouse_id}/items",
        params={"q": "attic"},
        headers=headers,
    )
    assert path_search.status_code == 200
    assert [row["id"] for row in path_search.json()] == [path_only["id"]]

    tag_filtered = client.get(
        f"/api/v1/warehouses/{warehouse_id}/items",
        params={"tag": "drill"},
        headers=headers,
    )
    assert tag_filtered.status_code == 200
    assert [row["id"] for row in tag_filtered.json()] == [tag_match["id"]]

    cloud = client.get(f"/api/v1/warehouses/{warehouse_id}/tags/cloud", headers=headers)
    assert cloud.status_code == 200
    cloud_rows = cloud.json()
    drill_entry = next((entry for entry in cloud_rows if entry["tag"] == "drill"), None)
    assert drill_entry is not None
    assert drill_entry["count"] == 1

    list_tags = client.get(f"/api/v1/warehouses/{warehouse_id}/tags", headers=headers)
    assert list_tags.status_code == 200
    assert any(entry["name"] == "tool" for entry in list_tags.json())
