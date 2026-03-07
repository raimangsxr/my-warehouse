from app.db.session import engine
from app.models.box import Box
from sqlalchemy.orm import Session


def signup_and_login(client, email: str) -> dict[str, str]:
    client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "password123", "display_name": email.split("@")[0]},
    )
    login_res = client.post("/api/v1/auth/login", json={"email": email, "password": "password123"})
    token = login_res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def create_warehouse(client, headers, name="Main") -> str:
    res = client.post("/api/v1/warehouses", json={"name": name}, headers=headers)
    return res.json()["id"]


def test_qr_lookup_requires_membership_and_returns_box(client):
    owner_headers = signup_and_login(client, "qr-owner@example.com")
    warehouse_id = create_warehouse(client, owner_headers)

    box_res = client.post(
        f"/api/v1/warehouses/{warehouse_id}/boxes",
        json={"name": "QR Box"},
        headers=owner_headers,
    )
    assert box_res.status_code == 201
    box = box_res.json()

    by_qr_owner = client.get(f"/api/v1/boxes/by-qr/{box['qr_token']}", headers=owner_headers)
    assert by_qr_owner.status_code == 200
    payload = by_qr_owner.json()
    assert payload["box_id"] == box["id"]
    assert payload["warehouse_id"] == warehouse_id
    assert payload["short_code"] == box["short_code"]

    outsider_headers = signup_and_login(client, "qr-outsider@example.com")
    by_qr_outsider = client.get(f"/api/v1/boxes/by-qr/{box['qr_token']}", headers=outsider_headers)
    assert by_qr_outsider.status_code == 403


def test_qr_lookup_missing_token_returns_404(client):
    headers = signup_and_login(client, "qr-miss@example.com")
    res = client.get("/api/v1/boxes/by-qr/not-a-token", headers=headers)
    assert res.status_code == 404


def test_box_resolve_supports_short_code_for_accessible_box(client):
    owner_headers = signup_and_login(client, "code-owner@example.com")
    warehouse_id = create_warehouse(client, owner_headers)

    box_res = client.post(
        f"/api/v1/warehouses/{warehouse_id}/boxes",
        json={"name": "Code Box"},
        headers=owner_headers,
    )
    assert box_res.status_code == 201
    box = box_res.json()

    resolved = client.get(f"/api/v1/boxes/resolve/{box['short_code'].lower()}", headers=owner_headers)
    assert resolved.status_code == 200
    payload = resolved.json()
    assert payload["box_id"] == box["id"]
    assert payload["warehouse_id"] == warehouse_id
    assert payload["short_code"] == box["short_code"]


def test_box_resolve_by_short_code_requires_membership(client):
    owner_headers = signup_and_login(client, "code-member-owner@example.com")
    warehouse_id = create_warehouse(client, owner_headers)

    box_res = client.post(
        f"/api/v1/warehouses/{warehouse_id}/boxes",
        json={"name": "Protected Code Box"},
        headers=owner_headers,
    )
    assert box_res.status_code == 201
    box = box_res.json()

    outsider_headers = signup_and_login(client, "code-member-outsider@example.com")
    resolved = client.get(f"/api/v1/boxes/resolve/{box['short_code']}", headers=outsider_headers)
    assert resolved.status_code == 403


def test_box_resolve_by_short_code_returns_conflict_when_ambiguous(client):
    owner_headers = signup_and_login(client, "code-ambiguous@example.com")
    first_warehouse_id = create_warehouse(client, owner_headers, name="Main")
    second_warehouse_id = create_warehouse(client, owner_headers, name="Secondary")

    first_box_res = client.post(
        f"/api/v1/warehouses/{first_warehouse_id}/boxes",
        json={"name": "First Box"},
        headers=owner_headers,
    )
    second_box_res = client.post(
        f"/api/v1/warehouses/{second_warehouse_id}/boxes",
        json={"name": "Second Box"},
        headers=owner_headers,
    )
    assert first_box_res.status_code == 201
    assert second_box_res.status_code == 201

    duplicate_short_code = "BX-DUP123"
    with Session(bind=engine) as db:
        first_box = db.get(Box, first_box_res.json()["id"])
        second_box = db.get(Box, second_box_res.json()["id"])
        assert first_box is not None
        assert second_box is not None
        first_box.short_code = duplicate_short_code
        second_box.short_code = duplicate_short_code
        db.commit()

    resolved = client.get(f"/api/v1/boxes/resolve/{duplicate_short_code}", headers=owner_headers)
    assert resolved.status_code == 409
