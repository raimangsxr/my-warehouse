from pathlib import Path
from unittest.mock import patch

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import engine
from app.models.box import Box
from app.models.change_log import ChangeLog
from app.models.intake_batch import IntakeBatch
from app.models.item import Item
from app.models.llm_setting import LLMSetting
from app.models.processed_command import ProcessedCommand
from app.models.smtp_setting import SMTPSetting
from app.models.sync_conflict import SyncConflict
from app.models.warehouse import Warehouse


def signup_and_login(client, email: str) -> dict[str, str]:
    client.post(
        "/api/auth/signup",
        json={"email": email, "password": "password123", "display_name": email.split("@")[0]},
    )
    login = client.post("/api/auth/login", json={"email": email, "password": "password123"})
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def create_warehouse(client, headers, name: str = "Garaje principal") -> dict:
    res = client.post("/api/warehouses", json={"name": name}, headers=headers)
    assert res.status_code == 201
    return res.json()


def seed_warehouse_content(client, headers, warehouse_id: str) -> None:
    box_res = client.post(
        f"/api/warehouses/{warehouse_id}/boxes",
        json={"name": "Herramientas"},
        headers=headers,
    )
    assert box_res.status_code == 201
    box = box_res.json()

    item_res = client.post(
        f"/api/warehouses/{warehouse_id}/items",
        json={"box_id": box["id"], "name": "Martillo"},
        headers=headers,
    )
    assert item_res.status_code == 201

    media_dir = Path(settings.media_root) / warehouse_id
    media_dir.mkdir(parents=True, exist_ok=True)
    (media_dir / "photo.jpg").write_bytes(b"fake-image")


def delete_warehouse_api(client, headers, warehouse_id: str, confirm_name: str):
    return client.request(
        "DELETE",
        f"/api/warehouses/{warehouse_id}",
        json={"confirm_name": confirm_name},
        headers=headers,
    )


def test_creator_can_delete_warehouse(client):
    headers = signup_and_login(client, "creator-delete@example.com")
    keep = create_warehouse(client, headers, name="Almacén secundario")
    target = create_warehouse(client, headers, name="Garaje principal")
    seed_warehouse_content(client, headers, target["id"])

    media_path = Path(settings.media_root) / target["id"] / "photo.jpg"
    assert media_path.exists()

    res = delete_warehouse_api(client, headers, target["id"], target["name"])
    assert res.status_code == 200
    assert res.json()["message"] == "Warehouse deleted"

    listed = client.get("/api/warehouses", headers=headers)
    assert listed.status_code == 200
    ids = {row["id"] for row in listed.json()}
    assert target["id"] not in ids
    assert keep["id"] in ids

    get_res = client.get(f"/api/warehouses/{target['id']}", headers=headers)
    assert get_res.status_code == 403

    assert not media_path.exists()


def test_delete_removes_all_related_data(client):
    headers = signup_and_login(client, "cleanup-delete@example.com")
    warehouse = create_warehouse(client, headers, name="Cleanup WH")
    warehouse_id = warehouse["id"]
    user_id = warehouse["created_by"]
    seed_warehouse_content(client, headers, warehouse_id)

    with Session(bind=engine) as db:
        db.add(
            SMTPSetting(
                warehouse_id=warehouse_id,
                host="smtp.example.com",
                from_address="noreply@example.com",
                updated_by=user_id,
            )
        )
        db.add(
            LLMSetting(
                warehouse_id=warehouse_id,
                updated_by=user_id,
            )
        )
        db.add(
            ChangeLog(
                warehouse_id=warehouse_id,
                entity_type="box",
                entity_id="x",
                action="create",
            )
        )
        db.add(
            ProcessedCommand(
                warehouse_id=warehouse_id,
                command_id="cmd-1",
                user_id=user_id,
                device_id="dev-1",
            )
        )
        db.add(
            SyncConflict(
                warehouse_id=warehouse_id,
                command_id="cmd-2",
                entity_type="item",
                entity_id="item-1",
                created_by=user_id,
            )
        )
        db.commit()

    res = delete_warehouse_api(client, headers, warehouse_id, warehouse["name"])
    assert res.status_code == 200

    with Session(bind=engine) as db:
        assert db.scalar(select(Warehouse).where(Warehouse.id == warehouse_id)) is None
        assert db.scalars(select(Box).where(Box.warehouse_id == warehouse_id)).all() == []
        assert db.scalars(select(Item).where(Item.warehouse_id == warehouse_id)).all() == []
        assert db.scalars(select(ChangeLog).where(ChangeLog.warehouse_id == warehouse_id)).all() == []
        assert (
            db.scalars(select(ProcessedCommand).where(ProcessedCommand.warehouse_id == warehouse_id)).all() == []
        )
        assert db.scalars(select(SyncConflict).where(SyncConflict.warehouse_id == warehouse_id)).all() == []
        assert db.scalars(select(SMTPSetting).where(SMTPSetting.warehouse_id == warehouse_id)).all() == []
        assert db.scalars(select(LLMSetting).where(LLMSetting.warehouse_id == warehouse_id)).all() == []


