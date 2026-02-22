def test_signup_login_and_create_warehouse(client):
    signup_res = client.post(
        "/api/v1/auth/signup",
        json={"email": "user@example.com", "password": "password123", "display_name": "User"},
    )
    assert signup_res.status_code == 201

    login_res = client.post(
        "/api/v1/auth/login", json={"email": "user@example.com", "password": "password123"}
    )
    assert login_res.status_code == 200
    tokens = login_res.json()
    assert tokens["access_token"]
    assert tokens["refresh_token"]

    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    create_wh_res = client.post("/api/v1/warehouses", json={"name": "Garaje"}, headers=headers)
    assert create_wh_res.status_code == 201
    warehouse = create_wh_res.json()

    list_res = client.get("/api/v1/warehouses", headers=headers)
    assert list_res.status_code == 200
    payload = list_res.json()
    assert len(payload) == 1
    assert payload[0]["id"] == warehouse["id"]

    members_res = client.get(f"/api/v1/warehouses/{warehouse['id']}/members", headers=headers)
    assert members_res.status_code == 200
    members = members_res.json()
    assert len(members) == 1


def test_forgot_reset_and_change_password_flow(client):
    client.post(
        "/api/v1/auth/signup",
        json={"email": "reset@example.com", "password": "password123", "display_name": "Reset User"},
    )

    forgot_res = client.post(
        "/api/v1/auth/forgot-password",
        json={"email": "reset@example.com"},
    )
    assert forgot_res.status_code == 200
    reset_token = forgot_res.json()["reset_token"]
    assert reset_token

    reset_res = client.post(
        "/api/v1/auth/reset-password",
        json={"token": reset_token, "new_password": "newpassword123"},
    )
    assert reset_res.status_code == 200

    old_login = client.post(
        "/api/v1/auth/login", json={"email": "reset@example.com", "password": "password123"}
    )
    assert old_login.status_code == 401

    new_login = client.post(
        "/api/v1/auth/login", json={"email": "reset@example.com", "password": "newpassword123"}
    )
    assert new_login.status_code == 200

    access = new_login.json()["access_token"]
    change_res = client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "newpassword123", "new_password": "finalpassword123"},
        headers={"Authorization": f"Bearer {access}"},
    )
    assert change_res.status_code == 200

    final_login = client.post(
        "/api/v1/auth/login", json={"email": "reset@example.com", "password": "finalpassword123"}
    )
    assert final_login.status_code == 200
