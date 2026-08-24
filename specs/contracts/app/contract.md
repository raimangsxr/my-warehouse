# app Contract

**Product:** my-warehouse — PWA de inventario doméstico (garaje/trastero).  
**Versions:** backend `0.3.4`, frontend `0.3.5`.  
**Last updated:** 2026-08-25 (change `011-remove-warehouse-member`).

## Governance

- **Este contrato describe el comportamiento implementado**, verificado contra `backend/` y `frontend/`.
- Ante discordancia entre documentación y código, **prevalece el código** hasta que un change SDD actualice el contrato de forma intencional.
- `specs.md` en la raíz está **deprecado** y no debe usarse para planificar ni implementar.

## Purpose

Aplicación **online-first** para localizar objetos físicos mediante:

- cajas jerárquicas con QR por caja,
- artículos con foto, stock, favoritos, tags y alias,
- búsqueda con relevancia y escaneo QR,
- colaboración multiusuario con roles Administrador y Contribuidor por warehouse,
- **cola offline limitada** (stock y favoritos) + sync manual,
- enriquecimiento LLM (Gemini) y captura masiva por lotes.

No es offline-first completo: la mayoría de operaciones requieren red.

---

## Domain Concepts

| Concepto | Implementación actual |
|----------|----------------------|
| **User** | Email + password (Argon2), nombre visible y warehouse predeterminado opcional. Múltiples warehouses. |
| **Warehouse** | Membresías con rol `administrator` o `contributor`. Al crearse, el creador es Administrador y se añade la caja `Entrada de mercancias` (`is_inbound=true`, no borrable). |
| **Box** | Árbol con `parent_box_id`, `qr_token`, `short_code`, `version`, soft-delete. |
| **Item** | En una caja. `photo_url`, `tags`/`aliases` como **JSON**, stock derivado, favorito por usuario. |
| **Stock** | Suma de `stock_movements`. Alta: `+1`. Intake commit: `+quantity`. Ajuste UI: `±1` con `command_id`. |
| **Intake batch** | Fotos → drafts → commit. Worker in-process con `ThreadPoolExecutor`. |
| **Sync** | `change_log` (pull), `processed_commands` (idempotencia), `sync_conflicts`. |

---

## User Flows

### Auth y perfil
Signup → login (opcional *Mantener sesión*: access JWT sin `exp` + refresh en cookie HttpOnly) → forgot/reset/change password. Interceptor: 401 → logout; refresh automático solo con sesión persistente.

`/app/profile` está disponible para cualquier usuario autenticado aunque no haya warehouse activo. Desde el menú de identidad del header se puede abrir Perfil o cerrar sesión. Perfil permite cambiar el `display_name`, muestra el email como solo lectura y aloja el cambio de contraseña; los datos personales dejan de formar parte de Settings del warehouse.

### Warehouse
La gestión vive en `/app/warehouses`, dentro del mismo shell que el resto de la aplicación, y puede abrirse sin warehouse activo. La selección activa del dispositivo y el warehouse predeterminado de la cuenta son estados distintos: abrir/cambiar de warehouse no altera el predeterminado salvo acción explícita.

Tras login sin redirect explícito, `/app` valida el predeterminado y entra directamente en `/app/home`. Si falta o dejó de ser accesible, elige de forma determinista la membresía más antigua (`membership.created_at`, desempate por id), la persiste como nuevo predeterminado y muestra aviso si reemplazó una preferencia inválida. Sin membresías entra en `/app/warehouses`.

Un usuario sin membresías puede crear su primer warehouse, que queda activo y predeterminado. Si ya tiene membresías, solo puede crear más cuando es Administrador de al menos una; una cuenta con membresías exclusivamente de Contribuidor recibe HTTP 403 y no genera datos parciales. Esta autorización se aplica en backend y se serializa por usuario ante intentos concurrentes.

La API expone el rol del usuario autenticado en cada warehouse. Solo un Administrador del warehouse objetivo puede invitar y elige `administrator` o `contributor`, con Contribuidor por defecto. La invitación guarda el rol que se copiará a la membresía al aceptar y siempre conserva `invite_url` como fallback manual; si existe SMTP para el warehouse se intenta enviar el enlace y la respuesta distingue `sent`, `not_configured`, `failed` y `not_requested` sin invalidar la invitación.

Al abrir `/invites/{token}` sin sesión, el destino completo se conserva durante login o registro. Tras autenticar, la aceptación valida email normalizado, expiración UTC y consumo único; en éxito selecciona el warehouse invitado y entra en `/app/home`. Solo lo convierte en predeterminado cuando el usuario no tenía otro predeterminado válido.

