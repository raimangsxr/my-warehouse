from base64 import b64decode
from pathlib import Path

from app.core.config import settings


SAMPLE_IMAGE_DATA_URL = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3JjNQAAAAASUVORK5CYII="
)


def signup_and_login(client, email: str) -> dict[str, str]:
    client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "password123", "display_name": email.split("@")[0]},
    )
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "password123"})
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def create_warehouse(client, headers) -> str:
    res = client.post("/api/v1/warehouses", json={"name": "Intake WH"}, headers=headers)
    assert res.status_code == 201
    return res.json()["id"]


def create_box(client, headers, warehouse_id) -> str:
    res = client.post(
        f"/api/v1/warehouses/{warehouse_id}/boxes",
        json={"name": "Caja destino"},
        headers=headers,
    )
    assert res.status_code == 201
    return res.json()["id"]


def test_intake_batch_full_lifecycle(client):
    headers = signup_and_login(client, "slice10-intake@example.com")
    warehouse_id = create_warehouse(client, headers)
    box_id = create_box(client, headers, warehouse_id)

    created = client.post(
        f"/api/v1/warehouses/{warehouse_id}/intake/batches",
        json={"target_box_id": box_id, "name": "Lote inicial"},
        headers=headers,
    )
    assert created.status_code == 201
    batch_id = created.json()["batch"]["id"]

    png_bytes = b64decode(SAMPLE_IMAGE_DATA_URL.split(",", 1)[1])
    upload = client.post(
        f"/api/v1/warehouses/{warehouse_id}/intake/batches/{batch_id}/photos",
        files=[
            ("files", ("a.png", png_bytes, "image/png")),
            ("files", ("b.png", png_bytes, "image/png")),
        ],
        headers=headers,
    )
    assert upload.status_code == 201
    assert upload.json()["uploaded_count"] == 2
    uploaded_drafts = upload.json()["drafts"]
    assert all(f"/media/{warehouse_id}/intake/{batch_id}/" in draft["photo_url"] for draft in uploaded_drafts)
    intake_dir = Path(settings.media_root) / warehouse_id / "intake" / batch_id
    assert intake_dir.exists() and intake_dir.is_dir()

    start = client.post(
        f"/api/v1/warehouses/{warehouse_id}/intake/batches/{batch_id}/start",
        json={"retry_errors": False},
        headers=headers,
    )
    assert start.status_code == 200

    detail = client.get(
        f"/api/v1/warehouses/{warehouse_id}/intake/batches/{batch_id}",
        headers=headers,
    )
    assert detail.status_code == 200
    drafts = detail.json()["drafts"]
    assert len(drafts) == 2

    for draft in drafts:
        patch = client.patch(
            f"/api/v1/warehouses/{warehouse_id}/intake/drafts/{draft['id']}",
            json={
                "name": draft.get("name") or "Articulo",  # fallback local
                "description": draft.get("description") or "Descripcion",
                "tags": draft.get("tags") or ["inventario"],
                "aliases": draft.get("aliases") or ["articulo"],
                "status": "ready",
            },
            headers=headers,
        )
        assert patch.status_code == 200
        assert patch.json()["status"] == "ready"

    commit = client.post(
        f"/api/v1/warehouses/{warehouse_id}/intake/batches/{batch_id}/commit",
        json={"include_review": False},
        headers=headers,
    )
    assert commit.status_code == 200
    payload = commit.json()
    assert payload["created"] == 2
    assert payload["errors"] == 0
    assert payload["batch"]["status"] == "committed"

    items = client.get(f"/api/v1/warehouses/{warehouse_id}/items", headers=headers)
    assert items.status_code == 200
    assert len(items.json()) == 2
    assert all(item["box_id"] == box_id for item in items.json())
    assert all(item["photo_url"] for item in items.json())
    assert all(f"/media/{warehouse_id}/items/" in item["photo_url"] for item in items.json())
    assert not intake_dir.exists()


def test_intake_batch_requires_membership(client):
    owner_headers = signup_and_login(client, "slice10-owner@example.com")
    other_headers = signup_and_login(client, "slice10-other@example.com")

    warehouse_id = create_warehouse(client, owner_headers)
    box_id = create_box(client, owner_headers, warehouse_id)

    created = client.post(
        f"/api/v1/warehouses/{warehouse_id}/intake/batches",
        json={"target_box_id": box_id},
        headers=owner_headers,
    )
    assert created.status_code == 201
    batch_id = created.json()["batch"]["id"]

    for method, url in [
        ("get", f"/api/v1/warehouses/{warehouse_id}/intake/batches/{batch_id}"),
        ("post", f"/api/v1/warehouses/{warehouse_id}/intake/batches/{batch_id}/start"),
        ("post", f"/api/v1/warehouses/{warehouse_id}/intake/batches/{batch_id}/commit"),
    ]:
        if method == "get":
            response = client.get(url, headers=other_headers)
        else:
            response = client.post(url, json={}, headers=other_headers)
        assert response.status_code == 403


