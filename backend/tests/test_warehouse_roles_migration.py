from datetime import UTC, datetime, timedelta
import importlib.util
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, inspect, text


def load_roles_migration():
    migration_path = (
        Path(__file__).parents[1]
        / "alembic"
        / "versions"
        / "20260820_0013_warehouse_roles.py"
    )
    spec = importlib.util.spec_from_file_location("warehouse_roles_migration", migration_path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_warehouse_roles_migration_backfills_and_downgrades(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'roles-migration.db'}"
    engine = create_engine(database_url)
    expires_at = datetime.now(UTC) + timedelta(days=1)
    migration = load_roles_migration()

    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE users (id VARCHAR(36) PRIMARY KEY)"))
        connection.execute(
            text(
                "CREATE TABLE warehouses ("
                "id VARCHAR(36) PRIMARY KEY, created_by VARCHAR(36) NOT NULL)"
            )
        )
        connection.execute(
            text(
                "CREATE TABLE memberships ("
                "user_id VARCHAR(36) NOT NULL, warehouse_id VARCHAR(36) NOT NULL, "
                "PRIMARY KEY (user_id, warehouse_id))"
            )
        )
        connection.execute(
            text(
                "CREATE TABLE warehouse_invites ("
                "id VARCHAR(36) PRIMARY KEY, warehouse_id VARCHAR(36) NOT NULL, "
                "invited_by VARCHAR(36) NOT NULL, expires_at DATETIME NOT NULL)"
            )
        )
        connection.execute(text("INSERT INTO users (id) VALUES ('owner'), ('member')"))
        connection.execute(
            text("INSERT INTO warehouses (id, created_by) VALUES ('warehouse', 'owner')")
        )
        connection.execute(
            text(
                "INSERT INTO memberships (user_id, warehouse_id) VALUES "
                "('owner', 'warehouse'), ('member', 'warehouse')"
            )
        )
        connection.execute(
            text(
                "INSERT INTO warehouse_invites (id, warehouse_id, invited_by, expires_at) "
                "VALUES ('invite', 'warehouse', 'owner', :expires_at)"
            ),
            {"expires_at": expires_at},
        )

        context = MigrationContext.configure(connection)
        with Operations.context(context):
            migration.upgrade()

        roles = dict(
            connection.execute(
                text("SELECT user_id, role FROM memberships ORDER BY user_id")
            ).all()
        )
        invite_role = connection.execute(
            text("SELECT role FROM warehouse_invites WHERE id = 'invite'")
        ).scalar_one()
        assert roles == {"member": "contributor", "owner": "administrator"}
        assert invite_role == "contributor"

        with Operations.context(context):
            migration.downgrade()

    inspector = inspect(engine)
    assert "role" not in {column["name"] for column in inspector.get_columns("memberships")}
    assert "role" not in {column["name"] for column in inspector.get_columns("warehouse_invites")}
    engine.dispose()
