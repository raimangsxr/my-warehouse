def signup_and_login(client, email: str) -> dict[str, str]:
    client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "password123", "display_name": email.split("@")[0]},
    )
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "password123"})
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def create_warehouse(client, headers) -> str:
    res = client.post("/api/v1/warehouses", json={"name": "Photo WH"}, headers=headers)
    assert res.status_code == 201
    return res.json()["id"]


SAMPLE_IMAGE_DATA_URL = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3JjNQAAAAASUVORK5CYII="
)


def test_draft_from_photo_fallback_without_llm_settings(client):
    headers = signup_and_login(client, "slice9-fallback@example.com")
    warehouse_id = create_warehouse(client, headers)

    res = client.post(
        f"/api/v1/warehouses/{warehouse_id}/items/draft-from-photo",
        json={"image_data_url": SAMPLE_IMAGE_DATA_URL},
        headers=headers,
    )
    assert res.status_code == 200
    payload = res.json()
    assert payload["name"]
    assert isinstance(payload["tags"], list)
    assert payload["llm_used"] is False
    assert payload["warnings"]


def test_draft_from_photo_rejects_invalid_data_url(client):
    headers = signup_and_login(client, "slice9-invalid@example.com")
    warehouse_id = create_warehouse(client, headers)

    res = client.post(
        f"/api/v1/warehouses/{warehouse_id}/items/draft-from-photo",
        json={"image_data_url": "https://example.com/photo-not-a-data-url-long-enough.jpg"},
        headers=headers,
    )
    assert res.status_code == 400
    assert "data URL" in res.json()["detail"]


def test_draft_from_photo_uses_llm_when_configured(client, monkeypatch):
    from app.api.v1.endpoints import items as items_endpoint

    headers = signup_and_login(client, "slice9-llm@example.com")
    warehouse_id = create_warehouse(client, headers)
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

    def fake_photo_draft(_image_data_url: str, *, api_key: str | None = None, **_kwargs):
        assert api_key == "gemini-secret-key"
        return {
            "name": "Taladro inalambrico",
            "description": "Herramienta electrica para perforar.",
            "tags": ["taladro", "herramienta", "bateria"],
            "aliases": ["drill", "taladro bateria"],
            "confidence": 0.93,
            "warnings": [],
            "llm_used": True,
        }

    monkeypatch.setattr(items_endpoint, "generate_item_draft_from_photo", fake_photo_draft)

    res = client.post(
        f"/api/v1/warehouses/{warehouse_id}/items/draft-from-photo",
        json={"image_data_url": SAMPLE_IMAGE_DATA_URL},
        headers=headers,
    )
    assert res.status_code == 200
    payload = res.json()
    assert payload["name"] == "Taladro inalambrico"
    assert payload["llm_used"] is True
    assert payload["confidence"] == 0.93
