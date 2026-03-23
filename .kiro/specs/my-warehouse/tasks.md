# Tasks — my-warehouse

> Estado del producto a fecha 2026-03-08. El MVP está completado.
> Este fichero sirve como referencia de lo implementado y punto de partida para trabajo futuro.

---

## Completado ✅

### Auth + Warehouses + Shell
- [x] Backend: signup, login (remember_me), refresh, logout, me, change-password, forgot-password, reset-password
- [x] Backend: list/create/get/members de warehouses
- [x] Backend: refresh tokens rotativos con jti, access token persistente sin exp, cookie HttpOnly
- [x] Backend: comparaciones de expiración UTC timezone-aware
- [x] Frontend: pantallas login/signup/forgot/reset/warehouses
- [x] Frontend: shell responsive (sidenav over/side), interceptor JWT con refresh automático en 401
- [x] Frontend: guards y selección persistida de warehouse
- [x] Migraciones: `20260222_0001`, `20260222_0002`

### Boxes + Items + Favoritos + Stock
- [x] Backend: CRUD cajas con árbol, move con validación de ciclos, soft-delete/restore
- [x] Backend: CRUD items, favoritos por usuario, stock como stock_movements idempotentes
- [x] Backend: acciones en lote (move/favorite/unfavorite/delete)
- [x] Frontend: vistas home, boxes, box-detail, item-form
- [x] Frontend: filtros rápidos, acciones rápidas (+/- stock, favorito), selección en lote
- [x] Migración: `20260222_0003`

### Búsqueda + Tags + Nube
- [x] Backend: búsqueda con ranking por relevancia, filtro por tag, endpoint tags/cloud
- [x] Frontend: búsqueda incremental con debounce, filtros rápidos, nube de tags con peso visual
- [x] Tests: `test_slice3_search_tags.py`

### QR + Scan + Detalle recursivo
- [x] Backend: GET /boxes/by-qr/{qr_token}, GET /boxes/resolve/{identifier} (409 si ambiguo)
- [x] Frontend: /app/scan con BarcodeDetector + fallback manual por short_code
- [x] Frontend: deep link con redirect post-login, breadcrumbs navegables en detalle de caja
- [x] Tests: `test_slice4_qr_scan.py`

### Multiusuario: invites + papelera + actividad
- [x] Backend: invitaciones con token/expiración, endpoint de actividad con eventos clave
- [x] Backend: envío de email de invitación vía SMTP cuando está configurado (fallo no bloquea)
- [x] Frontend: /invites/:token, /app/trash, /app/activity
- [x] Migración: `20260222_0004`

### Settings: SMTP + Gemini LLM
- [x] Backend: /settings/smtp (cifrado), /settings/smtp/test, /settings/llm con model_priority
- [x] Backend: autogeneración tags/aliases en create/update con fallback en cascada
- [x] Frontend: Settings con secciones SMTP, LLM, reordenación de modelos, reprocesado desde cards
- [x] Migraciones: `20260222_0005`, `20260305_0011`

### Offline + Sync + Conflictos
- [x] Backend: change_log, processed_commands, sync_conflicts; /sync/push, /sync/pull, /sync/resolve
- [x] Frontend: SyncService con IndexedDB, cola offline para favorite/stock, /app/conflicts
- [x] Migración: `20260222_0006`
- [x] Frontend: indicador offline/sync en tiempo real en toolbar (signal `syncStatus` en SyncService, icono + tooltip en shell)

### Export / Import
- [x] Backend: GET /warehouses/{id}/export, POST /warehouses/{id}/import con remapeo de IDs
- [x] Frontend: acciones Export/Import en Settings
- [x] Export en formato CSV además de JSON

### Alta por foto (LLM Vision)
- [x] Backend: POST /items/draft-from-photo con Gemini Vision + fallback heurístico
- [x] Backend: POST /photos/upload para persistir foto y obtener photo_url
- [x] Frontend: /app/items/from-photo con captura/subida, preview estable (data URL), restauración de estado en remount
- [x] Tests: `test_slice9_item_photo_draft.py`

### Captura masiva por lote (Intake Batch)
- [x] Backend: modelos intake_batches + intake_drafts, worker continuo con ThreadPoolExecutor
- [x] Backend: endpoints intake completos (create/upload/start/get/update/reprocess/commit/delete)
- [x] Backend: quantity + committed_quantity en drafts, stock_movement diferencial en committed
- [x] Backend: llm_settings.intake_parallelism configurable (1..8)
- [x] Frontend: módulo /app/batches + /app/batches/:batchId
- [x] Frontend: cámara integrada con flujo "Aceptar y siguiente", cola local de subidas
- [x] Frontend: polling colaborativo cada 5s, chip de stock consistente con Home
- [x] Migraciones: `20260305_0009`, `20260305_0010`, `20260307_0012`

