# my-warehouse backend

## Run locally

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

## Migrations

```bash
cd backend
uv run alembic upgrade head
```

## Tests

```bash
cd backend
uv run pytest
```
