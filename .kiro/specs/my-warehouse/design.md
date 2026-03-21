# Design — my-warehouse

## Arquitectura general

```
Browser (PWA)
  └── Angular 20 SPA
        ├── Angular Material UI
        ├── Service Worker (cache shell/assets, no /api)
        └── IndexedDB (cache offline + cola comandos)
              │  HTTP/REST (JWT Bearer)
              ▼
        FastAPI /api/v1
              ├── Auth endpoints
              ├── Warehouse / Box / Item endpoints
              ├── Intake batch endpoints
              ├── Sync endpoints
              ├── Settings endpoints (SMTP + LLM)
              └── Export/Import endpoints
                    │
              SQLAlchemy 2
                    │
              PostgreSQL (prod) / SQLite (dev)

        FastAPI también sirve:
              /media/** → archivos estáticos (fotos de artículos y lotes)
```

Despliegue en Kubernetes (Talos):
- Traefik Ingress: `/` → frontend (Nginx:8080), `/api` + `/media` → backend (uvicorn:8000)
- PostgreSQL externo al cluster (inyectado por `DATABASE_URL`)
- NFS PV/PVC RWX para `/app/media`

---

## Modelo de datos

### users
| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| email | string unique | |
| password_hash | string | Argon2 |
| display_name | string | |
| created_at, updated_at | timestamp | |

### warehouses
| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| name | string | |
| created_at, created_by | | |

### memberships
| Campo | Tipo | Notas |
|-------|------|-------|
| user_id | FK users | PK compuesta |
| warehouse_id | FK warehouses | PK compuesta |
| joined_at | timestamp | |

### boxes
| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| warehouse_id | FK | índice |
| parent_box_id | FK boxes nullable | árbol |
| name | string | |
| description | string nullable | |
| physical_location | string nullable | |
| qr_token | string unique | secrets.token_urlsafe() |
| short_code | string unique | humano, corto |
| is_inbound | bool default false | caja especial de entrada |
| version, created_at, updated_at, deleted_at | | soft-delete |
| created_by, updated_by | | auditoría |

Índices: `(warehouse_id, parent_box_id)`, `(warehouse_id, deleted_at)`

### items
| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| warehouse_id | FK | índice |
| box_id | FK boxes | |
| name | string | |
| description | string nullable | |
| physical_location | string nullable | |
| photo_url | string nullable | `/media/{wid}/items/{filename}` |
| version, created_at, updated_at, deleted_at | | soft-delete |
| created_by, updated_by | | auditoría |

Tags y aliases en tablas separadas (`item_tags`, `item_aliases`, `tags`).

### stock_movements
| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| warehouse_id | FK | |
| item_id | FK items | |
| delta | int | +1 / -1 |
| command_id | uuid unique nullable | idempotencia offline |
| occurred_at | timestamp | |
| created_by | | |

Stock de un artículo = `SUM(delta)` de sus movimientos.

### intake_batches
| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| warehouse_id | FK | |
| target_box_id | FK boxes | caja destino |
| created_by | FK users | |
| name | string nullable | |
| status | enum | `drafting\|processing\|review\|committed` |
| total_count, processed_count, committed_count | int | contadores |
| started_at, finished_at, created_at, updated_at | timestamp | |

### intake_drafts
| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| warehouse_id, batch_id | FK | |
| photo_url | string | storage temporal del lote |
| status | enum | `uploaded\|processing\|ready\|review\|rejected\|error\|committed` |
| position | int | orden de captura |
| suggested_name | string nullable | último nombre sugerido por IA |
| name, description | string nullable | editables por usuario |
| tags, aliases | json[] | |
| confidence | float | |
| quantity | int default 1 | stock objetivo antes de guardar |
| committed_quantity | int default 0 | stock aplicado al item creado |
| created_item_id | FK items nullable | |
| created_at, updated_at | timestamp | |

Mapeo UX: `Nuevo`=uploaded/processing, `Procesado`=ready/review, `Error`=error/rejected, `Guardado`=committed