Cada tarjeta de `/app/warehouses` muestra rol, estados activo/predeterminado, artículos activos, unidades de stock, cajas activas, lotes abiertos, cantidad de miembros y quién tiene acceso. Todos los miembros ven nombre visible y rol; solo un Administrador del warehouse objetivo ve emails. Los contadores excluyen cajas/artículos en papelera y lotes `committed`.

**Miembros y roles** (solo Administrador):
- El módulo `/app/members` lista identidad y rol de los miembros del warehouse seleccionado y muestra la matriz fija de permisos.
- `GET /api/warehouses/{warehouse_id}/members`, `PATCH /api/warehouses/{warehouse_id}/members/{user_id}` y `DELETE /api/warehouses/{warehouse_id}/members/{user_id}` requieren Administrador.
- Un Administrador puede promover o degradar membresías, incluida la propia si queda otro Administrador.
- Una degradación que dejaría cero Administradores se rechaza con HTTP 409 y sin cambios parciales.
- Un Administrador puede retirar a cualquier otro miembro, Administrador o Contribuidor, independientemente de `created_by`. No puede retirar su propia membresía mediante esta operación: se rechaza con HTTP 409.
- La retirada confirmada elimina solo la membresía, revoca el acceso desde la siguiente operación autorizada, limpia `users.default_warehouse_id` si apuntaba al warehouse y registra un único evento `member.removed` con actor, objetivo y rol anterior, todo en una transacción. La cuenta, el contenido compartido y el historial se conservan.
- Un objetivo que no pertenece al warehouse devuelve HTTP 404 sin cambios parciales. La UI identifica al objetivo, exige confirmación, retira la fila tras éxito y no ofrece la acción en la fila propia.
- No hay permisos individuales, roles configurables ni abandono voluntario de warehouse.

**Eliminar warehouse** (cualquier Administrador, solo desde `/app/warehouses`):
- `DELETE /api/warehouses/{warehouse_id}` con body `{ "confirm_name": "<nombre exacto>" }`.
- Requiere red; la UI deshabilita la acción offline.
- Cualquier miembro con rol Administrador puede eliminar; Contribuidores no ven el botón y reciben HTTP 403 si llaman directamente. `created_by` es histórico y no concede por sí solo permisos.
- Bloqueado con HTTP 409 si existe un lote intake con `status=processing`.
- Borrado atómico: filas relacionadas en BD + directorio `media_root/{warehouse_id}/`.
- Si falla el borrado de media → HTTP 500, warehouse intacto (rollback).
- Auditoría en logs del servidor (`warehouse_id`, `name`, `actor_user_id`); no en BD.
- API `detail` en inglés; snackbars UI en español.
- Tras éxito: limpiar `mw_selected_warehouse_id` si coincide, limpiar preferencias por defecto que apunten al eliminado y ejecutar `purgeWarehouse()` en IndexedDB.
- Guard solo en rutas operativas: si el warehouse seleccionado ya no está en `GET /warehouses` → limpiar selección, snackbar y resolver otro predeterminado o redirigir `/app/warehouses`. Perfil y Warehouses no requieren selección.
- Segunda llamada tras borrado exitoso → 404.

### Home (`/app/home`)
- Búsqueda en tiempo real (debounce 300ms).
- Filtros UI: **solo** favoritos y stock=0 (la API admite `with_photo` pero la UI no lo expone).
- Nube de tags ponderada por frecuencia.
- Vistas Cards/Lista (preferencia en `localStorage`); móvil fuerza Cards.
- Acciones: stock ±1, favorito, editar, reprocesar tags, borrar, modo lote (mover/favorito/borrar). En móvil, stock y favorito quedan visibles; editar, reprocesar y borrar se agrupan en `Más acciones`. Las superficies declaran pan vertical y un movimiento de 12 px cancela el tap sin interceptar el scroll nativo; teclado, foco, etiquetas accesibles y ejecución única se conservan. El mismo contrato aplica a las tarjetas compartidas en detalle de caja.
- Offline: ante error de red en stock/favorito → cola IndexedDB + UI optimista.

### Cajas (`/app/boxes`)
Árbol anidado expand/collapse, CRUD, **mover vía selector de padre** (no drag-and-drop), contadores recursivos, etiqueta QR imprimible.

### Detalle de caja (`/app/boxes/:id`)
Breadcrumbs navegables, búsqueda recursiva debounced, mismos componentes `item-card`/`item-list` que Home, atajos foto/lote con caja bloqueada.

