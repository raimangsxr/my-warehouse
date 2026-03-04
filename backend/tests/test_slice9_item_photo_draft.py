from base64 import b64decode
from urllib.parse import urlparse


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


def create_box(client, headers, warehouse_id) -> str:
    res = client.post(
        f"/api/v1/warehouses/{warehouse_id}/boxes",
        json={"name": "MainBox"},
        headers=headers,
    )
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
            "language": "en",
            "api_key": "gemini-secret-key",
            "auto_tags_enabled": True,
            "auto_alias_enabled": True,
        },
        headers=headers,
    )
    assert llm_put.status_code == 200

    def fake_photo_draft(
        _image_data_url: str,
        *,
        api_key: str | None = None,
        output_language: str = "es",
        **_kwargs,
    ):
        assert api_key == "gemini-secret-key"
        assert output_language == "en"
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


def test_upload_photo_and_use_photo_url_in_item(client):
    headers = signup_and_login(client, "slice9-upload@example.com")
    warehouse_id = create_warehouse(client, headers)
    box_id = create_box(client, headers, warehouse_id)

    png_bytes = b64decode(SAMPLE_IMAGE_DATA_URL.split(",", 1)[1])
    upload = client.post(
        "/api/v1/photos/upload",
        params={"warehouse_id": warehouse_id},
        files={"file": ("item.png", png_bytes, "image/png")},
        headers=headers,
    )
    assert upload.status_code == 201
    photo_url = upload.json()["photo_url"]
    assert f"/media/{warehouse_id}/" in photo_url

    photo_path = urlparse(photo_url).path
    fetched = client.get(photo_path)
    assert fetched.status_code == 200
    assert fetched.headers["content-type"] == "image/png"

    created = client.post(
        f"/api/v1/warehouses/{warehouse_id}/items",
        json={"box_id": box_id, "name": "Articulo con foto", "photo_url": photo_url},
        headers=headers,
    )
    assert created.status_code == 201
    assert created.json()["photo_url"] == photo_url