### llm_settings (por warehouse)
| Campo | Tipo | Notas |
|-------|------|-------|
| warehouse_id | PK/FK | |
| provider | string | "gemini" |
| language | string | "es" \| "en" |
| model_priority | json array | orden de fallback |
| intake_parallelism | int 1..8 | default 4 |
| api_key_encrypted | string | cifrado con secret_store |
| auto_tags_enabled, auto_alias_enabled | bool | |

### Tablas de sync
- `change_log`: seq (bigserial PK), warehouse_id, entity_type, entity_id, action, entity_version, created_at
- `processed_commands`: command_id (uuid PK), warehouse_id, user_id, device_id, processed_at
- `sync_conflicts`: id, warehouse_id, entity_type, entity_id, client_data, server_data, resolved_at

---

## API REST — Endpoints principales

Base: `/api/v1` | Auth: `Bearer JWT`

### Auth
```
POST /auth/signup
POST /auth/login          { remember_me? }
POST /auth/refresh        { refresh_token? } + cookie
POST /auth/logout
POST /auth/change-password
POST /auth/forgot-password
POST /auth/reset-password
GET  /auth/me
```

### Warehouses
```
GET  /warehouses
POST /warehouses                          → crea warehouse + caja is_inbound
GET  /warehouses/{id}
GET  /warehouses/{id}/members
POST /warehouses/{id}/invites
POST /invites/{token}/accept
GET  /warehouses/{id}/activity
GET  /warehouses/{id}/export              ?format=json (default) | csv → ZIP con boxes.csv, items.csv, stock_movements.csv
POST /warehouses/{id}/import
```

### Boxes
```
GET  /warehouses/{wid}/boxes/tree
POST /warehouses/{wid}/boxes
GET  /warehouses/{wid}/boxes/{bid}
PATCH /warehouses/{wid}/boxes/{bid}
POST /warehouses/{wid}/boxes/{bid}/move   { new_parent_box_id }
DELETE /warehouses/{wid}/boxes/{bid}      { force? }
POST /warehouses/{wid}/boxes/{bid}/restore
GET  /boxes/by-qr/{qr_token}
GET  /boxes/resolve/{identifier}          → 409 si short_code ambiguo
GET  /warehouses/{wid}/boxes/{bid}/items  → lista recursiva compatible con Home
```

### Items
```
GET  /warehouses/{wid}/items              ?q=&favorites_only=&stock_zero=&with_photo=
POST /warehouses/{wid}/items              → crea item + stock_movement +1
POST /warehouses/{wid}/items/draft-from-photo  { image_data_url }
GET  /warehouses/{wid}/items/{iid}
PATCH /warehouses/{wid}/items/{iid}
DELETE /warehouses/{wid}/items/{iid}
POST /warehouses/{wid}/items/{iid}/restore
POST /warehouses/{wid}/items/{iid}/favorite
POST /warehouses/{wid}/items/batch        { action: move|favorite|unfavorite|delete }
POST /warehouses/{wid}/items/{iid}/stock/adjust  { delta, command_id }
```

### Intake
```
POST /warehouses/{wid}/intake/batches
GET  /warehouses/{wid}/intake/batches     ?include_committed=&only_mine=&limit=
GET  /warehouses/{wid}/intake/batches/{bid}
POST /warehouses/{wid}/intake/batches/{bid}/photos   multipart files[]
POST /warehouses/{wid}/intake/batches/{bid}/start    { retry_errors }
PATCH /warehouses/{wid}/intake/drafts/{did}
POST /warehouses/{wid}/intake/drafts/{did}/reprocess  { mode: photo|name }
DELETE /warehouses/{wid}/intake/drafts/{did}
POST /warehouses/{wid}/intake/batches/{bid}/commit
DELETE /warehouses/{wid}/intake/batches/{bid}
```

### Settings / Tags / Sync / Photos
```
GET|PUT /settings/smtp?warehouse_id=
POST    /settings/smtp/test?warehouse_id=
GET|PUT /settings/llm?warehouse_id=
POST    /settings/llm/reprocess-item/{iid}?warehouse_id=  { fields }
GET     /warehouses/{wid}/tags
GET     /warehouses/{wid}/tags/cloud
POST    /sync/push
GET     /sync/pull?warehouse_id=&since_seq=
POST    /sync/resolve
POST    /photos/upload?warehouse_id=
```