### QR (`/app/scan`)
`BarcodeDetector` o entrada manual (`short_code` / `qr_token`). `short_code` ambiguo → 409. Deep link con redirect post-login.

### IA
- **Foto individual:** `/app/items/from-photo` → `draft-from-photo` → `/app/items/new`.
- **Lotes:** `/app/batches`, `/app/batches/:batchId` — cámara continua, cola de subidas, polling 5s, estados UX Nuevo/Procesado/Error/Guardado. En el listado, cada lote muestra junto a su nombre la caja destino cuando su nombre está disponible; si no lo está, el lote y sus acciones se mantienen sin mostrar un identificador técnico ni una caja inventada. El detalle ofrece retorno visible al listado. El listado ofrece retorno visible a la caja de contexto cuando se abrió con `boxId`, o a Inicio cuando no hay contexto de caja; los destinos son directos y no dependen del historial del navegador.

### Ops
Papelera y actividad (default 50 eventos) están disponibles para ambos roles. Conflictos (keep_server / keep_client) y Settings del warehouse (SMTP, LLM, sync manual, export/import JSON) requieren Administrador. Perfil, contraseña y actualización de la aplicación están disponibles para cualquier usuario autenticado.

SMTP se configura por warehouse (`starttls`, `ssl`, `none`). El test realiza un envío real síncrono a la dirección indicada; solo responde éxito cuando el servidor SMTP acepta el mensaje. Fallos de configuración/conexión/autenticación/entrega devuelven errores categóricos sin secretos. No hay cola ni reintentos automáticos.

### Matriz de permisos por warehouse

| Capacidad | Administrador | Contribuidor |
|-----------|---------------|--------------|
| Ver/seleccionar/marcar predeterminado | ✅ | ✅ |
| Crear warehouse | ✅ si administra al menos uno; también sin membresías | ❌ si ya tiene membresías exclusivamente de Contribuidor |
| Búsqueda, actividad y QR | ✅ | ✅ |
| Cajas, artículos, stock, favoritos, fotos, tags, papelera y lotes | ✅ | ✅ |
| Invitaciones y selección de rol | ✅ | ❌ |
| Listado, cambio de roles y retirada de otros miembros | ✅, conservando al menos un Administrador y sin autoeliminación | ❌ |
| Eliminar warehouse | ✅, con confirmación y bloqueos existentes | ❌ |
| Perfil, contraseña y acciones de actualización PWA | ✅ | ✅ |
| Diagnóstico PWA completo | ✅ en warehouse activo | ❌ (resumen de 4 campos) |
| Settings del warehouse, SMTP, LLM, sync y conflictos | ✅ | ❌ |
| Export/import JSON | ✅ | ❌ |

La autorización se evalúa en backend contra la membresía del warehouse objetivo. La UI oculta y protege rutas administrativas, pero no es la barrera de seguridad. La recuperación pública de contraseña permanece disponible a cualquier usuario.

---

## Routes

Definidas en `frontend/src/app/routes.ts`. Shell autenticado en `/app/*`; `/app/warehouses` y `/app/profile` no requieren selección, mientras las rutas operativas sí. `/app` resuelve la entrada al predeterminado; `/warehouses` redirige por compatibilidad a `/app/warehouses`; redirect raíz → `/login`; `/app/items/intake-batch` → `/app/batches`.

---

## Data Model

**18 tablas** (SQLAlchemy). Sin tablas `tags`, `item_tags`, `item_aliases` ni `photos`.

| Tabla | Notas |
|-------|-------|
| `users` | `default_warehouse_id` nullable → `warehouses.id` con borrado `SET NULL` |
| `warehouses` | `created_by` |
| `memberships` | PK compuesta; `role` no nulo (`administrator`/`contributor`) |
| `refresh_tokens` | Incluye hash de access persistente cuando `remember_me` |
| `password_reset_tokens` | |
| `boxes` | Sin `created_by`/`updated_by` — solo `TimestampMixin` |
| `items` | `tags`, `aliases` JSON; `photo_url` string |
| `item_favorites` | Por usuario |
| `stock_movements` | `command_id` único por item |
| `warehouse_invites` | `role` no nulo, default `contributor` |
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
| Backend (`users`) | `default_warehouse_id`, preferencia de cuenta validada por membresía y sincronizada entre dispositivos |
| `localStorage` | `mw_access_token`, `mw_refresh_token`, `mw_persistent_session`, `mw_selected_warehouse_id` (selección activa local), `mw_device_id`, preferencia vista Cards/Lista |
| IndexedDB `my-warehouse-offline` | `commands`, `meta` (since_seq), `conflicts` |

