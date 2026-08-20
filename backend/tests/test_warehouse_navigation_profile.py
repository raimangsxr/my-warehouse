import importlib.util
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, inspect, select, text
from sqlalchemy.orm import Session

from app.db.session import engine
from app.models.box import Box
from app.models.intake_batch import IntakeBatch
from app.models.item import Item
from app.models.stock_movement import StockMovement


def signup_and_login(client, email: str, display_name: str | None = None) -> dict[str, str]:
    signup = client.post(
        "/api/auth/signup",
        json={
            "email": email,
            "password": "password123",
            "display_name": display_name or email.split("@")[0],
        },
    )
    assert signup.status_code == 201
    login = client.post("/api/auth/login", json={"email": email, "password": "password123"})
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def create_warehouse(client, headers: dict[str, str], name: str) -> dict:
    response = client.post("/api/warehouses", json={"name": name}, headers=headers)
    assert response.status_code == 201
    return response.json()


def invite_and_accept(client, warehouse_id: str, owner_headers, member_headers, email: str):
    invite = client.post(
        f"/api/warehouses/{warehouse_id}/invites",
        json={"email": email, "role": "contributor"},
        headers=owner_headers,
    )
    assert invite.status_code == 201
    accepted = client.post(
        f"/api/invites/{invite.json()['invite_token']}/accept",
        headers=member_headers,
    )
    assert accepted.status_code == 200


def test_profile_update_and_default_warehouse_validation(client):
    owner_headers = signup_and_login(client, "profile@example.com", "Original")
    other_headers = signup_and_login(client, "other-profile@example.com")
    first = create_warehouse(client, owner_headers, "Principal")
    second = create_warehouse(client, owner_headers, "Temporal")
    inaccessible = create_warehouse(client, other_headers, "Ajeno")

    me = client.get("/api/auth/me", headers=owner_headers)
    assert me.status_code == 200
    assert me.json()["default_warehouse_id"] == first["id"]

    update_profile = client.patch(
        "/api/auth/me",
        json={"display_name": "  Nuevo nombre  "},
        headers=owner_headers,
    )
    assert update_profile.status_code == 200
    assert update_profile.json()["display_name"] == "Nuevo nombre"
    assert update_profile.json()["email"] == "profile@example.com"

    set_default = client.put(
        "/api/auth/me/default-warehouse",
        json={"warehouse_id": second["id"]},
        headers=owner_headers,
    )
    assert set_default.status_code == 200
    assert set_default.json()["default_warehouse_id"] == second["id"]

    denied = client.put(
        "/api/auth/me/default-warehouse",
        json={"warehouse_id": inaccessible["id"]},
        headers=owner_headers,
    )
    assert denied.status_code == 403
    assert client.get("/api/auth/me", headers=owner_headers).json()["default_warehouse_id"] == second["id"]


def test_contributor_only_user_cannot_create_another_warehouse(client):
    owner_headers = signup_and_login(client, "creation-owner@example.com")
    contributor_headers = signup_and_login(client, "creation-contributor@example.com")
    warehouse = create_warehouse(client, owner_headers, "Shared")
    invite_and_accept(
        client,
        warehouse["id"],
        owner_headers,
        contributor_headers,
        "creation-contributor@example.com",
    )

    denied = client.post(
        "/api/warehouses",
        json={"name": "No permitido"},
        headers=contributor_headers,
    )
    assert denied.status_code == 403
    assert len(client.get("/api/warehouses", headers=contributor_headers).json()) == 1