---

## Componentes frontend

### Shell
- Sidenav `over` en móvil, `side` en escritorio
- Toolbar: warehouse chip + QR + Lotes (visibles siempre) + cámara + PWA + settings + logout
- Móvil: QR + Lotes visibles, resto en menú overflow
- Sección "Lotes" en sidenav como enlace de primer nivel
- Indicador de estado offline/sync siempre visible en toolbar (icono + tooltip): `cloud_done` (online), `cloud_off` (offline, rojo), `cloud_upload` (pending, naranja), `sync` animado (syncing, azul), `sync_problem` (error, rojo)

### Rutas principales
```
/login, /signup, /forgot-password, /reset-password
/invites/:token
/app/warehouses
/app/home
/app/boxes, /app/boxes/:id
/app/items/new, /app/items/from-photo, /app/items/:id
/app/batches, /app/batches/:batchId
/app/scan, /app/scan/:qrToken
/app/activity, /app/trash, /app/conflicts, /app/settings
```

### Componentes reutilizables clave
- `item-card` — card compacta con avatar, nombre, ruta, stock chip (-/+), acciones iconográficas
- `item-list` — tabla densa con columnas Artículo/Ruta/Stock/Tags/Acciones
- `tag-cloud` — nube de tags con peso visual por frecuencia
- `box-label-print` — etiqueta imprimible con QR + short_code

### Servicios clave
| Servicio | Responsabilidad |
|----------|----------------|
| `AuthService` | login/signup/refresh/logout, estado de sesión |
| `WarehouseService` | CRUD warehouses, membresía |
| `BoxService` | árbol, CRUD, move, QR lookup |
| `ItemService` | búsqueda, CRUD, favoritos, stock |
| `IntakeService` | batches, fotos, drafts, commit |
| `SyncService` | IndexedDB, cola offline, push/pull/resolve; expone `syncStatus` signal (`online\|offline\|syncing\|pending\|error`) |
| `NotificationService` | snackbars success/error/info |
| `PwaService` | install prompt, SW updates |

---

## Flujos clave

### Alta por foto (individual)
```
Usuario → /app/items/from-photo
  → captura/sube foto (data URL)
  → POST /items/draft-from-photo
  → Gemini Vision (fallback heurístico si falla)
  → navega a /app/items/new con datos pre-rellenados
  → usuario confirma caja y guarda
  → POST /items → stock_movement +1
```

### Captura masiva (batch)
```
Usuario → /app/batches/:batchId
  → sube fotos (multipart) → intake_drafts en 'uploaded'
  → worker backend procesa en paralelo (ThreadPoolExecutor)
  → drafts pasan a 'ready' o 'error'
  → usuario revisa/edita inline
  → POST /commit → items creados + stock_movement +quantity
  → fotos movidas a /media/{wid}/items/
```

### Sync offline
```
Acción offline → command_id + payload → IndexedDB queue
Al reconectar:
  POST /sync/push → servidor aplica comandos (idempotente por command_id)
  GET  /sync/pull?since_seq=N → change_log → actualiza IndexedDB
  Conflictos → /app/conflicts → usuario resuelve
```

---

## Seguridad

- Passwords: Argon2
- Tokens: HS256 JWT, access (30min) + refresh rotativo (30d) + persistente sin exp (365d)
- Secretos SMTP/LLM: AES cifrado en backend (`secret_store.py`), nunca en frontend
- QR tokens: `secrets.token_urlsafe()`, validados por membresía
- Kubernetes: rootless (uid=10001), seccomp RuntimeDefault, readOnlyRootFilesystem, drop ALL capabilities
- CORS restringido a `CORS_ORIGINS` configurable

---

## Almacenamiento de fotos

