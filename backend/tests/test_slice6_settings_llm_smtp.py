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


def test_llm_settings_and_reprocess_item(client, monkeypatch):
    from app.api.v1.endpoints import items as items_endpoint
    from app.api.v1.endpoints import settings as settings_endpoint

    headers = signup_and_login(client, "slice6-llm@example.com")
    warehouse_id = create_warehouse(client, headers)
    box_id = create_box(client, headers, warehouse_id)

    custom_priority = [
        "gemini-3-flash",
        "gemini-3.1-flash-lite",
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
    ]

    llm_get_default = client.get("/api/v1/settings/llm", params={"warehouse_id": warehouse_id}, headers=headers)
    assert llm_get_default.status_code == 200
    assert llm_get_default.json()["language"] == "es"
    assert llm_get_default.json()["api_key_value"] is None
    assert llm_get_default.json()["model_priority"] == [
        "gemini-3.1-flash-lite",
        "gemini-3-flash",
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
    ]

    llm_put = client.put(
        "/api/v1/settings/llm",
        params={"warehouse_id": warehouse_id},
        json={
            "provider": "gemini",
            "language": "en",
            "model_priority": custom_priority,
            "api_key": "gemini-secret-key",
            "auto_tags_enabled": True,
            "auto_alias_enabled": True,
        },
        headers=headers,
    )
    assert llm_put.status_code == 200
    assert llm_put.json()["has_api_key"] is True
    assert llm_put.json()["language"] == "en"
    assert llm_put.json()["model_priority"] == custom_priority
    assert llm_put.json()["api_key_value"] == "gemini-secret-key"

    def fake_tags_aliases(
        _name: str,
        _description: str | None,
        *,
        api_key: str | None = None,
        output_language: str = "es",
        model_priority: list[str] | None = None,
        **_kwargs,
    ):
        assert api_key == "gemini-secret-key"
        assert output_language == "en"
        assert model_priority == custom_priority
        return ["tool", "garage", "drill"], ["drill", "cordless drill"]

    monkeypatch.setattr(items_endpoint, "generate_tags_and_aliases", fake_tags_aliases)
    monkeypatch.setattr(settings_endpoint, "generate_tags_and_aliases", fake_tags_aliases)

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
        json={"fields": ["tags"]},
        headers=headers,
    )
    assert reprocess.status_code == 200
    assert reprocess.json()["item_id"] == item["id"]
    assert reprocess.json()["processed_fields"] == ["tags"]
    assert isinstance(reprocess.json()["tags"], list)
