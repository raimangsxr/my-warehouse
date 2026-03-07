from app.core.config import settings
from app.services.security import decode_token


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

    tree_res = client.get(f"/api/v1/warehouses/{warehouse['id']}/boxes/tree", headers=headers)
    assert tree_res.status_code == 200
    nodes = tree_res.json()
    assert len(nodes) == 1
    assert nodes[0]["box"]["is_inbound"] is True
    assert nodes[0]["box"]["name"] == "Entrada de mercancias"


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


def test_remember_me_sets_cookie_and_allows_cookie_refresh(client):
    client.post(
        "/api/v1/auth/signup",
        json={"email": "remember@example.com", "password": "password123", "display_name": "Remember User"},
    )

    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "remember@example.com", "password": "password123", "remember_me": True},
    )
    assert login_res.status_code == 200
    login_tokens = login_res.json()
    set_cookie_header = login_res.headers.get("set-cookie", "").lower()

    assert login_res.cookies.get(settings.auth_cookie_name) == login_tokens["refresh_token"]
    assert client.cookies.get(settings.auth_cookie_name) == login_tokens["refresh_token"]
    assert "httponly" in set_cookie_header
    assert f"{settings.auth_cookie_name}=" in set_cookie_header

    refresh_res = client.post("/api/v1/auth/refresh", json={"remember_me": True})
    assert refresh_res.status_code == 200
    refreshed_tokens = refresh_res.json()

    assert refreshed_tokens["access_token"]
    assert refreshed_tokens["refresh_token"] != login_tokens["refresh_token"]
    assert client.cookies.get(settings.auth_cookie_name) == refreshed_tokens["refresh_token"]


def test_remember_me_access_token_has_no_exp_and_is_revoked_on_logout(client):
    client.post(
        "/api/v1/auth/signup",
        json={"email": "persistent-access@example.com", "password": "password123", "display_name": "Persistent"},
    )

    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "persistent-access@example.com", "password": "password123", "remember_me": True},
    )
    assert login_res.status_code == 200
    access_token = login_res.json()["access_token"]
    refresh_token = login_res.json()["refresh_token"]
    token_payload = decode_token(access_token)

    assert token_payload["remember_me"] is True
    assert "exp" not in token_payload

    me_res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {access_token}"})
    assert me_res.status_code == 200

    logout_res = client.post(
        "/api/v1/auth/logout",
        json={"refresh_token": refresh_token},
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert logout_res.status_code == 200

    me_after_logout = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {access_token}"})
    assert me_after_logout.status_code == 401


def test_standard_access_token_keeps_expiration_claim(client):
    client.post(
        "/api/v1/auth/signup",
        json={"email": "standard-access@example.com", "password": "password123", "display_name": "Standard"},
    )

    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "standard-access@example.com", "password": "password123", "remember_me": False},
    )
    assert login_res.status_code == 200
    token_payload = decode_token(login_res.json()["access_token"])

    assert "exp" in token_payload
    assert token_payload.get("remember_me") is None


def test_login_without_remember_me_clears_persistent_cookie(client):
    client.post(
        "/api/v1/auth/signup",
        json={"email": "cookie-clear@example.com", "password": "password123", "display_name": "Cookie Clear"},
    )

    remembered = client.post(
        "/api/v1/auth/login",
        json={"email": "cookie-clear@example.com", "password": "password123", "remember_me": True},
    )
    assert remembered.status_code == 200
    assert client.cookies.get(settings.auth_cookie_name)

    regular_login = client.post(
        "/api/v1/auth/login",
        json={"email": "cookie-clear@example.com", "password": "password123", "remember_me": False},
    )
    assert regular_login.status_code == 200
    assert client.cookies.get(settings.auth_cookie_name) is None
    assert "max-age=0" in regular_login.headers.get("set-cookie", "").lower()


def test_logout_revokes_refresh_token_and_clears_cookie(client):
    client.post(
        "/api/v1/auth/signup",
        json={"email": "logout-remember@example.com", "password": "password123", "display_name": "Logout User"},
    )

    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "logout-remember@example.com", "password": "password123", "remember_me": True},
    )
    refresh_token = login_res.json()["refresh_token"]

    logout_res = client.post("/api/v1/auth/logout", json={"refresh_token": refresh_token})
    assert logout_res.status_code == 200
    assert client.cookies.get(settings.auth_cookie_name) is None

    refresh_res = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token, "remember_me": True},
    )
    assert refresh_res.status_code == 401