- Dev/prod single-node: filesystem local en `MEDIA_ROOT` (`./media` por defecto)
- Estructura: `/media/{warehouse_id}/items/{filename}` (definitivo) y `/media/{warehouse_id}/intake/{batch_id}/{filename}` (temporal)
- Servido por FastAPI `StaticFiles` en `/media/**`
- En K8s: NFS PV/PVC RWX montado en `/app/media`
- `photo_url` en items apunta a `/media/...` (URL relativa servible)


---

## EPIC M — Sugerencias de reorganización de cajas (box-reorganization-suggestions)

### Visión general

El usuario lanza un análisis bajo demanda que envía el inventario completo del warehouse a Gemini. El LLM propone agrupaciones semánticas de artículos por tipología y el sistema las traduce en sugerencias de movimiento concretas (artículo X → caja Y). El análisis corre en segundo plano; el usuario puede seguir usando la app mientras espera. Las sugerencias persisten en una sesión reanudable y el usuario las confirma o descarta una a una.

### Arquitectura

```
Frontend (Angular)
  ReorganizationComponent (/app/reorganization)
    └── ReorganizationService
          ├── startAnalysis()       POST /warehouses/{wid}/reorganization/sessions
          ├── getCurrentSession()   GET  /warehouses/{wid}/reorganization/sessions/current
          ├── confirmSuggestion()   POST .../suggestions/{sid}/confirm
          ├── dismissSuggestion()   POST .../suggestions/{sid}/dismiss
          └── pollSession$()        interval(3000) + switchMap + takeUntil(status !== 'running')
    └── BackgroundJobsService (singleton)
          └── activeJobs: Signal<BackgroundJob[]>
    └── BackgroundJobsIndicatorComponent (shell toolbar)

Backend (FastAPI)
  POST /warehouses/{wid}/reorganization/sessions
    └── crea ReorganizationSession (status=running)
    └── start_reorganization_worker(session_id, warehouse_id)
  GET  /warehouses/{wid}/reorganization/sessions/current
  POST .../suggestions/{suggestion_id}/confirm
  POST .../suggestions/{suggestion_id}/dismiss

  reorganization_workers.py (ThreadPoolExecutor, 1 hilo por sesión)
    └── run_analysis(session_id, warehouse_id, db)
          ├── build_llm_prompt(items, boxes)
          ├── llm_enrichment (model_priority + fallback en cascada)
          ├── parse_llm_response(raw, warehouse_boxes)
          └── actualiza session.status → ready | error
```

### Modelo de datos

#### reorganization_sessions

| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| warehouse_id | FK warehouses | índice |
| created_by | FK users | |
| status | string(24) | `running\|ready\|error\|completed\|archived` |
| suggestions | JSON | array de `ReorganizationSuggestionItem` |
| error_message | string nullable | solo cuando status=error |
| created_at, updated_at | timestamp | |

Estructura de cada elemento del array `suggestions`:

```json
{
  "suggestion_id": "uuid",
  "item_id": "uuid",
  "item_name": "string",
  "from_box_id": "uuid",
  "from_box_name": "string",
  "to_box_id": "uuid",
  "to_box_name": "string",
  "reason": "string",
  "status": "pending | confirmed | dismissed"
}
```

Migración Alembic: `20260321_0013_reorganization_sessions.py`

**Decisión A-001 (2026-03-21):** Las sugerencias se almacenan como JSON en la sesión (no tabla separada) para simplicidad. El volumen esperado es bajo (decenas de sugerencias por warehouse). Si en el futuro se necesita consultar sugerencias individualmente por SQL, se puede migrar a tabla separada sin romper la API.

### Servicio: reorganization.py