**Sync cliente:** solo encola `stock.adjust`, `item.favorite`, `item.unfavorite` al fallar la petición HTTP. Sync es **manual** (`Forzar sync` en Settings); no hay auto-sync al reconectar.

---

## API Summary

**Base:** `/api` · **Auth:** Bearer JWT · **Health:** `/health`

Grupos: auth (perfil GET/PATCH, default warehouse PUT y sesión/contraseña), warehouses+overview+invites+activity+**DELETE warehouse**, boxes+QR, items+batch+draft, intake, photos upload, tags+cloud, settings SMTP/LLM, sync push/pull/resolve, export/import.

`GET /warehouses` incluye `membership_created_at`. `GET /warehouses/overview` devuelve todos los resúmenes accesibles en una colección, con agregados actuales y emails condicionados al rol del solicitante en cada warehouse. `PUT /auth/me/default-warehouse` valida membresía; `PATCH /auth/me` solo modifica nombre visible.

**Sync push** acepta 11 tipos de comando en backend; el cliente solo genera 3 en práctica.

Los grupos administrativos (invitaciones, listado/cambio/retirada de miembros, DELETE warehouse, Settings SMTP/LLM, sync push/pull/resolve y export/import) requieren Administrador. El resto de recursos operativos mantiene autorización por membresía para ambos roles.

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

Manifest, iconos, Service Worker (solo `production`). Cache shell + `/media/**`; `/api/**` excluida. Install/update se gestiona desde Perfil con versión (`appData.version` en `ngsw-config.json`).

Todos los usuarios ven si la app está instalada, versión actual, nueva versión detectada y última comprobación, además de las acciones soportadas por su navegador. Solo un Administrador del warehouse activo ve también estado del Service Worker, elegibilidad del prompt, errores, transición de versiones y ayudas específicas de plataforma. Sin warehouse activo se usa la vista resumida.

La constante `APP_VERSION` en `frontend/src/app/core/app-version.ts` alimenta `PwaService` (Settings, shell) y el footer de `/warehouses`. Valor por defecto checked-in: `dev`. Imágenes prod: generado en build Docker vía `write-app-version.mjs` + build arg `APP_VERSION` (ver `ops-platform` contract, change `004-app-version-warehouses-footer`).

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
| Warehouses + invites (email + link manual fallback) | ✅ |
| Roles Administrador/Contribuidor por warehouse | ✅ |
| Warehouse predeterminado de cuenta + entrada directa | ✅ |
| Warehouses integrados con resúmenes y cambio activo | ✅ |
| Perfil de usuario en header | ✅ |
| Acciones móviles compactas con scroll seguro | ✅ |
| Gestión de miembros, roles y retirada de acceso | ✅ |
| Eliminar warehouse (Administrador, confirmación nombre) | ✅ |
| Cajas jerárquicas (mover por selector) | ✅ |
| Artículos + stock + favoritos + batch | ✅ |
| Búsqueda + tag cloud | ✅ |
| QR + etiquetas (QR vía qrserver.com) | ✅ |
| Settings SMTP/LLM | ✅ (SMTP test real) |
| Export/import JSON | ✅ |
| Foto + LLM draft | ✅ |
| Intake masivo | ✅ |
| PWA | ✅ |
| Sync backend completo | ✅ |
| Sync offline cliente | ⚠️ Solo stock + favoritos; sync manual |
| Invites por email automático | ✅ (síncrono, sin reintentos) |
| Drag-and-drop UI | ❌ |
| Virtual scroll | ❌ |
| Cache offline de entidades | ❌ |
| Rate limiting auth | ❌ |
| QR por artículo | ❌ (fuera de alcance) |
| 2FA | ❌ (fuera de alcance) |
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
cd backend && uv run pytest                         # 74 tests
cd frontend && npm run test -- --configuration=ci  # 214 tests
cd frontend && npm run build
```

Tests por área: `test_auth_warehouses`, `test_warehouse_navigation_profile`, `test_warehouse_roles`, `test_warehouse_roles_migration`, `test_delete_warehouse`, `test_slice2_boxes_items`, `test_slice3_search_tags`, `test_slice4_qr_scan`, `test_slice5_invites_activity`, `test_slice6_settings_llm_smtp`, `test_smtp_mailer`, `test_slice7_sync_conflicts`, `test_slice8_export_import`, `test_slice9_item_photo_draft`, `test_slice10_intake_batch`, `test_llm_enrichment_json_parsing`.