def test_intake_retry_uses_name_context_only_when_user_changes_suggested_name(client, monkeypatch):
    from app.services import intake_processing as intake_service

    headers = signup_and_login(client, "slice10-retry@example.com")
    warehouse_id = create_warehouse(client, headers)
    box_id = create_box(client, headers, warehouse_id)

    created = client.post(
        f"/api/v1/warehouses/{warehouse_id}/intake/batches",
        json={"target_box_id": box_id, "name": "Lote retry"},
        headers=headers,
    )
    assert created.status_code == 201
    batch_id = created.json()["batch"]["id"]

    png_bytes = b64decode(SAMPLE_IMAGE_DATA_URL.split(",", 1)[1])
    upload = client.post(
        f"/api/v1/warehouses/{warehouse_id}/intake/batches/{batch_id}/photos",
        files=[("files", ("retry.png", png_bytes, "image/png"))],
        headers=headers,
    )
    assert upload.status_code == 201
    draft_id = upload.json()["drafts"][0]["id"]

    suggested_name = "Taladro base"
    changed_name = "Taladro Bosch Professional"
    captured_calls: list[tuple[str | None, str | None]] = []

    def fake_generate(
        _image_data_url: str,
        *,
        context_name: str | None = None,
        context_description: str | None = None,
        **_kwargs,
    ):
        captured_calls.append((context_name, context_description))
        if len(captured_calls) == 1:
            return {
                "name": suggested_name,
                "description": "Herramienta electrica para perforar.",
                "tags": ["taladro", "herramienta", "bateria"],
                "aliases": ["drill", "taladro bateria"],
                "confidence": 0.95,
                "warnings": [],
                "llm_used": True,
            }
        if len(captured_calls) == 2:
            return {
                "name": "Nombre modelo ignorado",
                "description": "Descripcion recalculada con contexto.",
                "tags": ["taladro", "bosch", "profesional"],
                "aliases": ["drill", "bosch drill"],
                "confidence": 0.97,
                "warnings": [],
                "llm_used": True,
            }
        return {
            "name": suggested_name,
            "description": "Descripcion recalculada solo por imagen.",
            "tags": ["taladro", "herramienta", "cable"],
            "aliases": ["drill"],
            "confidence": 0.93,
            "warnings": [],
            "llm_used": True,
        }

    monkeypatch.setattr(intake_service, "generate_item_draft_from_photo", fake_generate)

    start_initial = client.post(
        f"/api/v1/warehouses/{warehouse_id}/intake/batches/{batch_id}/start",
        json={"retry_errors": False},
        headers=headers,
    )
    assert start_initial.status_code == 200

    detail_initial = client.get(
        f"/api/v1/warehouses/{warehouse_id}/intake/batches/{batch_id}",
        headers=headers,
    )
    assert detail_initial.status_code == 200
    assert detail_initial.json()["drafts"][0]["name"] == suggested_name

    requeue_changed_name = client.patch(
        f"/api/v1/warehouses/{warehouse_id}/intake/drafts/{draft_id}",
        json={
            "name": changed_name,
            "description": "Taladro inalambrico 18V para pared.",
            "tags": ["taladro", "herramienta"],
            "aliases": ["drill"],
            "status": "uploaded",
        },
        headers=headers,
    )
    assert requeue_changed_name.status_code == 200

    start_with_changed_name = client.post(
        f"/api/v1/warehouses/{warehouse_id}/intake/batches/{batch_id}/start",
        json={"retry_errors": False},
        headers=headers,
    )
    assert start_with_changed_name.status_code == 200

    detail_changed_name = client.get(
        f"/api/v1/warehouses/{warehouse_id}/intake/batches/{batch_id}",
        headers=headers,
    )
    assert detail_changed_name.status_code == 200
    assert detail_changed_name.json()["drafts"][0]["name"] == changed_name

    requeue_unchanged_name = client.patch(
        f"/api/v1/warehouses/{warehouse_id}/intake/drafts/{draft_id}",
        json={
            "name": suggested_name,
            "status": "uploaded",
        },
        headers=headers,
    )
    assert requeue_unchanged_name.status_code == 200

    start_with_same_name = client.post(
        f"/api/v1/warehouses/{warehouse_id}/intake/batches/{batch_id}/start",
        json={"retry_errors": False},
        headers=headers,
    )
    assert start_with_same_name.status_code == 200

    detail = client.get(
        f"/api/v1/warehouses/{warehouse_id}/intake/batches/{batch_id}",
        headers=headers,
    )
    assert detail.status_code == 200
    assert detail.json()["drafts"][0]["status"] == "ready"

    assert len(captured_calls) == 3
    assert captured_calls[0] == (None, None)  # initial proposal from image only
    assert captured_calls[1] == (changed_name, None)  # user changed suggested name -> name+photo
    assert captured_calls[2] == (None, None)  # user kept suggested name -> image only