```python
def build_llm_prompt(items: list[dict], boxes: list[dict]) -> str:
    """
    Construye el prompt para Gemini con:
    - Lista de artículos: id, name, tags, current_box_id, current_box_name
    - Lista de cajas disponibles: id, name
    - Instrucción de devolver JSON con array de movimientos sugeridos
    """

def parse_llm_response(raw: str, warehouse_boxes: dict[str, str]) -> list[dict]:
    """
    Parsea la respuesta JSON del LLM.
    - Valida que to_box_id exista en warehouse_boxes
    - Descarta sugerencias con box_id destino inválido (sin error)
    - Descarta sugerencias donde from_box_id == to_box_id
    - Retorna lista de sugerencias válidas con suggestion_id generado
    """

def run_analysis(session_id: str, warehouse_id: str, db: Session) -> None:
    """
    Ejecutado desde el worker. Flujo:
    1. Carga artículos activos + cajas del warehouse
    2. Si no hay API key → actualiza session.status=error, error_message descriptivo
    3. build_llm_prompt → llama a Gemini con model_priority + fallback
    4. parse_llm_response → filtra sugerencias inválidas
    5. session.suggestions = sugerencias válidas, session.status = ready
    6. Si falla → session.status = error, session.error_message = str(exc)
    """

def confirm_suggestion(
    session: ReorganizationSession,
    suggestion_id: str,
    db: Session,
    user_id: str,
) -> ReorganizationSession:
    """
    - Busca sugerencia por suggestion_id en session.suggestions
    - Si no existe → 404
    - Carga item; si deleted_at IS NOT NULL → 404
    - Si item.box_id == to_box_id → marca confirmed (idempotente, sin mover)
    - Si no → actualiza item.box_id = to_box_id
    - append_change_log(entity_type="item", action="move", payload={...})
    - Marca sugerencia como confirmed
    - Si todas las sugerencias son confirmed/dismissed → session.status = completed
    - Retorna sesión actualizada
    """

def dismiss_suggestion(
    session: ReorganizationSession,
    suggestion_id: str,
    db: Session,
) -> ReorganizationSession:
    """
    - Marca sugerencia como dismissed
    - Si todas las sugerencias son confirmed/dismissed → session.status = completed
    - Retorna sesión actualizada
    """
```

### Worker: reorganization_workers.py

Patrón idéntico a `intake_workers.py` con `ThreadPoolExecutor`. Un hilo por sesión (no paralelismo interno).

**Decisión A-002 (2026-03-21):** 1 hilo por sesión porque el cuello de botella es la llamada LLM (I/O bound, ~5-15s), no CPU. El ThreadPoolExecutor con 1 worker por sesión evita saturar la API de Gemini y simplifica el manejo de errores.

```python
_REORG_WORKERS_LOCK = threading.Lock()
_ACTIVE_REORG_WORKERS: dict[str, threading.Thread] = {}

def start_reorganization_worker(session_id: str, warehouse_id: str) -> None:
    """
    Lanza hilo daemon que llama a run_analysis().
    Si ya hay un hilo activo para session_id, no lanza otro.
    Al terminar (éxito o error), elimina la entrada del dict.
    """
```

### Endpoints: reorganization.py (router)

```
POST /warehouses/{wid}/reorganization/sessions
  Query param: force: bool = False
  - Si force=False y existe sesión running/ready → devuelve sesión existente (200)
  - Si force=True → archiva sesión anterior (status=archived), crea nueva
  - Crea ReorganizationSession(status=running), lanza worker
  - Devuelve sesión con status=running (201)

GET /warehouses/{wid}/reorganization/sessions/current
  - Busca sesión con status running o ready para el warehouse
  - Si no existe, devuelve la más reciente (completed/archived)
  - Si no hay ninguna → 404

POST /warehouses/{wid}/reorganization/sessions/{sid}/suggestions/{suggestion_id}/confirm
  - Llama a confirm_suggestion()
  - Devuelve sesión actualizada

POST /warehouses/{wid}/reorganization/sessions/{sid}/suggestions/{suggestion_id}/dismiss
  - Llama a dismiss_suggestion()
  - Devuelve sesión actualizada
```

Todos los endpoints usan `require_warehouse_membership` de `app/api/deps.py`.

### Schemas Pydantic

