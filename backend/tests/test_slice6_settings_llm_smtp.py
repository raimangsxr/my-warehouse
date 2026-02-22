def signup_and_login(client, email: str) -> dict[str, str]:
    client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "password123", "display_name": email.split("@")[0]},
    )
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "password123"})
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def create_warehouse(client, headers) -> str:
    res = client.post("/api/v1/warehouses", json={"name": "Cfg"}, headers=headers)
    assert res.status_code == 201
    return res.json()["id"]


def create_box(client, headers, warehouse_id) -> str:
    res = client.post(
        f"/api/v1/warehouses/{warehouse_id}/boxes",
        json={"name": "MainBox"},
        headers=headers,
    )
    assert res.status_code == 201
    return res.json()["id"]


def test_smtp_settings_roundtrip_and_test_endpoint(client):
    headers = signup_and_login(client, "slice6-smtp@example.com")
    warehouse_id = create_warehouse(client, headers)

    put = client.put(
        "/api/v1/settings/smtp",
        params={"warehouse_id": warehouse_id},
        json={
            "host": "smtp.example.com",
            "port": 587,
            "username": "user",
            "password": "secret-pass",
            "encryption_mode": "starttls",
            "from_address": "noreply@example.com",
            "from_name": "My Warehouse",
        },
        headers=headers,
    )
    assert put.status_code == 200
    assert put.json()["has_password"] is True
    assert put.json()["password_masked"]

    get = client.get("/api/v1/settings/smtp", params={"warehouse_id": warehouse_id}, headers=headers)
    assert get.status_code == 200
    assert get.json()["host"] == "smtp.example.com"
    assert get.json()["has_password"] is True

    test_mail = client.post(
        "/api/v1/settings/smtp/test",
        params={"warehouse_id": warehouse_id},
        json={"to_email": "target@example.com"},
        headers=headers,
    )
    assert test_mail.status_code == 200
    assert "simulated" in test_mail.json()["message"]


def test_llm_settings_and_reprocess_item(client):
    headers = signup_and_login(client, "slice6-llm@example.com")
    warehouse_id = create_warehouse(client, headers)
    box_id = create_box(client, headers, warehouse_id)

    llm_put = client.put(
        "/api/v1/settings/llm",
        params={"warehouse_id": warehouse_id},
        json={
            "provider": "gemini",
            "api_key": "gemini-secret-key",
            "auto_tags_enabled": True,
            "auto_alias_enabled": True,
        },
        headers=headers,
    )
    assert llm_put.status_code == 200
    assert llm_put.json()["has_api_key"] is True

    created = client.post(
        f"/api/v1/warehouses/{warehouse_id}/items",
        json={"box_id": box_id, "name": "Cordless Drill", "description": "Heavy duty garage tool"},
        headers=headers,
    )
    assert created.status_code == 201
    item = created.json()
    assert len(item["tags"]) >= 1

    reprocess = client.post(
        f"/api/v1/settings/llm/reprocess-item/{item['id']}",
        params={"warehouse_id": warehouse_id},
        headers=headers,
    )
    assert reprocess.status_code == 200
    assert reprocess.json()["item_id"] == item["id"]
