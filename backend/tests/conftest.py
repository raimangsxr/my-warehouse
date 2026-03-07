import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

os.environ["DATABASE_URL"] = "sqlite:///./test.db"
os.environ["JWT_SECRET"] = "test-secret"

from app.db import base as _db_base  # noqa: E402,F401
from app.db.session import engine, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.base import Base  # noqa: E402
from app.services.intake_workers import shutdown_batch_workers  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

TEST_DB_FILES = [Path("test.db"), Path("test.db-shm"), Path("test.db-wal")]


@pytest.fixture(autouse=True)
def setup_db():
    shutdown_batch_workers(timeout_seconds=2.0)
    engine.dispose()
    for path in TEST_DB_FILES:
        if path.exists():
            path.unlink()
    Base.metadata.create_all(bind=engine)
    yield
    shutdown_batch_workers(timeout_seconds=2.0)
    engine.dispose()
    for path in TEST_DB_FILES:
        if path.exists():
            path.unlink()


@pytest.fixture()
def client() -> TestClient:
    def override_get_db():
        db = Session(bind=engine)
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