```python
class ReorganizationSuggestionItem(BaseModel):
    suggestion_id: str
    item_id: str
    item_name: str
    from_box_id: str
    from_box_name: str
    to_box_id: str
    to_box_name: str
    reason: str
    status: Literal["pending", "confirmed", "dismissed"]

class ReorganizationSessionRead(BaseModel):
    id: str
    warehouse_id: str
    created_by: str
    status: Literal["running", "ready", "error", "completed", "archived"]
    suggestions: list[ReorganizationSuggestionItem]
    error_message: str | None
    created_at: datetime
    updated_at: datetime

class ReorganizationSessionCreate(BaseModel):
    pass  # body vacío; force viene como query param
```

### Frontend: ReorganizationService

```typescript
interface ReorganizationSession {
  id: string;
  warehouse_id: string;
  created_by: string;
  status: 'running' | 'ready' | 'error' | 'completed' | 'archived';
  suggestions: ReorganizationSuggestionItem[];
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

interface ReorganizationSuggestionItem {
  suggestion_id: string;
  item_id: string;
  item_name: string;
  from_box_id: string;
  from_box_name: string;
  to_box_id: string;
  to_box_name: string;
  reason: string;
  status: 'pending' | 'confirmed' | 'dismissed';
}
```

Métodos del servicio:
- `startAnalysis(warehouseId, force = false)` → `Observable<ReorganizationSession>`
- `getCurrentSession(warehouseId)` → `Observable<ReorganizationSession | null>`
- `confirmSuggestion(warehouseId, sessionId, suggestionId)` → `Observable<ReorganizationSession>`
- `dismissSuggestion(warehouseId, sessionId, suggestionId)` → `Observable<ReorganizationSession>`
- `pollSession$(warehouseId, sessionId)` → `Observable<ReorganizationSession>` con `interval(3000)` + `switchMap` + `takeUntil` cuando `status !== 'running'`

**Decisión A-003 (2026-03-21):** Polling cada 3s mientras status=running. Se cancela automáticamente al detectar status distinto de 'running'. No se usa WebSocket para mantener consistencia con el patrón de polling ya usado en intake batches (5s).

### Frontend: BackgroundJobsService

```typescript
interface BackgroundJob {
  id: string;
  type: 'reorganization' | string;  // extensible a futuros jobs
  label: string;
  status: 'running' | 'completed' | 'error';
  warehouseId: string;
}

@Injectable({ providedIn: 'root' })
class BackgroundJobsService {
  activeJobs: Signal<BackgroundJob[]>;
  registerJob(job: BackgroundJob): void;
  unregisterJob(jobId: string): void;
  updateJobStatus(jobId: string, status: BackgroundJob['status']): void;
}
```

**Decisión A-004 (2026-03-21):** `BackgroundJobsService` es un singleton Angular que actúa como bus de estado para operaciones pesadas. Diseñado para ser extensible a otros tipos de jobs futuros (ej. export masivo, sync forzado). El `ReorganizationService` registra el job al lanzar el análisis y lo desregistra al completar (con snackbar de éxito/error).

### Frontend: BackgroundJobsIndicatorComponent

Componente standalone en el shell toolbar. Muestra un icono `pending_actions` con badge numérico cuando `activeJobs().length > 0`. Al hacer click, muestra un panel con la lista de jobs activos y su estado.

### Frontend: ReorganizationComponent

Ruta lazy: `/app/reorganization` (standalone, `loadComponent` en `app.routes.ts`).

Estados de la vista:
1. **empty**: sin sesión → botón "Analizar reorganización"
2. **loading**: status=running → spinner + indicador en header
3. **ready**: status=ready → lista de sugerencias agrupadas
4. **completed**: status=completed/archived → lista con estados + botón "Nuevo análisis" (con MatDialog de confirmación)

Agrupación de sugerencias:
- Agrupar por `from_box_id`
- Cada grupo: `MatExpansionPanel` con header (nombre caja + badge contador pendientes)
- Ordenar grupos priorizando los que comparten `to_box_id` con otros grupos (minimiza desplazamientos físicos)
- Cada sugerencia: `MatCard` con artículo, flecha →, caja destino, razón, botones "Confirmar" y "Descartar"

