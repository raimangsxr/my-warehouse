# app Contract

**Product:** my-warehouse — PWA de inventario doméstico (garaje/trastero).  
**Versions:** backend `0.3.4`, frontend `0.3.5`.  
**Last verified:** 2026-07-05 (auditoría código ↔ spec).

## Governance

- **Este contrato describe el comportamiento implementado**, verificado contra `backend/` y `frontend/`.
- Ante discordancia entre documentación y código, **prevalece el código** hasta que un change SDD actualice el contrato de forma intencional.
- `specs.md` en la raíz está **deprecado** y no debe usarse para planificar ni implementar.

## Purpose

Aplicación **online-first** para localizar objetos físicos mediante:

- cajas jerárquicas con QR por caja,
- artículos con foto, stock, favoritos, tags y alias,
- búsqueda con relevancia y escaneo QR,
- colaboración multiusuario sin roles,
- **cola offline limitada** (stock y favoritos) + sync manual,
- enriquecimiento LLM (Gemini) y captura masiva por lotes.

No es offline-first completo: la mayoría de operaciones requieren red.

---

## Domain Concepts

| Concepto | Implementación actual |
|----------|----------------------|
| **User** | Email + password (Argon2). Múltiples warehouses. |
| **Warehouse** | Sin roles. Al crearse añade caja `Entrada de mercancias` (`is_inbound=true`, no borrable). |
| **Box** | Árbol con `parent_box_id`, `qr_token`, `short_code`, `version`, soft-delete. |
| **Item** | En una caja. `photo_url`, `tags`/`aliases` como **JSON**, stock derivado, favorito por usuario. |
| **Stock** | Suma de `stock_movements`. Alta: `+1`. Intake commit: `+quantity`. Ajuste UI: `±1` con `command_id`. |
| **Intake batch** | Fotos → drafts → commit. Worker in-process con `ThreadPoolExecutor`. |
| **Sync** | `change_log` (pull), `processed_commands` (idempotencia), `sync_conflicts`. |

---

## User Flows

### Auth
Signup → login (opcional *Mantener sesión*: access JWT sin `exp` + refresh en cookie HttpOnly) → forgot/reset/change password. Interceptor: 401 → logout; refresh automático solo con sesión persistente.

### Warehouse
Listar/crear → seleccionar (persistido) → invitar por link manual (`invite_url` en UI; **no** envío SMTP automático).

**Eliminar warehouse** (solo creador, solo desde `/warehouses`):
- `DELETE /api/warehouses/{warehouse_id}` con body `{ "confirm_name": "<nombre exacto>" }`.
- Requiere red; la UI deshabilita la acción offline.
- Solo `created_by` puede eliminar; miembros no creadores no ven el botón.
- Bloqueado con HTTP 409 si existe un lote intake con `status=processing`.
- Borrado atómico: filas relacionadas en BD + directorio `media_root/{warehouse_id}/`.
- Si falla el borrado de media → HTTP 500, warehouse intacto (rollback).
- Auditoría en logs del servidor (`warehouse_id`, `name`, `actor_user_id`); no en BD.
- API `detail` en inglés; snackbars UI en español.
- Tras éxito: limpiar `mw_selected_warehouse_id` si coincide, `purgeWarehouse()` en IndexedDB.
- Guard en `/app/*`: si el warehouse seleccionado ya no está en `GET /warehouses` → limpiar selección, snackbar, redirect `/warehouses`.
- Segunda llamada tras borrado exitoso → 404.

### Home (`/app/home`)
- Búsqueda en tiempo real (debounce 300ms).
- Filtros UI: **solo** favoritos y stock=0 (la API admite `with_photo` pero la UI no lo expone).
- Nube de tags ponderada por frecuencia.
- Vistas Cards/Lista (preferencia en `localStorage`); móvil fuerza Cards.
- Acciones: stock ±1, favorito, editar, reprocesar tags, borrar, modo lote (mover/favorito/borrar).
- Offline: ante error de red en stock/favorito → cola IndexedDB + UI optimista.

### Cajas (`/app/boxes`)
Árbol anidado expand/collapse, CRUD, **mover vía selector de padre** (no drag-and-drop), contadores recursivos, etiqueta QR imprimible.

### Detalle de caja (`/app/boxes/:id`)
Breadcrumbs navegables, búsqueda recursiva debounced, mismos componentes `item-card`/`item-list` que Home, atajos foto/lote con caja bloqueada.

### QR (`/app/scan`)
`BarcodeDetector` o entrada manual (`short_code` / `qr_token`). `short_code` ambiguo → 409. Deep link con redirect post-login.

### IA
- **Foto individual:** `/app/items/from-photo` → `draft-from-photo` → `/app/items/new`.
- **Lotes:** `/app/batches`, `/app/batches/:batchId` — cámara continua, cola de subidas, polling 5s, estados UX Nuevo/Procesado/Error/Guardado.

### Ops
Papelera, actividad (default 50 eventos), conflictos (keep_server / keep_client), Settings (PWA, SMTP, LLM, sync manual, export/import JSON).

---

## Routes

Definidas en `frontend/src/app/routes.ts`. Shell en `/app/*`; redirect raíz → `/login`; `/app/items/intake-batch` → `/app/batches`.

---

## Data Model

**18 tablas** (SQLAlchemy). Sin tablas `tags`, `item_tags`, `item_aliases` ni `photos`.

