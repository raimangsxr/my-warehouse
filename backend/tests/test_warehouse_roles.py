def signup_and_login(client, email: str) -> dict[str, str]:
    signup = client.post(
        "/api/auth/signup",
        json={"email": email, "password": "password123", "display_name": email.split("@")[0]},
    )
    assert signup.status_code == 201
    login = client.post("/api/auth/login", json={"email": email, "password": "password123"})
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def create_warehouse(client, headers, name: str = "Roles WH") -> dict:
    response = client.post("/api/warehouses", json={"name": name}, headers=headers)
    assert response.status_code == 201
    return response.json()


def invite_and_accept(
    client,
    warehouse_id: str,
    owner_headers,
    member_headers,
    email: str,
    role: str | None = None,
):
    payload = {"email": email}
    if role is not None:
        payload["role"] = role
    invite = client.post(
        f"/api/warehouses/{warehouse_id}/invites",
        json=payload,
        headers=owner_headers,
    )
    assert invite.status_code == 201
    accepted = client.post(
        f"/api/invites/{invite.json()['invite_token']}/accept",
        headers=member_headers,
    )
    assert accepted.status_code == 200
    return invite.json()


def test_creator_is_administrator_and_role_is_exposed(client):
    headers = signup_and_login(client, "creator-role@example.com")
    warehouse = create_warehouse(client, headers)

    assert warehouse["role"] == "administrator"
    listed = client.get("/api/warehouses", headers=headers)
    details = client.get(f"/api/warehouses/{warehouse['id']}", headers=headers)

    assert listed.status_code == 200
    assert listed.json()[0]["role"] == "administrator"
    assert details.status_code == 200
    assert details.json()["role"] == "administrator"


def test_contributor_can_manage_content_but_not_administration(client):
    owner_headers = signup_and_login(client, "owner-matrix@example.com")
    contributor_headers = signup_and_login(client, "contributor-matrix@example.com")
    warehouse = create_warehouse(client, owner_headers)
    invite = invite_and_accept(
        client,
        warehouse["id"],
        owner_headers,
        contributor_headers,
        "contributor-matrix@example.com",
    )

    assert invite["role"] == "contributor"
    listed = client.get("/api/warehouses", headers=contributor_headers)
    assert listed.json()[0]["role"] == "contributor"

    box = client.post(
        f"/api/warehouses/{warehouse['id']}/boxes",
        json={"name": "Caja del contribuidor"},
        headers=contributor_headers,
    )
    assert box.status_code == 201
    item = client.post(
        f"/api/warehouses/{warehouse['id']}/items",
        json={"box_id": box.json()["id"], "name": "Taladro"},
        headers=contributor_headers,
    )
    assert item.status_code == 201

    tree = client.get(
        f"/api/warehouses/{warehouse['id']}/boxes/tree",
        headers=contributor_headers,
    )
    inbound_box_id = next(node["box"]["id"] for node in tree.json() if node["box"]["is_inbound"])
    batch = client.post(
        f"/api/warehouses/{warehouse['id']}/intake/batches",
        json={"target_box_id": inbound_box_id, "name": "Lote del contribuidor"},
        headers=contributor_headers,
    )
    assert batch.status_code == 201

    denied_requests = [
        client.get(f"/api/warehouses/{warehouse['id']}/members", headers=contributor_headers),
        client.post(
            f"/api/warehouses/{warehouse['id']}/invites",
            json={"email": "other@example.com"},
            headers=contributor_headers,
        ),
        client.get(
            "/api/settings/smtp",
            params={"warehouse_id": warehouse["id"]},
            headers=contributor_headers,
        ),
        client.get(
            "/api/sync/pull",
            params={"warehouse_id": warehouse["id"], "since": 0},
            headers=contributor_headers,
        ),
        client.get(f"/api/warehouses/{warehouse['id']}/export", headers=contributor_headers),
        client.request(
            "DELETE",
            f"/api/warehouses/{warehouse['id']}",
            json={"confirm_name": warehouse["name"]},
            headers=contributor_headers,
        ),
    ]
    assert all(response.status_code == 403 for response in denied_requests)
    assert all(response.json()["detail"] == "Administrator role required" for response in denied_requests)


def test_administrator_invite_and_later_role_management(client):
    owner_headers = signup_and_login(client, "owner-admin-role@example.com")
    admin_headers = signup_and_login(client, "invited-admin-role@example.com")
    warehouse = create_warehouse(client, owner_headers, "Shared admins")
    invite = invite_and_accept(
        client,
        warehouse["id"],
        owner_headers,
        admin_headers,
        "invited-admin-role@example.com",
        role="administrator",
    )
    assert invite["role"] == "administrator"

    members = client.get(f"/api/warehouses/{warehouse['id']}/members", headers=admin_headers)
    assert members.status_code == 200
    invited = next(row for row in members.json() if row["email"] == "invited-admin-role@example.com")
    owner = next(row for row in members.json() if row["email"] == "owner-admin-role@example.com")
    assert invited["role"] == "administrator"

    demote_owner = client.patch(
        f"/api/warehouses/{warehouse['id']}/members/{owner['user_id']}",
        json={"role": "contributor"},
        headers=admin_headers,
    )
    assert demote_owner.status_code == 200
    assert demote_owner.json()["role"] == "contributor"

    last_admin = client.patch(
        f"/api/warehouses/{warehouse['id']}/members/{invited['user_id']}",
        json={"role": "contributor"},
        headers=admin_headers,
    )
    assert last_admin.status_code == 409
    assert last_admin.json()["detail"] == "Warehouse must keep at least one administrator"

    delete = client.request(
        "DELETE",
        f"/api/warehouses/{warehouse['id']}",
        json={"confirm_name": warehouse["name"]},
        headers=admin_headers,
    )
    assert delete.status_code == 200


def test_contributor_cannot_promote_self(client):
    owner_headers = signup_and_login(client, "owner-self-role@example.com")
    contributor_headers = signup_and_login(client, "self-role@example.com")
    warehouse = create_warehouse(client, owner_headers)
    invite_and_accept(
        client,
        warehouse["id"],
        owner_headers,
        contributor_headers,
        "self-role@example.com",
    )
    members = client.get(f"/api/warehouses/{warehouse['id']}/members", headers=owner_headers).json()
    contributor = next(row for row in members if row["email"] == "self-role@example.com")

    response = client.patch(
        f"/api/warehouses/{warehouse['id']}/members/{contributor['user_id']}",
        json={"role": "administrator"},
        headers=contributor_headers,
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Administrator role required"