Actualización optimista:
- Al confirmar/descartar: actualizar estado local inmediatamente (antes de respuesta HTTP)
- Si falla HTTP: revertir al estado anterior + snackbar de error

### Sidenav

Añadir entrada "Reorganización" con icono `auto_fix_high` en el shell sidenav, ruta `/app/reorganization`.

---

## Correctness Properties — EPIC M

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Aislamiento de warehouse en sugerencias

*For any* warehouse y análisis de reorganización ejecutado, todas las sugerencias generadas deben referenciar únicamente artículos con `deleted_at IS NULL` y cajas pertenecientes a ese warehouse; ninguna sugerencia debe referenciar entidades de otro warehouse.

**Validates: Requirements M.1.1, M.3.1, M.3.3**

### Property 2: Estructura completa de cada sugerencia

*For any* sugerencia generada por el servicio de reorganización, debe contener los campos: `suggestion_id`, `item_id`, `item_name`, `from_box_id`, `from_box_name`, `to_box_id`, `to_box_name`, `reason`, y `status` con valor inicial `pending`.

**Validates: Requirements M.1.2**

### Property 3: Descarte de cajas destino inválidas

*For any* respuesta del LLM que contenga sugerencias con `to_box_id` que no exista en el warehouse, esas sugerencias deben ser descartadas silenciosamente; las sugerencias con `to_box_id` válido deben conservarse.

**Validates: Requirements M.3.2**

### Property 4: Prompt incluye todos los artículos activos

*For any* warehouse con N artículos activos (deleted_at IS NULL), el prompt construido por `build_llm_prompt` debe incluir exactamente esos N artículos con sus títulos y tags; no debe incluir artículos borrados.

**Validates: Requirements M.2.1**

### Property 5: Confirm round-trip — box_id + estado + change_log

*For any* sesión en estado `ready` y sugerencia en estado `pending`, al confirmarla: el `box_id` del artículo debe actualizarse al `to_box_id` de la sugerencia, el estado de la sugerencia en la sesión debe ser `confirmed`, y debe existir una entrada en `change_log` con `entity_type="item"`, `action="move"` y el `user_id` del confirmante.

**Validates: Requirements M.4.1, M.4.2, M.4.5**

### Property 6: Idempotencia de confirm

*For any* artículo que ya se encuentra en la caja destino de una sugerencia, confirmar esa sugerencia debe marcarla como `confirmed` sin error y sin crear movimientos duplicados en `change_log`.

**Validates: Requirements M.4.4**

### Property 7: Dismiss aísla solo la sugerencia afectada

*For any* sesión con múltiples sugerencias, descartar una sugerencia debe cambiar únicamente el estado de esa sugerencia a `dismissed`; el estado de las demás sugerencias debe permanecer inalterado.

**Validates: Requirements M.6.3**

### Property 8: Transición a "completed" cuando todas las sugerencias están resueltas

*For any* sesión donde todas las sugerencias tienen estado `confirmed` o `dismissed`, el estado de la sesión debe ser `completed`.

**Validates: Requirements M.6.4**

### Property 9: Force archiva sesión anterior y crea nueva

*For any* warehouse con sesión existente en estado `ready` o `running`, al invocar `POST /sessions?force=true` la sesión anterior debe quedar en estado `archived` y debe crearse una nueva sesión en estado `running`.

**Validates: Requirements M.6.6**

### Property 10: Worker actualiza sesión a ready con sugerencias persistidas

*For any* sesión en estado `running` cuyo análisis LLM finaliza con éxito, el worker debe actualizar `session.status = ready` y `session.suggestions` debe contener las sugerencias generadas (todas con `status = pending`).

**Validates: Requirements M.5.3, M.6.1, M.6.2**

### Property 11: Agrupación por caja origen

*For any* lista de sugerencias, la función de agrupación del frontend debe producir grupos donde todas las sugerencias de un mismo grupo tienen el mismo `from_box_id`, y cada `from_box_id` aparece en exactamente un grupo.

**Validates: Requirements M.7.1**

### Property 12: Ordenación de grupos por caja destino compartida