| Tabla | Notas |
|-------|-------|
| `users` | |
| `warehouses` | `created_by` |
| `memberships` | PK compuesta |
| `refresh_tokens` | Incluye hash de access persistente cuando `remember_me` |
| `password_reset_tokens` | |
| `boxes` | Sin `created_by`/`updated_by` — solo `TimestampMixin` |
| `items` | `tags`, `aliases` JSON; `photo_url` string |
| `item_favorites` | Por usuario |
| `stock_movements` | `command_id` único por item |
| `warehouse_invites` | |
| `activity_events` | |
| `smtp_settings`, `llm_settings` | Secretos cifrados; `updated_by` |
| `intake_batches`, `intake_drafts` | |
| `change_log`, `processed_commands`, `sync_conflicts` | Sync |

**Fotos:** filesystem `media_root/{warehouse_id}/...`, servidas en `/media/*`. Intake temporal en `.../intake/{batch_id}/`.

**Tags cloud:** agregación desde JSON de items, no tabla dedicada.

---

## Client State

| Almacén | Claves / stores |
|---------|-----------------|
| `localStorage` | `mw_access_token`, `mw_refresh_token`, `mw_persistent_session`, `mw_selected_warehouse_id`, `mw_device_id`, preferencia vista Cards/Lista |
| IndexedDB `my-warehouse-offline` | `commands`, `meta` (since_seq), `conflicts` |

**Sync cliente:** solo encola `stock.adjust`, `item.favorite`, `item.unfavorite` al fallar la petición HTTP. Sync es **manual** (`Forzar sync` en Settings); no hay auto-sync al reconectar.

---

## API Summary

**Base:** `/api` · **Auth:** Bearer JWT · **Health:** `/health`

Grupos: auth (8), warehouses+invites+activity+**DELETE warehouse**, boxes+QR, items+batch+draft, intake (11), photos upload, tags+cloud, settings SMTP/LLM, sync push/pull/resolve, export/import.

**Sync push** acepta 11 tipos de comando en backend; el cliente solo genera 3 en práctica.

**Conflictos:** UI expone `keep_server` y `keep_client`. El enum backend incluye `merge` pero no hay flujo distinto implementado ni UI para merge.

---

## LLM (Gemini)

- Modelos soportados (`backend/app/core/llm.py`): `gemini-3.1-flash-lite`, `gemini-3-flash`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`.
- Fallback en cascada + alias runtime (`-preview`, `-latest`) ante 404.
- Idioma: `es` | `en`. Paralelismo intake: 1–8 (default 4).
- Create/update item: auto-tags/alias si habilitado; fallback heurístico si falla todo.
- Foto individual: fallback heurístico.
- Intake batch: **sin** fallback no-IA → estado `error`.
- Reprocesar tags: desde Home y detalle de caja (`settings/llm/reprocess-item/{id}`).

---

## PWA

Manifest, iconos, Service Worker (solo `production`). Cache shell + `/media/**`; `/api/**` excluida. Install/update en shell y Settings con versión (`appData.version`).

---

## Deployment

- Backend: Docker rootless `uid=10001`, media en `/app/media`.
- Frontend: `nginxinc/nginx-unprivileged:8080`, build `--configuration production`.
- K8s (`deploy/k8s`): PostgreSQL externo, NFS RWX media, Traefik `/` + `/api` + `/media`.

---

## Feature Status (code-verified)

| Feature | Estado |
|---------|--------|
| Auth + remember me | ✅ |
| Warehouses + invites (link manual) | ✅ |
| Eliminar warehouse (creador, confirmación nombre) | ✅ |
| Cajas jerárquicas (mover por selector) | ✅ |
| Artículos + stock + favoritos + batch | ✅ |
| Búsqueda + tag cloud | ✅ |
| QR + etiquetas (QR vía qrserver.com) | ✅ |
| Settings SMTP/LLM | ✅ (SMTP test **simulado**) |
| Export/import JSON | ✅ |
| Foto + LLM draft | ✅ |
| Intake masivo | ✅ |
| PWA | ✅ |
| Sync backend completo | ✅ |
| Sync offline cliente | ⚠️ Solo stock + favoritos; sync manual |
| Invites por email automático | ❌ |
| Drag-and-drop UI | ❌ |
| Virtual scroll | ❌ |
| Cache offline de entidades | ❌ |
| Rate limiting auth | ❌ |
| QR por artículo | ❌ (fuera de alcance) |
| Roles / 2FA | ❌ (fuera de alcance) |
| Resolución merge de conflictos | ❌ (enum sin UI/flujo) |
| Filtro “con foto” en Home UI | ❌ (solo en API) |

---

## Assumptions (runtime)

- Dev: SQLite; prod: PostgreSQL.
- `forgot-password` devuelve `reset_token` en respuesta en dev (sin SMTP real).
- Etiquetas QR dependen de `api.qrserver.com`.
- Worker intake in-process; no apto multi-réplica sin rediseño.

---

## Validation

```bash
cd backend && uv run pytest    # 54 tests
cd frontend && npm run build
```

Tests por área: `test_auth_warehouses`, `test_delete_warehouse`, `test_slice2_boxes_items`, `test_slice3_search_tags`, `test_slice4_qr_scan`, `test_slice5_invites_activity`, `test_slice6_settings_llm_smtp`, `test_slice7_sync_conflicts`, `test_slice8_export_import`, `test_slice9_item_photo_draft`, `test_slice10_intake_batch`, `test_llm_enrichment_json_parsing`.
