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