*For any* conjunto de grupos de sugerencias, el algoritmo de ordenación debe colocar primero los grupos cuyo `to_box_id` más frecuente es compartido con otros grupos, de modo que los grupos que "convergen" en la misma caja destino aparezcan consecutivos.

**Validates: Requirements M.7.3**

### Property 13: Actualización optimista del estado local

*For any* sugerencia en estado `pending`, al invocar confirm o dismiss en el frontend, el estado local de la sugerencia debe cambiar inmediatamente (antes de recibir respuesta HTTP); si la petición HTTP falla, el estado debe revertir al valor anterior.

**Validates: Requirements M.7.5**

---

## Error Handling — EPIC M

| Situación | Comportamiento |
|-----------|---------------|
| Sin API key Gemini configurada | `run_analysis` → session.status=error, error_message="LLM no configurado para este warehouse". El endpoint POST devuelve la sesión con status=error. |
| LLM falla o respuesta no parseable | `run_analysis` → session.status=error, error_message con detalle. Frontend muestra snackbar de error. |
| Artículo borrado al confirmar | 404 con mensaje "Item not found or deleted" |
| Sesión no encontrada | 404 |
| Sugerencia no encontrada en sesión | 404 |
| Usuario sin membresía | 403 (via `require_warehouse_membership`) |
| Sesión ya en running/ready sin force | Devuelve sesión existente (200, no error) |
| Fallo HTTP en confirm/dismiss (frontend) | Revertir estado optimista + snackbar de error |

---

## Testing Strategy — EPIC M

### Tests backend (`backend/tests/test_box_reorganization_suggestions.py`)

**Unit tests** (ejemplos concretos y casos borde):
- POST /sessions sin API key → sesión con status=error
- POST /sessions con sesión running existente → devuelve sesión existente
- POST /sessions?force=true → archiva anterior, crea nueva
- GET /sessions/current sin sesiones → 404
- Confirm sobre artículo borrado → 404
- Confirm sobre artículo ya en caja destino → idempotente, sin error
- Dismiss de sugerencia → estado dismissed, demás inalteradas
- Todas las sugerencias resueltas → session.status=completed
- Usuario sin membresía → 403

**Property tests** (usando `hypothesis`):
- Configurar mínimo 100 iteraciones por propiedad (`settings(max_examples=100)`)
- Cada test referencia la propiedad del diseño en un comentario:
  `# Feature: box-reorganization-suggestions, Property N: <texto>`

| Test de propiedad | Propiedad |
|-------------------|-----------|
| `test_suggestions_only_reference_warehouse_entities` | Property 1 |
| `test_suggestion_has_all_required_fields` | Property 2 |
| `test_invalid_to_box_id_discarded` | Property 3 |
| `test_prompt_includes_all_active_items` | Property 4 |
| `test_confirm_updates_box_and_logs` | Property 5 |
| `test_confirm_idempotent_when_already_in_target` | Property 6 |
| `test_dismiss_isolates_single_suggestion` | Property 7 |
| `test_session_completed_when_all_resolved` | Property 8 |
| `test_force_archives_previous_session` | Property 9 |
| `test_worker_sets_ready_with_suggestions` | Property 10 |

### Tests frontend

**Unit tests** (Jest/Karma):
- `ReorganizationService`: métodos HTTP, polling con takeUntil
- `BackgroundJobsService`: register/unregister/update signals
- Función de agrupación por `from_box_id` (Property 11)
- Algoritmo de ordenación por `to_box_id` compartido (Property 12)
- Actualización optimista + reversión en error (Property 13)

**Property tests** (usando `fast-check`):
- Configurar mínimo 100 iteraciones: `fc.assert(fc.property(...), { numRuns: 100 })`
- Tag format: `// Feature: box-reorganization-suggestions, Property N: <texto>`

| Test de propiedad | Propiedad |
|-------------------|-----------|
| `groupSuggestions groups by from_box_id` | Property 11 |
| `sortGroups prioritizes shared to_box_id` | Property 12 |
| `optimistic update reverts on HTTP error` | Property 13 |
