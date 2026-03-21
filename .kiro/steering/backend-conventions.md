---
inclusion: always
---

# Backend — Convenciones y patrones

## Stack y versiones

- Python 3.11+, FastAPI 0.116+, SQLAlchemy 2.x, Alembic 1.14+
- PostgreSQL en producción, SQLite en dev local
- Argon2 para passwords, HS256 JWT para tokens
- `pyproject.toml` gestiona dependencias (no `requirements.txt`)

## Estructura de un endpoint típico

```
backend/app/
├── api/v1/endpoints/<dominio>.py   # Router FastAPI
├── models/<entidad>.py             # SQLAlchemy model
├── schemas/<dominio>.py            # Pydantic request/response
└── services/<dominio>.py           # Lógica de negocio (si aplica)
```

## Reglas de modelo de datos

- Toda entidad multi-tenant lleva `warehouse_id` (FK + índice).
- Soft delete: campo `deleted_at` nullable (nunca borrar filas de boxes/items).
- Concurrencia: `version` (int) + `updated_at` en entidades editables.
- Auditoría: `created_at`, `created_by`, `updated_by`.
- Stock **nunca** como campo mutable: siempre como suma de `stock_movements.delta`.
- `command_id` (uuid) en `stock_movements` para idempotencia offline.

## Migraciones Alembic

- Nombrar: `YYYYMMDD_NNNN_descripcion_corta.py`
- Crear con: `alembic revision --autogenerate -m "descripcion"`
- Aplicar con: `alembic upgrade head`
- **Obligatorio** crear migración si se toca cualquier modelo.
- Documentar el cambio en `.kiro/specs/my-warehouse/` en el mismo commit.

## Seguridad

- Validar `warehouse_id` + membresía del usuario en **todos** los endpoints de datos.
- Usar `require_warehouse_membership` dependency de `app/api/deps.py`.
- Secretos SMTP y Gemini API key: cifrados en backend con `secret_store.py`, nunca en texto plano.
- QR tokens: `secrets.token_urlsafe()`, no adivinables.
- No exponer `reset_token` en respuesta en producción (solo en dev).

## Autenticación

- Access token: Bearer JWT en header `Authorization`.
- Refresh token: rotativo, revocado en logout/change-password/reset-password.
- `remember_me=true`: access token persistente sin `exp`, registrado como revocable en BD.
- Cookie `HttpOnly` persistente para refresh de recuperación.
- Comparaciones de expiración siempre en UTC timezone-aware (evita error naive/aware con PostgreSQL).

## LLM (Gemini)

- Integración **solo** en backend (`app/services/llm_enrichment.py`).
- Fallback en cascada por `llm_settings.model_priority` (default: `gemini-3.1-flash-lite` → `gemini-3-flash` → `gemini-2.5-flash` → `gemini-2.5-flash-lite`).
- Si un ID devuelve 404, probar alias runtime (`-preview`, `-latest`) antes de saltar al siguiente.
- Si todos los modelos fallan: fallback heurístico local (nunca bloquear la operación).
- Parseo JSON tolerante: extraer primera entidad JSON válida aunque haya texto envolvente.
- Logs `INFO/DEBUG` por petición: operación, modelo intentado, modelo ganador, fallback.

## Intake batch

- Worker continuo por lote en `ThreadPoolExecutor` (proceso único backend).
- Cola persistida en BD: `intake_drafts.status='uploaded'`.
- `retry_errors=true` reprocesa solo errores, secuencialmente (1 a 1).
- Sin fallback local no-IA en intake: si falla LLM, draft queda en `error`.
- Al commit: mover fotos de `/media/{wid}/intake/{bid}/` a `/media/{wid}/items/`.

## Sync

- `change_log` registra toda mutación de boxes/items/stock con `seq` incremental.
- `processed_commands` garantiza idempotencia de comandos offline.
- Pull incremental: `GET /sync/pull?warehouse_id=...&since_seq=...`.

## Tests

- Directorio: `backend/tests/` (o junto a los módulos).
- Framework: pytest + pytest-asyncio + httpx.
- Añadir/ajustar tests en cada cambio que toque backend.
- Ejecutar: `pytest -q` desde `backend/`.

## Logging

- Nivel configurable por `LOG_LEVEL` env var (default `INFO`).
- Formato: `%(asctime)s %(levelname)s [%(name)s] %(message)s`.
- Errores de auth/acceso y fallos de IA: nivel `ERROR`.