def test_overview_counts_active_content_and_filters_member_email(client):
    owner_headers = signup_and_login(client, "overview-owner@example.com", "Owner")
    contributor_headers = signup_and_login(
        client, "overview-contributor@example.com", "Contributor"
    )
    warehouse = create_warehouse(client, owner_headers, "Overview")
    invite_and_accept(
        client,
        warehouse["id"],
        owner_headers,
        contributor_headers,
        "overview-contributor@example.com",
    )

    with Session(bind=engine) as db:
        inbound = db.scalar(
            select(Box).where(Box.warehouse_id == warehouse["id"], Box.is_inbound.is_(True))
        )
        assert inbound is not None
        active_box = Box(
            warehouse_id=warehouse["id"],
            name="Activa",
            qr_token="overview-active-qr",
            short_code="OVERVIEW1",
        )
        deleted_box = Box(
            warehouse_id=warehouse["id"],
            name="Eliminada",
            qr_token="overview-deleted-qr",
            short_code="OVERVIEW2",
            deleted_at=inbound.created_at,
        )
        db.add_all([active_box, deleted_box])
        db.flush()
        active_item = Item(
            warehouse_id=warehouse["id"],
            box_id=active_box.id,
            name="Activo",
            tags=[],
            aliases=[],
        )
        deleted_item = Item(
            warehouse_id=warehouse["id"],
            box_id=active_box.id,
            name="Borrado",
            tags=[],
            aliases=[],
            deleted_at=inbound.created_at,
        )
        db.add_all([active_item, deleted_item])
        db.flush()
        db.add_all(
            [
                StockMovement(
                    warehouse_id=warehouse["id"],
                    item_id=active_item.id,
                    delta=3,
                    command_id="overview-active-stock",
                ),
                StockMovement(
                    warehouse_id=warehouse["id"],
                    item_id=deleted_item.id,
                    delta=9,
                    command_id="overview-deleted-stock",
                ),
                IntakeBatch(
                    warehouse_id=warehouse["id"],
                    target_box_id=inbound.id,
                    created_by=warehouse["created_by"],
                    name="Abierto",
                    status="drafting",
                ),
                IntakeBatch(
                    warehouse_id=warehouse["id"],
                    target_box_id=inbound.id,
                    created_by=warehouse["created_by"],
                    name="Terminado",
                    status="committed",
                ),
            ]
        )
        db.commit()

    admin_overview = client.get("/api/warehouses/overview", headers=owner_headers)
    contributor_overview = client.get("/api/warehouses/overview", headers=contributor_headers)
    assert admin_overview.status_code == 200
    assert contributor_overview.status_code == 200

    admin_payload = admin_overview.json()[0]
    contributor_payload = contributor_overview.json()[0]
    assert admin_payload["active_item_count"] == 1
    assert admin_payload["stock_unit_count"] == 3
    assert admin_payload["active_box_count"] == 2  # inbound + active
    assert admin_payload["open_batch_count"] == 1
    assert admin_payload["member_count"] == 2
    assert all(member["email"] for member in admin_payload["members"])
    assert all(member["email"] is None for member in contributor_payload["members"])


def test_deleting_default_warehouse_clears_account_preference(client):
    headers = signup_and_login(client, "delete-default@example.com")
    warehouse = create_warehouse(client, headers, "Eliminar")
    deleted = client.request(
        "DELETE",
        f"/api/warehouses/{warehouse['id']}",
        json={"confirm_name": warehouse["name"]},
        headers=headers,
    )
    assert deleted.status_code == 200
    assert client.get("/api/auth/me", headers=headers).json()["default_warehouse_id"] is None


def test_default_warehouse_migration_upgrade_and_downgrade(tmp_path):
    migration_path = (
        Path(__file__).parents[1]
        / "alembic"
        / "versions"
        / "20260820_0014_user_default_warehouse.py"
    )
    spec = importlib.util.spec_from_file_location("default_warehouse_migration", migration_path)
    assert spec is not None and spec.loader is not None
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)

    migration_engine = create_engine(f"sqlite:///{tmp_path / 'default-warehouse.db'}")
    with migration_engine.begin() as connection:
        connection.execute(text("PRAGMA foreign_keys=ON"))
        connection.execute(text("CREATE TABLE users (id VARCHAR(36) PRIMARY KEY)"))
        connection.execute(text("CREATE TABLE warehouses (id VARCHAR(36) PRIMARY KEY)"))
        context = MigrationContext.configure(connection)
        with Operations.context(context):
            migration.upgrade()
        assert "default_warehouse_id" in {
            column["name"] for column in inspect(connection).get_columns("users")
        }
        with Operations.context(context):
            migration.downgrade()

    assert "default_warehouse_id" not in {
        column["name"] for column in inspect(migration_engine).get_columns("users")
    }
    migration_engine.dispose()
