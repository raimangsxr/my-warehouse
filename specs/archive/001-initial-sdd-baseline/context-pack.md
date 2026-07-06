# Context Pack: 001-initial-sdd-baseline

## Goal

Afianzar el baseline SDD con **código como prioridad**: el contrato activo debe reflejar fielmente lo implementado; documentación legacy discordante queda explícitamente invalidada.

## Relevant Contract

- `specs/contracts/app/contract.md`
- `specs/README.md` (tabla de precedencia)

## Current Understanding

### Principio rector

```
código > contract.md > changes/** > specs.md (deprecado)
```

### Stack (verificado)

| Capa | Tecnología |
|------|------------|
| Frontend | Angular 20, Material, Service Worker, IndexedDB nativo (no Dexie) |
| Backend | FastAPI 0.3.4, SQLAlchemy, Alembic, JWT, Argon2 |
| DB dev/prod | SQLite / PostgreSQL |
| LLM | Gemini con 4 modelos en `app/core/llm.py` |
| Deploy | Docker rootless + K8s Traefik |

### Comportamiento clave (no negociable — viene del código)

| Tema | Verdad en código |
|------|------------------|
| Paradigma red | **Online-first**; offline limitado a stock + favoritos |
| Sync | Manual en Settings; sin auto-sync al reconectar |
| Mover cajas | Selector de padre en UI; API `POST .../move` |
| Mover artículos lote | `POST .../items/batch` action `move` |
| Tags | JSON en `items`; cloud agregada en endpoint |
| Fotos | `photo_url` + filesystem; sin tabla `photos` |
| Filtros Home | Solo favoritos y stock=0 en UI |
| Conflictos | UI: keep_server / keep_client únicamente |
| SMTP test | Respuesta simulada, sin envío real |
| Rate limiting | No implementado |
| Drag-drop | No implementado |
| Virtual scroll | No implementado |
| Invites email | Link manual; sin envío automático |

### Discordancias corregidas respecto a `specs.md` legacy

El legacy afirmaba o implicaba comportamientos que **no están en el código**. El contrato SDD ya no los reproduce como requisitos actuales:

- "Offline-first" → cola parcial + PWA cache de shell
- Drag & drop en árbol de cajas
- Tablas normalizadas de tags/photos
- EPIC H/I sin marcar (sí implementados, sync parcial)
- Merge de conflictos por campos
- Filtros "con foto" en Home
- `created_by`/`updated_by` en boxes/items
- Rate limiting en auth

## Files / Areas Likely Involved

Ver contrato. Puntos de verificación rápida:

- Rutas: `frontend/src/app/routes.ts`
- Offline: `frontend/src/app/services/sync.service.ts`, `home.component.ts` (enqueue on error)
- Modelos: `backend/app/models/__init__.py` (18 entidades)
- LLM defaults: `backend/app/core/llm.py`
- Auth persistente: `backend/app/api/v1/endpoints/auth.py`

## Constraints

- No reintroducir requisitos del legacy sin verificar código.
- Cambios de comportamiento → change SDD + actualización de contrato previa.
- `specs.md` raíz: no leer para implementar; pendiente borrado tras cierre del change.

## Validation Plan

```bash
cd backend && uv run pytest -q
cd frontend && npm run build
```

Última verificación: 46 tests passing.