def test_delete_rollback_on_media_failure(client):
    headers = signup_and_login(client, "rollback-delete@example.com")
    warehouse = create_warehouse(client, headers, name="Rollback WH")
    warehouse_id = warehouse["id"]
    seed_warehouse_content(client, headers, warehouse_id)

    with patch("app.services.warehouse_delete.shutil.rmtree", side_effect=OSError("disk error")):
        res = delete_warehouse_api(client, headers, warehouse_id, warehouse["name"])

    assert res.status_code == 500
    assert res.json()["detail"] == "Warehouse deletion failed"

    with Session(bind=engine) as db:
        assert db.scalar(select(Warehouse).where(Warehouse.id == warehouse_id)) is not None


def test_delete_idempotent_404(client):
    headers = signup_and_login(client, "idempotent-delete@example.com")
    warehouse = create_warehouse(client, headers, name="Once WH")
    warehouse_id = warehouse["id"]

    first = delete_warehouse_api(client, headers, warehouse_id, warehouse["name"])
    assert first.status_code == 200

    second = delete_warehouse_api(client, headers, warehouse_id, warehouse["name"])
    assert second.status_code == 404


def test_wrong_confirm_name(client):
    headers = signup_and_login(client, "wrong-name@example.com")
    warehouse = create_warehouse(client, headers, name="Exact Name")

    res = delete_warehouse_api(client, headers, warehouse["id"], "Wrong Name")
    assert res.status_code == 400
    assert res.json()["detail"] == "Confirmation name does not match warehouse name"


def test_non_creator_forbidden(client):
    owner_headers = signup_and_login(client, "owner-delete@example.com")
    member_headers = signup_and_login(client, "member-delete@example.com")
    warehouse = create_warehouse(client, owner_headers, name="Shared WH")

    invite = client.post(
        f"/api/warehouses/{warehouse['id']}/invites",
        json={"email": "member-delete@example.com"},
        headers=owner_headers,
    )
    assert invite.status_code == 201
    accept = client.post(
        f"/api/invites/{invite.json()['invite_token']}/accept",
        headers=member_headers,
    )
    assert accept.status_code == 200

    res = delete_warehouse_api(client, member_headers, warehouse["id"], warehouse["name"])
    assert res.status_code == 403
    assert res.json()["detail"] == "Only the warehouse creator can delete this warehouse"


def test_co_member_loses_access(client):
    owner_headers = signup_and_login(client, "owner-co@example.com")
    guest_headers = signup_and_login(client, "guest-co@example.com")
    warehouse = create_warehouse(client, owner_headers, name="CoMember WH")

    invite = client.post(
        f"/api/warehouses/{warehouse['id']}/invites",
        json={"email": "guest-co@example.com"},
        headers=owner_headers,
    )
    token = invite.json()["invite_token"]
    assert client.post(f"/api/invites/{token}/accept", headers=guest_headers).status_code == 200

    delete_res = delete_warehouse_api(client, owner_headers, warehouse["id"], warehouse["name"])
    assert delete_res.status_code == 200

    guest_list = client.get("/api/warehouses", headers=guest_headers)
    assert guest_list.status_code == 200
    assert all(row["id"] != warehouse["id"] for row in guest_list.json())

    guest_get = client.get(f"/api/warehouses/{warehouse['id']}", headers=guest_headers)
    assert guest_get.status_code == 403


def test_blocked_while_batch_processing(client):
    headers = signup_and_login(client, "processing-block@example.com")
    warehouse = create_warehouse(client, headers, name="Processing WH")
    warehouse_id = warehouse["id"]

    tree = client.get(f"/api/warehouses/{warehouse_id}/boxes/tree", headers=headers)
    inbound_box_id = tree.json()[0]["box"]["id"]

    batch_res = client.post(
        f"/api/warehouses/{warehouse_id}/intake/batches",
        json={"target_box_id": inbound_box_id, "name": "Lote test"},
        headers=headers,
    )
    assert batch_res.status_code == 201
    batch_id = batch_res.json()["batch"]["id"]

    with Session(bind=engine) as db:
        batch = db.scalar(select(IntakeBatch).where(IntakeBatch.id == batch_id))
        assert batch is not None
        batch.status = "processing"
        db.commit()

    res = delete_warehouse_api(client, headers, warehouse_id, warehouse["name"])
    assert res.status_code == 409
    assert res.json()["detail"] == "Cannot delete warehouse while intake batches are processing"