### Infraestructura y PWA
- [x] Dockerfiles: backend rootless (uid=10001), frontend Nginx unprivileged (puerto 8080)
- [x] Kubernetes: manifests en deploy/k8s/, hardening PSS restricted, NFS para media, job Alembic
- [x] PWA: manifest.webmanifest, iconos, Angular SW, install/update CTA, versión en appData
- [x] Etiquetas imprimibles de caja con QR + short_code + autoescalado de nombre

---

## Backlog

### Sugerencias de reorganización de cajas (box-reorganization-suggestions)

> Diseño técnico completo en `design.md` sección "EPIC M". Migración: `20260321_0013_reorganization_sessions.py`.

#### M.5 + M.6: Modelo, migración y worker (base de datos y background job)
- [x] Backend: modelo `ReorganizationSession` (`app/models/reorganization_session.py`) con campos: id (UUID PK), warehouse_id (FK), created_by (FK), status (running/ready/error/completed/archived), suggestions (JSON), error_message (nullable), created_at, updated_at
- [x] Backend: migración Alembic `20260321_0013_reorganization_sessions.py`
- [x] Backend: worker `reorganization_workers.py` con ThreadPoolExecutor (1 hilo por sesión, patrón de `intake_workers.py`)

#### M.1–M.3: Servicio LLM y schemas
- [x] Backend: servicio `reorganization.py` con `build_llm_prompt(items, boxes)`, `parse_llm_response(raw, warehouse_boxes)`, `run_analysis(session_id, warehouse_id, db)`, `confirm_suggestion(...)`, `dismiss_suggestion(...)`
- [x] Backend: schemas Pydantic `ReorganizationSuggestionItem`, `ReorganizationSessionRead`, `ReorganizationSessionCreate` (`app/schemas/reorganization.py`)

#### M.4–M.6: Endpoints REST
- [x] Backend: router `app/api/v1/endpoints/reorganization.py` con los 4 endpoints (POST /sessions, GET /sessions/current, POST confirm, POST dismiss)
- [x] Backend: registrar router en `api.py`
- [x] Backend: tests `test_box_reorganization_suggestions.py` (unit + property tests con hypothesis, mínimo 100 iteraciones)

#### M.5: Frontend — BackgroundJobsService e indicador en shell
- [x] Frontend: `BackgroundJobsService` singleton con signal `activeJobs: Signal<BackgroundJob[]>` y métodos register/unregister/update
- [x] Frontend: `BackgroundJobsIndicatorComponent` en shell toolbar (icono `pending_actions` + badge, panel de jobs activos)

#### M.5–M.6: Frontend — ReorganizationService
- [x] Frontend: `reorganization.service.ts` con `startAnalysis()`, `getCurrentSession()`, `confirmSuggestion()`, `dismissSuggestion()`, `pollSession$()`  (interval 3s + takeUntil status !== 'running')
- [x] Frontend: integración con `BackgroundJobsService` (register al lanzar, unregister + snackbar al completar)

#### M.7–M.8: Frontend — Vista y sidenav
- [x] Frontend: `ReorganizationComponent` standalone en `/app/reorganization` (lazy-loaded) con estados: empty / loading / ready / completed
- [x] Frontend: agrupación por `from_box_id` con `MatExpansionPanel`, ordenación por `to_box_id` compartido, actualización optimista con reversión en error
- [x] Frontend: entrada "Reorganización" con icono `auto_fix_high` en shell sidenav

### Offline
- [ ] Cobertura offline completa: crear/editar/mover cajas y artículos sin conexión
- [ ] Merge por campos en resolución de conflictos de metadatos

### Export / Import
- [ ] Reporte de errores detallado en import (qué filas fallaron y por qué)

### QR por artículo
- [ ] Generar qr_token por artículo (actualmente solo por caja)
- [ ] Escaneo de artículo → detalle directo

### Roles y permisos
- [ ] Rol "solo lectura" por warehouse

### Rendimiento
- [ ] Migrar búsqueda a PostgreSQL full-text + trigram
- [ ] Virtual scroll en listas grandes (CDK VirtualScrollViewport)
- [ ] Cache de imágenes con ETag/immutable headers

### Seguridad
- [ ] Rate limiting en endpoints de auth y reset-password
- [ ] 2FA (TOTP)

### Observabilidad
- [ ] Métricas básicas (Prometheus/OpenTelemetry)
- [ ] Health check extendido (BD, media storage)

---

## Cómo añadir una nueva tarea

1. Leer `requirements.md` y `design.md` para entender el contexto.
2. Añadir la tarea en la sección de backlog correspondiente (o crear una nueva si no encaja).
3. Al implementar: marcar con `[x]` y mover a "Completado"; actualizar `requirements.md` / `design.md` si el cambio afecta requisitos o arquitectura.