def test_list_intake_batches_filters_open_and_only_mine(client):
    owner_headers = signup_and_login(client, "slice10-list-owner@example.com")
    warehouse_id = create_warehouse(client, owner_headers)
    box_id = create_box(client, owner_headers, warehouse_id)
    png_bytes = b64decode(SAMPLE_IMAGE_DATA_URL.split(",", 1)[1])

    committed_batch = client.post(
        f"/api/v1/warehouses/{warehouse_id}/intake/batches",
        json={"target_box_id": box_id, "name": "Lote committed"},
        headers=owner_headers,
    )
    assert committed_batch.status_code == 201
    committed_batch_id = committed_batch.json()["batch"]["id"]

    upload_committed = client.post(
        f"/api/v1/warehouses/{warehouse_id}/intake/batches/{committed_batch_id}/photos",
        files=[("files", ("committed.png", png_bytes, "image/png"))],
        headers=owner_headers,
    )
    assert upload_committed.status_code == 201
    committed_draft_id = upload_committed.json()["drafts"][0]["id"]

    patch_committed = client.patch(
        f"/api/v1/warehouses/{warehouse_id}/intake/drafts/{committed_draft_id}",
        json={"name": "Producto committed", "status": "ready"},
        headers=owner_headers,
    )
    assert patch_committed.status_code == 200

    commit_committed = client.post(
        f"/api/v1/warehouses/{warehouse_id}/intake/batches/{committed_batch_id}/commit",
        json={"include_review": False},
        headers=owner_headers,
    )
    assert commit_committed.status_code == 200
    assert commit_committed.json()["batch"]["status"] == "committed"

    open_owner = client.post(
        f"/api/v1/warehouses/{warehouse_id}/intake/batches",
        json={"target_box_id": box_id, "name": "Lote owner abierto"},
        headers=owner_headers,
    )
    assert open_owner.status_code == 201
    open_owner_id = open_owner.json()["batch"]["id"]

    upload_owner = client.post(
        f"/api/v1/warehouses/{warehouse_id}/intake/batches/{open_owner_id}/photos",
        files=[("files", ("owner.png", png_bytes, "image/png"))],
        headers=owner_headers,
    )
    assert upload_owner.status_code == 201

    other_headers = signup_and_login(client, "slice10-list-other@example.com")
    invite = client.post(
        f"/api/v1/warehouses/{warehouse_id}/invites",
        json={"email": "slice10-list-other@example.com"},
        headers=owner_headers,
    )
    assert invite.status_code == 201
    token = invite.json()["invite_token"]
    accepted = client.post(f"/api/v1/invites/{token}/accept", json={}, headers=other_headers)
    assert accepted.status_code == 200

    open_other = client.post(
        f"/api/v1/warehouses/{warehouse_id}/intake/batches",
        json={"target_box_id": box_id, "name": "Lote other abierto"},
        headers=other_headers,
    )
    assert open_other.status_code == 201
    open_other_id = open_other.json()["batch"]["id"]

    list_default = client.get(f"/api/v1/warehouses/{warehouse_id}/intake/batches", headers=owner_headers)
    assert list_default.status_code == 200
    default_ids = {batch["id"] for batch in list_default.json()}
    assert default_ids == {open_owner_id}

    list_all_open = client.get(
        f"/api/v1/warehouses/{warehouse_id}/intake/batches?only_mine=false",
        headers=owner_headers,
    )
    assert list_all_open.status_code == 200
    all_open_ids = {batch["id"] for batch in list_all_open.json()}
    assert all_open_ids == {open_owner_id, open_other_id}

    list_owner_with_committed = client.get(
        f"/api/v1/warehouses/{warehouse_id}/intake/batches?include_committed=true",
        headers=owner_headers,
    )
    assert list_owner_with_committed.status_code == 200
    owner_with_committed_ids = {batch["id"] for batch in list_owner_with_committed.json()}
    assert owner_with_committed_ids == {committed_batch_id, open_owner_id}


def test_delete_batch_removes_temporary_media_folder(client):
    headers = signup_and_login(client, "slice10-delete-temp@example.com")
    warehouse_id = create_warehouse(client, headers)
    box_id = create_box(client, headers, warehouse_id)

    created = client.post(
        f"/api/v1/warehouses/{warehouse_id}/intake/batches",
        json={"target_box_id": box_id, "name": "Lote temporal"},
        headers=headers,
    )
    assert created.status_code == 201
    batch_id = created.json()["batch"]["id"]

    png_bytes = b64decode(SAMPLE_IMAGE_DATA_URL.split(",", 1)[1])
    upload = client.post(
        f"/api/v1/warehouses/{warehouse_id}/intake/batches/{batch_id}/photos",
        files=[("files", ("temp.png", png_bytes, "image/png"))],
        headers=headers,
    )
    assert upload.status_code == 201

    batch_dir = Path(settings.media_root) / warehouse_id / "intake" / batch_id
    assert batch_dir.exists()

    deleted = client.delete(
        f"/api/v1/warehouses/{warehouse_id}/intake/batches/{batch_id}",
        headers=headers,
    )
    assert deleted.status_code == 200
    assert not batch_dir.exists()
