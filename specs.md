# my-warehouse — `specs.md` (Source of Truth)

**Proyecto:** my-warehouse (PWA para inventario de garaje con cajas jerárquicas y QR)  
**Frontend:** Angular PWA + Angular Material (Material Design)  
**Backend:** FastAPI + SQLAlchemy + Alembic + PostgreSQL  
**Multiusuario:** Sí (desde el día 1, sin roles)  
**Offline-first + Sync + Conflictos:** Sí  
**LLM:** Gemini (tags y alias automáticos)

---

## Control del documento

- **Versión:** v1.5  
- **Última actualización:** 2026-02-24  
- **Owner:** (mantener por el equipo)  
- **Estado:** Activo (este fichero es la especificación viva del producto)

### Changelog (mantener siempre al día)
> Regla: **cualquier cambio de implementación que afecte funcionalidad/UX/API/datos debe reflejarse aquí** y anotarse en el changelog.

- **v0.1 (2026-02-22):** Primera especificación completa (MVP + roadmap + arquitectura + sync + Gemini).
- **v0.2 (2026-02-22):** Arranque Slice 1 implementado (backend auth + warehouses + migración inicial + tests, frontend login/signup/warehouses/shell conectado por API). Se añade CORS de desarrollo para `http://localhost:4200`. Nota temporal: entorno local inicial con SQLite para bootstrap, objetivo final sigue siendo PostgreSQL.
- **v0.3 (2026-02-22):** Slice 1 cerrada: `forgot-password`, `reset-password` y `change-password` implementados end-to-end; shell responsive móvil/escritorio con sidenav overlay/side; migración `password_reset_tokens`; tests de auth extendidos.
- **v0.4 (2026-02-22):** Slice 2 completada: backend con CRUD de cajas y artículos, movimiento de cajas con prevención de ciclos, favoritos por usuario, stock como `stock_movements` idempotentes, acciones en lote y soft-delete/restore; frontend con rutas `/app/home`, `/app/boxes`, `/app/boxes/:id`, `/app/items/new`, `/app/items/:id` integradas en shell Material; migración `20260222_0003_slice2_boxes_items`; tests de Slice 2 añadidos. Fix técnico adicional: refresh tokens incorporan `jti` para evitar colisiones de hash en logins consecutivos.
- **v0.5 (2026-02-22):** Slice 3 completada (fase inicial): búsqueda incremental en Home con debounce, orden por relevancia en backend, búsqueda por ruta de cajas, filtro por tag y nube de tags por warehouse (`/warehouses/{warehouse_id}/tags/cloud`) con chips en UI. Se añaden tests backend de búsqueda/tags.
- **v0.6 (2026-02-22):** Slice 4 completada: endpoint `GET /boxes/by-qr/{qr_token}` con control de acceso por membresía, vista `/app/scan` integrada en el header con escaneo por cámara (BarcodeDetector) y fallback por token manual, redirect post-login conservando deep link, y detalle de caja con breadcrumbs navegables por tramo. Se añaden tests backend para lookup QR y permisos.
- **v0.7 (2026-02-22):** Slice 5 completada: invitaciones por token con expiración (`POST /warehouses/{id}/invites`, `POST /invites/{token}/accept`), papelera/restauración expuesta en UI (`/app/trash`) y actividad mínima (`/warehouses/{id}/activity`, `/app/activity`) con eventos clave (create/delete/restore/stock/batch/invite). Se añade migración `20260222_0004_slice5_invites_activity` y tests de invites/activity.
- **v0.8 (2026-02-22):** Slice 6 completada: configuración SMTP y Gemini por warehouse con secretos cifrados en backend (`smtp_settings`, `llm_settings`), endpoint de test SMTP, toggles `auto-tags/auto-alias`, reprocesado manual de item y autogeneración de tags/aliases al crear/editar items cuando LLM está habilitado. UI de Settings ampliada y migración `20260222_0005_slice6_settings_smtp_llm`.
- **v0.9 (2026-02-22):** Refactor transversal de UI/UX en frontend para alineación Material Design: sistema visual global (tokens de superficie, bordes, sombras y spacing), shell con navegación lateral y estados activos, rediseño responsive de auth/warehouses y pantallas core (`home`, `boxes`, `box-detail`, `item-form`, `scan`, `trash`, `activity`, `settings`) con jerarquía visual y estados de carga/vacío/error consistentes.
- **v0.9.1 (2026-02-22):** Ajuste de densidad visual en vistas operativas: `boxes` pasa a layout más compacto (menos altura por card y mejor uso de ancho), reducción global de spacing en listados/cards y corrección de alineación de checkboxes en `home`.
- **v1.0 (2026-02-23):** Slice 7 y Slice 8 completadas. Backend: tablas `change_log`, `processed_commands`, `sync_conflicts`; endpoints `/sync/push`, `/sync/pull`, `/sync/resolve`; export/import JSON de warehouse (`GET /warehouses/{warehouse_id}/export`, `POST /warehouses/{warehouse_id}/import`) con validación y remapeo de IDs en import cross-warehouse. Frontend: cola offline en IndexedDB (comandos), force sync en Settings, vista `/app/conflicts` para resolución, y UI de export/import en Settings. Migración `20260222_0006_slice7_slice8_sync_transfer` y tests backend `test_slice7_sync_conflicts.py`, `test_slice8_export_import.py`.
- **v1.1 (2026-02-23):** Infraestructura de despliegue añadida: `Dockerfile` para backend y frontend (Nginx SPA), manifests Kubernetes en `deploy/k8s` (namespace, config, secrets plantilla, PostgreSQL, job de migración Alembic, deployments/services e ingress Traefik por path `/` + `/api`). Ajustes de runtime: frontend usa `/api/v1` fuera de `localhost:4200`, backend permite `CORS_ORIGINS` configurable y Alembic acepta `DATABASE_URL` por entorno.
- **v1.2 (2026-02-24):** Nueva feature de sesión expirada/no válida: el frontend detecta respuestas `401` en peticiones autenticadas, limpia tokens locales y redirige automáticamente a `/login` preservando `redirect` a la ruta actual.
- **v1.3 (2026-02-24):** Refactor UX de inventario para densidad y jerarquía: vista de cajas en formato compacto (filas de baja altura con acciones inline), indicación jerárquica reforzada (nivel y ruta visible), y creación unificada en `/app/items/new` con selector de tipo para crear **artículo** o **caja** desde el mismo flujo.
- **v1.4 (2026-02-24):** Refinamiento visual de cards de artículos en Home: layout más compacto y legible (menos altura, menor peso visual), acciones de stock en iconos discretos y jerarquía de información reforzada (nombre + ruta + stock + acciones) manteniendo todas las operaciones existentes.
- **v1.5 (2026-02-24):** Refactor completo de jerarquía de cajas en UI: árbol realmente anidado con ramas visuales, expand/collapse por nodo, rutas completas en nodos y selects (crear/mover/alta de elemento/lote) para distinguir claramente contención padre→hijo sin ambigüedad.

---

## Cómo trabajar con este fichero (instrucciones para Codex)

Este fichero **es la fuente de verdad** de la aplicación.

**Reglas de oro:**
1. **Antes de implementar**, lee las secciones relevantes y valida que lo que vas a construir está descrito aquí.
2. **Cada PR/commit importante** debe:
   - Implementar una parte concreta (slice/ticket).
   - Actualizar `specs.md` si cambió algún detalle (UX, API, modelo, reglas, decisiones).
   - Añadir una entrada en el **Changelog** (arriba).
3. Si el usuario pide cambios:
   - **Primero** actualiza `specs.md` (o en el mismo cambio) y luego implementa.
4. Mantén el documento organizado:
   - No borres información histórica relevante: muévela a “Decisiones” o “Changelog”.
   - Si un requisito cambia, deja claro cuál es el comportamiento actual.
5. Si detectas una ambigüedad durante implementación, añade una sección **“Open Questions / Assumptions”** al final y toma una decisión razonable (documentada).

**Formato recomendado para cambios:**
- Actualiza la sección correspondiente (p.ej. API, Modelo, UX).
- Añade entrada al Changelog con: fecha, resumen, impacto, migraciones si aplica.

---

## Tabla de contenidos

1. [Resumen](#resumen)  
2. [Objetivos y no-objetivos](#objetivos-y-no-objetivos)  
3. [Conceptos del dominio](#conceptos-del-dominio)  
4. [UX / Pantallas / Flujos](#ux--pantallas--flujos)  
5. [Requisitos funcionales (Epics + User Stories)](#requisitos-funcionales-epics--user-stories)  
6. [Arquitectura y stack](#arquitectura-y-stack)  
7. [Modelo de datos (PostgreSQL)](#modelo-de-datos-postgresql)  
8. [API (REST) - Endpoints](#api-rest---endpoints)  
9. [Búsqueda, tags, alias](#búsqueda-tags-alias)  
10. [QR (solo cajas)](#qr-solo-cajas)  
11. [Offline-first + Sync + Conflictos](#offline-first--sync--conflictos)  
12. [LLM (Gemini): tags y alias automáticos](#llm-gemini-tags-y-alias-automáticos)  
13. [Requisitos no funcionales](#requisitos-no-funcionales)  
14. [Plan de implementación (vertical slices)](#plan-de-implementación-vertical-slices)  
15. [Definición de Done](#definición-de-done)  
16. [Open Questions / Assumptions](#open-questions--assumptions)

---

## Resumen

**my-warehouse** es una aplicación PWA para **localizar rápidamente** objetos guardados en un garaje/trastero usando:
- **Cajas jerárquicas** (cajas dentro de cajas).
- **Artículos** con foto opcional, stock y favoritos.
- **QR por caja** para acceder a su contenido con escaneo desde móvil.
- **Búsqueda instantánea** por múltiples campos.
- **Offline-first + sincronización** con resolución de conflictos.
- **Enriquecimiento automático** con LLM (Gemini): tags y alias sin mantenimiento manual.

UI basada en **Material Design**, responsive para **móvil, tablet y escritorio**.

---

## Objetivos y no-objetivos

### Objetivos
1. Encontrar artículos rápido por **búsqueda** o **escaneo QR**.
2. Visualizar la **ruta jerárquica** (Caja A > Caja B > …) para saber dónde está cada cosa.
3. Operaciones rápidas: ⭐ favoritos, +/- stock, mover (drag & drop), acciones en lote.
4. Multiusuario desde el día 1 (sin roles).
5. Offline-first real + sync + conflictos.
6. Tags y alias automáticos via Gemini.
7. Configuración central (SMTP + Gemini + preferencias).
8. Fotos en storage con URLs cacheables (mejor rendimiento y caché).

### No-objetivos (por ahora)
- QR por artículo.
- Plantillas de impresión avanzadas (solo vista del QR + código corto).
- Roles/permisos granulares.
- 2FA.
- Integraciones externas complejas (más allá de SMTP + Gemini).

---

## Conceptos del dominio

### Warehouse (Almacén / Workspace)
- Contenedor compartido (ej. “Garaje”).
- Varios usuarios pueden pertenecer al mismo warehouse.
- Un usuario puede pertenecer a varios warehouses.
- Sin roles: todos los miembros tienen los mismos permisos.

### Box (Caja)
- Nodo de un árbol: puede contener artículos y otras cajas.
- Propiedades:
  - Nombre (si no se especifica: “Caja N” incremental por warehouse)
  - Descripción opcional
  - Ubicación física opcional
  - **QR único** + **código corto** humano (visible bajo el QR)

### Item (Artículo)
- Propiedades (mínimo):
  - Foto opcional (si no, placeholder)
  - Nombre
  - Descripción opcional
  - Stock (operación rápida +/-1)
  - Favorito ⭐ (por usuario)
  - Ubicación física opcional
  - Tags y alias (automáticos via LLM)

### Stock como eventos (movimientos)
- El stock **no** se edita como un número “mutable” sin historial.
- Se calcula como la suma de movimientos:
  - `+1` / `-1` (rápido)
  - (opcional futuro) ajuste “set to N”
- Ventaja: mergeable en sync, reduce conflictos y da auditoría.

---

## UX / Pantallas / Flujos

### Rutas principales
- `/login`
- `/signup`
- `/forgot-password`
- `/invites/:token` (aceptar invitación)
- `/warehouses` (lista + crear + seleccionar)
- `/app` (shell)
  - `/app/home` (buscador + favoritos)
  - `/app/items/new`
  - `/app/items/:id` (detalle/edición)
  - `/app/boxes` (árbol de cajas)
  - `/app/boxes/:id` (detalle de caja)
  - `/app/scan` (escaneo QR)
  - `/app/scan/:qrToken` (deep link con token)
  - `/app/trash` (papelera + restauración)
  - `/app/activity` (actividad mínima)
  - `/app/settings` (configuración)
  - `/app/conflicts` (lista + resolución)

### Shell (Material)
- Toolbar superior con:
  - selector de warehouse (si aplica)
  - icono escáner/cámara (QR)
  - acceso a settings
- navegación lateral con iconografía y estado activo por sección
- Responsive:
  - móvil: navegación compacta (sidenav overlay)
  - tablet/escritorio: sidenav persistente

### Home
- Buscador arriba (input fijo).
- Estado inicial: favoritos del usuario + chips de filtros rápidos.
- Al escribir: filtra y ordena por relevancia.
- Acciones rápidas en cada card: ⭐, +/- stock, mover, borrar.
- Acción principal: **Nuevo elemento** (desde ahí se elige crear artículo o caja).
- Cards de artículos compactas: prioridad a densidad (más elementos visibles) y claridad operativa (acciones inline sin botones flotantes grandes).

### Árbol de cajas
- Árbol con expand/collapse (Material Tree).
- Drag & drop:
  - mover caja dentro de otra caja
  - mover artículo a otra caja
- Mostrar contadores por caja:
  - total artículos recursivo
  - total cajas recursivo
- Presentación compacta:
  - filas densas (menor altura por nodo, sin desperdicio de espacio)
  - jerarquía explícita con nivel y ruta (breadcrumb textual)
  - ramas anidadas visuales (padre/hijos) con connectors
  - selectors de caja con ruta completa (`Raíz > ... > Caja`) para evitar homónimos

### Detalle de caja (clave)
- Header: nombre caja + QR + código corto (pequeño bajo QR).
- Buscador interno.
- Lista plana de artículos recursivos:
  - Cada fila muestra ruta completa (breadcrumb) `Caja raíz > … > Caja actual > …`
  - La ruta es navegable (tocar un tramo navega a esa caja).

### Scanner QR
- Icono en header → vista escáner.
- Escaneo → navega a detalle de caja.
- Deep link:
  - si no login: login y redirección a caja
  - si login sin pertenencia: error “sin acceso”

### Settings (Configuración)
Secciones:
1) Perfil  
2) Seguridad (cambiar contraseña)  
3) Email (SMTP) + test email  
4) LLM (Gemini):
   - API key (guardada cifrada en backend)
   - toggles: auto-tags / auto-alias
   - reprocesar tags/alias (por artículo y/o global)
5) Offline/Sync:
   - estado conexión, cola, “forzar sync”
   - acceso a conflictos

---

## Requisitos funcionales (Epics + User Stories)

### EPIC A — Autenticación y cuenta
**US-A1: Registro**
- [x] Registro con email + password.
- [x] Validación password (mínimo longitud, etc.).
- [x] Tras registro: acceso a crear/seleccionar warehouse.

**US-A2: Login/Logout**
- [x] Login devuelve access token + refresh token.
- [x] Logout invalida refresh token.
- [x] Sesión persistente (PWA).

**US-A3: Cambio de contraseña**
- [x] Usuario autenticado puede cambiar contraseña (requiere password actual).

**US-A4: Recuperación de contraseña por email**
- [x] Solicitud reset → email con link token.
- [x] Token caduca, un solo uso.
- [x] Tras reset, refresh tokens previos quedan invalidados.

**US-A5: Expiración/invalidación de sesión**
- [x] Si el backend responde `401` en una petición autenticada, el cliente invalida sesión local.
- [x] Redirección automática a `/login`.
- [x] Conserva `redirect` para volver a la ruta previa tras login.

---

### EPIC B — Warehouses (multiusuario sin roles)
**US-B1: Crear warehouse**
- [x] Crear warehouse con nombre.
- [x] Creador queda como miembro.

**US-B2: Listar/seleccionar warehouses**
- [x] Listar warehouses donde el usuario es miembro.
- [x] Selección persistida en cliente.

**US-B3: Invitar usuario**
- [x] Generar invitación (token/link).
- [ ] Opcional: enviar por email (SMTP).
- [x] Expira.
- [x] Aceptar → miembro.

**US-B4: Ver miembros**
- [x] Miembros visibles para cualquier miembro.

---

### EPIC C — Cajas (árbol)
**US-C1: Crear caja**
- [x] Crear en raíz o bajo `parent_box_id`.
- [x] Si no nombre: “Caja N” incremental por warehouse.
- [x] Genera QR token + short_code único.

**US-C2: Editar caja**
- [x] Editar nombre, descripción, ubicación física opcional.

**US-C3: Mover caja**
- [x] Drag & drop cambia parent.
- [x] Prohibido crear ciclos (no mover dentro de un descendiente).

**US-C4: Borrado seguro**
- [x] Soft-delete a papelera.
- [x] Si contiene elementos, requiere confirmación explícita.
- [x] Restauración.

**US-C5: Conteos**
- [x] Mostrar:
  - `total_items_recursive`
  - `total_boxes_recursive`

**US-C6: Jerarquía visible y compacta**
- [x] Listado de cajas en formato compacto (optimizado para más nodos visibles).
- [x] Diferenciación clara de nivel jerárquico por nodo.
- [x] Ruta de caja visible para reducir ambigüedad de contexto.
- [x] Árbol anidado con expand/collapse y líneas de rama para identificar contención.

---

### EPIC D — Artículos
**US-D1: Crear artículo**
- [x] Campos: name (req), desc (opt), photo (opt), box (req), ubicación física (opt).
- [x] Enriquecimiento LLM (tags + alias) si habilitado.

**US-D2: Editar artículo**
- [x] Cambiar name/desc/photo/box/ubicación.
- [x] Si cambia name/desc → re-LLM (si habilitado).

**US-D3: Favoritos por usuario**
- [x] Toggle ⭐ por usuario.
- [x] Home muestra favoritos por defecto.

**US-D4: Stock rápido**
- [x] +/-1 crea `StockMovement` idempotente (command_id).
- [x] Stock mostrado = suma movimientos.

**US-D5: Borrado seguro**
- [x] Soft-delete + restauración.

**US-D6: Acciones en lote**
- [x] Selección múltiple + acciones:
  - mover a caja
  - marcar/desmarcar favoritos
  - borrar

**US-D7: Alta unificada de elemento**
- [x] En `/app/items/new`, el usuario elige tipo de alta: **Artículo** o **Caja**.
- [x] Si selecciona Caja, se crea `box` con padre opcional usando el mismo flujo.
- [x] El acceso principal se etiqueta como “Nuevo elemento”.

---

### EPIC E — Búsqueda + filtros + nube de tags
**US-E1: Búsqueda de artículos**
- [x] Busca por: nombre, descripción, tags, alias, ruta, ubicación física.
- [x] Actualización incremental con debounce.
- [x] Orden por relevancia (match exacto > parcial).

**US-E2: Filtros rápidos**
- [x] Chips: Favoritos, Stock=0, Con foto, Sin foto, etc.

**US-E3: Nube de tags**
- [x] Chips discretos.
- [x] Click en tag filtra.

---

### EPIC F — QR (solo cajas)
**US-F1: Escaneo desde header**
- [x] Permisos cámara con UX claro.
- [x] Escaneo abre detalle caja.

**US-F2: Deep link seguro**
- [x] QR token no adivinable.
- [x] Login redirect.
- [x] Control acceso por warehouse.

---

### EPIC G — Configuración (SMTP + Gemini)
**US-G1: Config SMTP**
- [x] Por warehouse.
- [x] Guardado seguro (password cifrado).
- [x] “Test email”.

**US-G2: Config Gemini API key**
- [x] Guardada cifrada en backend.
- [x] Toggles auto-tags/auto-alias.
- [x] Reprocesar tags/alias.

---

### EPIC H — Offline + Sync + Conflictos
**US-H1: Usable offline**
- [ ] Shell offline.
- [ ] Datos recientes offline (IndexedDB).
- [ ] Crear/editar/mover/stock offline → cola.

**US-H2: Sync automático**
- [ ] Al reconectar: push comandos + pull cambios.
- [ ] UI de estado (offline/sync/pendiente).

**US-H3: Conflictos**
- [ ] Lista de conflictos.
- [ ] Resolución: keep server / keep client / merge.
- [ ] Stock no conflict (eventos mergeables).

---

### EPIC I — Export/Import
**US-I1: Export**
- [ ] Export JSON (mínimo) + CSV (opcional).
- [ ] Incluye cajas, items, tags, alias, movimientos.

**US-I2: Import**
- [ ] Import JSON validado con reporte de errores.
- [ ] Evita duplicados por IDs.

---

## Arquitectura y stack

### Frontend
- Angular (PWA) + Angular Material (Material Design).
- IndexedDB (recomendado: Dexie) para offline cache + cola comandos.
- Angular Service Worker para cache de shell y assets.
- UI: Material Tree, CDK DragDrop, virtual scroll (CDK) en listas grandes.

### Backend
- FastAPI (REST).
- SQLAlchemy 2.x (ORM).
- Alembic (migraciones).
- PostgreSQL.
- Auth: JWT access + refresh; hashing Argon2 (preferible).
- Email: SMTP configurable (por warehouse) y test.
- Fotos: storage + URLs cacheables (S3/MinIO o filesystem gestionado) + ETag/immutable.
- Sync:
  - comandos idempotentes (processed_commands)
  - pull incremental (change_log con `seq`)
  - control concurrencia (`version` + `updated_at`)

### Despliegue (contenedores + Kubernetes)
- Imágenes Docker:
  - Backend: `backend/Dockerfile` (FastAPI + Uvicorn)
  - Frontend: `frontend/Dockerfile` (build Angular + serving estático con Nginx SPA)
- Kubernetes (base en `deploy/k8s`):
  - `StatefulSet` + `Service` para PostgreSQL
  - `Job` de migraciones (`alembic upgrade head`)
  - `Deployment` + `Service` para backend y frontend
  - `Ingress` con clase `traefik`, rutas `/api`→backend y `/`→frontend

### Seguridad (principios)
- Nada de secretos en el navegador:
  - Gemini API key se guarda **solo** en backend (cifrada).
  - SMTP password **solo** en backend (cifrado).
- TLS obligatorio en despliegue.
- Rate limiting en endpoints de auth/reset.

---

## Modelo de datos (PostgreSQL)

### Convenciones
- `warehouse_id` en entidades multi-tenant.
- Soft delete: `deleted_at` nullable.
- Concurrencia: `version` (int) + `updated_at`.
- Auditoría: `created_at`, `created_by`, `updated_by`.

### Tablas (lógico)

**users**
- id (uuid PK)
- email (unique)
- password_hash
- display_name
- created_at, updated_at

**warehouses**
- id (uuid PK)
- name
- created_at, created_by

**memberships**
- user_id (FK)
- warehouse_id (FK)
- joined_at
- PK (user_id, warehouse_id)

**boxes**
- id (uuid PK)
- warehouse_id (FK)
- parent_box_id (FK boxes.id, nullable)
- name
- description (nullable)
- physical_location (nullable)
- qr_token (unique)
- short_code (unique, humano)
- version, created_at, updated_at, deleted_at
- created_by, updated_by

Índices:
- (warehouse_id, parent_box_id)
- (warehouse_id, deleted_at)
- unique(qr_token)
- unique(short_code)

**items**
- id (uuid PK)
- warehouse_id (FK)
- box_id (FK boxes.id)
- name
- description (nullable)
- physical_location (nullable)
- photo_id (FK photos.id, nullable)
- version, created_at, updated_at, deleted_at
- created_by, updated_by

Índices:
- (warehouse_id, box_id)
- (warehouse_id, deleted_at)

**item_favorites**
- user_id (FK)
- item_id (FK)
- created_at
- PK (user_id, item_id)

**tags**
- id (uuid PK)
- warehouse_id (FK)
- name (normalizado)
- created_at
- unique(warehouse_id, name)

**item_tags**
- item_id (FK)
- tag_id (FK)
- PK (item_id, tag_id)

**item_aliases**
- id (uuid PK)
- item_id (FK)
- alias
- created_at
- unique(item_id, alias)

**photos**
- id (uuid PK)
- warehouse_id (FK)
- storage_key
- content_type
- size_bytes
- sha256 (para cache/versionado)
- created_at

**stock_movements**
- id (uuid PK)
- warehouse_id (FK)
- item_id (FK)
- delta (int, normalmente +1/-1)
- reason (nullable)
- occurred_at (server time)
- created_by
- command_id (uuid, unique, nullable)  # idempotencia offline

Índices:
- (item_id, occurred_at desc)

**smtp_settings** (por warehouse)
- warehouse_id (PK/FK)
- host, port, username, password_encrypted, encryption_mode
- from_address, from_name
- updated_at, updated_by

**llm_settings** (por warehouse)
- warehouse_id (PK/FK)
- provider = "gemini"
- api_key_encrypted
- auto_tags_enabled (bool)
- auto_alias_enabled (bool)
- updated_at, updated_by

**change_log** (para sync pull incremental)
- seq (bigserial PK)
- warehouse_id
- entity_type (box|item|stock|tag|favorite|...)
- entity_id (uuid)
- action (create|update|delete)
- entity_version (int, nullable)
- created_at

Índices:
- (warehouse_id, seq)

**processed_commands** (idempotencia push)
- command_id (uuid PK)
- warehouse_id
- user_id
- device_id
- processed_at
- result_hash (opcional)

---

## API (REST) - Endpoints

**Base:** `/api/v1`  
**Auth:** Bearer JWT (access). Refresh con endpoint dedicado.

### Auth
- `POST /auth/signup`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/change-password`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`

### Warehouses
- `GET /warehouses`
- `POST /warehouses`
- `GET /warehouses/{id}`
- `GET /warehouses/{id}/members`
- `POST /warehouses/{warehouse_id}/invites`
- `POST /invites/{token}/accept`
- `GET /warehouses/{warehouse_id}/activity?limit=50`

### Boxes
- `GET /warehouses/{warehouse_id}/boxes/tree?include_deleted=...`
- `POST /warehouses/{warehouse_id}/boxes`
- `GET /warehouses/{warehouse_id}/boxes/{box_id}`
- `PATCH /warehouses/{warehouse_id}/boxes/{box_id}`
- `POST /warehouses/{warehouse_id}/boxes/{box_id}/move` (new_parent_box_id)
- `DELETE /warehouses/{warehouse_id}/boxes/{box_id}` (soft, body `{force}`)
- `POST /warehouses/{warehouse_id}/boxes/{box_id}/restore`
- `GET /boxes/by-qr/{qr_token}` → devuelve box_id + warehouse_id
- `GET /warehouses/{warehouse_id}/boxes/{box_id}/items?q=...` → lista plana recursiva con ruta

### Items
- `GET /warehouses/{warehouse_id}/items?q=...&favorites_only=...&stock_zero=...&with_photo=...`
- `POST /warehouses/{warehouse_id}/items`
- `GET /warehouses/{warehouse_id}/items/{item_id}`
- `PATCH /warehouses/{warehouse_id}/items/{item_id}`
- `DELETE /warehouses/{warehouse_id}/items/{item_id}` (soft)
- `POST /warehouses/{warehouse_id}/items/{item_id}/restore`
- `POST /warehouses/{warehouse_id}/items/{item_id}/favorite` (toggle o set)
- `POST /warehouses/{warehouse_id}/items/batch` (move|favorite|unfavorite|delete)

Stock:
- `POST /warehouses/{warehouse_id}/items/{item_id}/stock/adjust` body: `{ "delta": 1, "command_id": "uuid" }`

### Photos
- `POST /photos` (multipart) → devuelve photo_id + url
- `GET /photos/{photo_id}` (cacheable, immutable por hash/etag)

### Tags
- `GET /warehouses/{warehouse_id}/tags`
- `GET /warehouses/{warehouse_id}/tags/cloud` → `{ tag, count }[]`

### Settings
- `GET /settings/smtp?warehouse_id=...`
- `PUT /settings/smtp?warehouse_id=...`
- `POST /settings/smtp/test?warehouse_id=...`

- `GET /settings/llm?warehouse_id=...`
- `PUT /settings/llm?warehouse_id=...`
- `POST /settings/llm/reprocess-item/{item_id}?warehouse_id=...`

### Sync
- `POST /sync/push`
- `GET /sync/pull?warehouse_id=...&since_seq=...`
- `POST /sync/resolve`

### Export / Import
- `GET /warehouses/{warehouse_id}/export` → snapshot JSON del warehouse (boxes/items/stock_movements).
- `POST /warehouses/{warehouse_id}/import` → upsert validado de snapshot JSON en warehouse destino.

---

## Búsqueda, tags, alias

### Búsqueda (online)
- Campos: item.name, item.description, tags, aliases, ruta de cajas, physical_location.
- Recomendación: Postgres full-text + trigram opcional.
- Relevancia:
  1) match exacto en nombre
  2) prefijo en nombre
  3) match en alias
  4) match en tags
  5) match en descripción/ruta

### Búsqueda (offline)
- Índice local mínimo en IndexedDB:
  - name + aliases + tags + (opcional) descripción
- Debounce en input.

### Tags
- No se introducen manualmente en el flujo normal.
- Se generan por LLM al crear/editar artículo (si habilitado).
- Nube de tags: chips discretos para filtrar.

### Alias
- No se introducen manualmente en el flujo normal.
- Generados por LLM al crear/editar artículo (si habilitado).

---

## QR (solo cajas)

- Cada caja tiene `qr_token` único y no adivinable.
- `short_code` humano y corto (se muestra bajo el QR).
- Escaneo desde header (cámara):
  - abre la caja por token
  - si no autenticado → login + redirect
  - si sin acceso → error

---

## Offline-first + Sync + Conflictos

### Cliente
- IndexedDB:
  - cache entidades (boxes/items/tags/favs)
  - cola comandos
  - cursor `since_seq`
- SW cache shell + assets.

### Comandos idempotentes
Cada acción offline genera un comando:
- `command_id` (uuid)
- `device_id`
- `type`
- `entity_id`
- `base_version` (para updates/moves)
- `payload`

El servidor persiste `processed_commands` para no duplicar.

### Pull incremental
- El servidor expone `change_log.seq` por warehouse.
- El cliente hace `pull` desde `since_seq`.

### Conflictos
- Stock: **sin conflicto** (eventos sumables).
- Metadatos de caja/artículo:
  - Si `base_version != server_version` → conflicto
  - UI ofrece:
    - mantener servidor
    - mantener cliente
    - merge por campos (si aplica)

---

## LLM (Gemini): tags y alias automáticos

### Seguridad
- La API key de Gemini **no** vive en frontend.
- Se guarda cifrada en backend (por warehouse).

### Reglas
- Tags: 3–10, normalizados, sin duplicados.
- Alias: 0–5, no repetir nombre, útiles para búsqueda.
- Preferir tags existentes (backend incluye lista al prompt).

### Flujo
- Al crear/editar item (si cambia name/desc):
  - backend encola/genera tags y alias
  - UI refleja estado “generando tags…”

---

## Requisitos no funcionales

### UI/UX
- Material Design estricto (Angular Material).
- Responsive: móvil, tablet, escritorio.
- Acciones rápidas con targets grandes (uso en garaje).
- Sistema visual consistente: superficies con contraste suave, bordes y elevación sutiles, tipografía jerárquica y estados de UI homogéneos (loading/empty/error/success).

### Seguridad
- Hash de passwords: Argon2 (preferible).
- JWT access + refresh.
- Rate limiting en auth y reset.
- CORS restringido.
- TLS en despliegue real.

### Rendimiento
- Virtual scroll en listas grandes.
- Cache de imágenes con ETag/immutable.
- Búsqueda eficiente.

### Observabilidad
- Logging estructurado.
- Métricas básicas.
- Auditoría mínima (created_by/updated_by).

---

## Plan de implementación (vertical slices)

### Slice 1 — Fundaciones: Auth + Warehouses + Shell Material
- Backend: auth + modelos + migraciones base.
- Frontend: login/signup + selección warehouse + shell responsive.
- Estado actual (2026-02-22): **completada**.
  - Backend: `signup`, `login`, `refresh`, `logout`, `me`, `change-password`, `forgot-password`, `reset-password`; `list/create/get/members` de warehouses.
  - Persistencia auth: refresh tokens revocados en `logout`, `reset-password` y `change-password`.
  - Frontend: pantallas login/signup/forgot/reset/warehouses/shell, interceptor JWT, guards, selección persistida de warehouse.
  - Responsive: shell con sidenav `over` en móvil y `side` en escritorio.

### Slice 2 — Core: Boxes + Items + Favoritos + Stock Movements
- CRUD cajas (sin QR aún).
- CRUD items.
- Favoritos por usuario.
- Stock +/-1 como eventos.
- Estado actual (2026-02-22): **completada**.
  - Backend: modelos `boxes`, `items`, `item_favorites`, `stock_movements`; endpoints de tree, CRUD, move con validación de ciclos, soft-delete/restore, favoritos y batch.
  - Frontend: vistas `home`, `boxes`, `box-detail`, `item-form`; filtros rápidos (favoritos/stock=0), acciones rápidas (+/- stock, favorito) y lote (mover/favorito/borrar).
  - Migración: `20260222_0003_slice2_boxes_items`.
  - Calidad: test backend de Slice 2 (`test_slice2_boxes_items.py`) y build frontend OK.

### Slice 3 — Search + filtros + nube de tags (inicial)
- Buscador incremental.
- Chips filtros.
- Nube tags (aunque aún se alimentará más tarde).
- Estado actual (2026-02-22): **completada**.
  - Backend: `GET /warehouses/{warehouse_id}/items` con ranking por relevancia, búsqueda por ruta de cajas y filtro `tag`; endpoints `GET /warehouses/{warehouse_id}/tags` y `GET /warehouses/{warehouse_id}/tags/cloud`.
  - Frontend: Home con búsqueda incremental (debounce), filtros rápidos y nube de tags con chips clicables.
  - Calidad: test backend `test_slice3_search_tags.py`.

### Slice 4 — QR cajas + Scan + Detalle recursivo con rutas
- qr_token + endpoint by-qr.
- scanner.
- detalle caja con lista plana recursiva + breadcrumbs.
- Estado actual (2026-02-22): **completada**.
  - Backend: `GET /boxes/by-qr/{qr_token}` con validación de acceso por membresía y respuesta `{box_id, warehouse_id}` para navegación segura.
  - Frontend: ruta `/app/scan` (y `/app/scan/:qrToken`) desde el header; escaneo por cámara con `BarcodeDetector` cuando está disponible y fallback manual por token.
  - UX/Seguridad: redirect a login preservando URL objetivo y retorno al deep link tras autenticación; selección automática de `warehouse_id` al resolver QR.
  - Detalle de caja: breadcrumbs navegables por tramo en resultados recursivos.
  - Calidad: test backend `test_slice4_qr_scan.py`.

### Slice 5 — Multiusuario: invites + papelera/restauración + actividad mínima
- invitaciones.
- soft delete + restore.
- actividad básica.
- Estado actual (2026-02-22): **completada**.
  - Backend: invitaciones por token con expiración y aceptación (`POST /warehouses/{warehouse_id}/invites`, `POST /invites/{token}/accept`), endpoint de actividad (`GET /warehouses/{warehouse_id}/activity`) y registro de eventos básicos.
  - Frontend: aceptación de invitación (`/invites/:token`), papelera con restauración (`/app/trash`) y lista de actividad (`/app/activity`), además de creación de invites desde la vista de warehouses.
  - Migración: `20260222_0004_slice5_invites_activity`.
  - Calidad: test backend `test_slice5_invites_activity.py`.

### Slice 6 — Settings: SMTP + Gemini + autogen tags/alias
- settings SMTP + test.
- settings Gemini + autogen tags/alias.
- reprocesado manual.
- Estado actual (2026-02-22): **completada**.
  - Backend: endpoints `/settings/smtp`, `/settings/smtp/test`, `/settings/llm`, `/settings/llm/reprocess-item/{item_id}` con validación de membresía por warehouse.
  - Seguridad: secretos SMTP y Gemini almacenados cifrados en backend y expuestos en lectura solo como máscara (`has_*`/`*_masked`).
  - Items: autogeneración de tags/aliases en create/update cuando LLM está habilitado con API key configurada.
  - Frontend: Settings con secciones de Seguridad, SMTP, LLM y reprocesado manual por `item_id`.
  - Migración: `20260222_0005_slice6_settings_smtp_llm`.
  - Calidad: test backend `test_slice6_settings_llm_smtp.py`.

### Slice 7 — Offline + Sync + Conflictos
- IndexedDB + cola.
- /sync push/pull + change_log + processed_commands.
- UI de conflictos.
- Estado actual (2026-02-23): **completada**.
  - Backend: tablas `change_log`, `processed_commands`, `sync_conflicts`; endpoints `/sync/push`, `/sync/pull`, `/sync/resolve`; registro de `change_log` también en mutaciones online de boxes/items.
  - Frontend: servicio `SyncService` con IndexedDB (cola + `since_seq` + conflictos), fallback offline para comandos `item.favorite/unfavorite` y `stock.adjust`, sección de sync en Settings (estado/cola/forzar sync), y pantalla `/app/conflicts` para resolver con server/client.
  - Migración: `20260222_0006_slice7_slice8_sync_transfer`.
  - Calidad: test backend `test_slice7_sync_conflicts.py`.

### Slice 8 — Export/Import
- export JSON (y opcional CSV).
- import JSON con validación.
- Estado actual (2026-02-23): **completada**.
  - Backend: `GET /warehouses/{warehouse_id}/export` y `POST /warehouses/{warehouse_id}/import` con validación de referencias (parent/box/item) y remapeo de IDs/tokens cuando el snapshot se importa en otro warehouse.
  - Frontend: acciones de Export/Import JSON en Settings.
  - Migración: `20260222_0006_slice7_slice8_sync_transfer`.
  - Calidad: test backend `test_slice8_export_import.py`.

---

## Definición de Done

Para considerar una slice “Done”:
- [ ] Funcionalidad implementada end-to-end (frontend + backend).
- [ ] Tests mínimos (unit y/o integration) para backend; pruebas básicas en frontend.
- [ ] Migraciones Alembic incluidas si hay cambios de modelo.
- [ ] Seguridad aplicada (auth, validaciones, ownership por warehouse).
- [ ] `specs.md` actualizado si hubo cambios.
- [ ] Changelog actualizado.

---

## Open Questions / Assumptions

> Añadir aquí cualquier decisión tomada durante la implementación si el requisito no era totalmente explícito.

- **A-001 (2026-02-22):** Para acelerar bootstrap local sin fricción de dependencias, la base inicial corre con SQLite y sesiones SQLAlchemy síncronas. Se mantiene como objetivo migrar a PostgreSQL + capa async en la evolución de slices.
- **A-002 (2026-02-22):** La validación de email en el backend se dejó básica (string + límites) en esta fase inicial por disponibilidad de entorno; se endurecerá en siguientes pasos de Slice 1/2.
- **A-003 (2026-02-22):** En entorno de desarrollo, `POST /auth/forgot-password` devuelve `reset_token` en la respuesta para poder probar el flujo sin SMTP. En producción debe enviarse por email y no exponerse en API.
- **A-004 (2026-02-22):** En Slice 2 el endpoint de stock rápido se expone como `POST /warehouses/{warehouse_id}/items/{item_id}/stock/adjust` (en lugar de `/stock`) para dejar explícito el comando idempotente con `command_id`; se puede simplificar en Slice 7 si se estandariza capa de sync.
- **A-005 (2026-02-22):** En Slice 3 la relevancia de búsqueda usa un ranking heurístico en backend (exacto nombre > prefijo/contains nombre > alias > tag > descripción/ruta/ubicación) compatible con SQLite bootstrap; al migrar a PostgreSQL se podrá reemplazar por full-text/trigram conservando la misma semántica de orden.
- **A-006 (2026-02-22):** En Slice 4 el escaneo QR en web usa `BarcodeDetector` nativo cuando existe soporte del navegador; si no está disponible o no hay permisos de cámara, la UI habilita fallback por token manual para mantener el flujo funcional sin dependencias nuevas.
- **A-007 (2026-02-22):** En Slice 5, `POST /warehouses/{warehouse_id}/invites` devuelve `invite_url` calculada con `frontend_url` del backend y expone `invite_token` en respuesta para uso manual/QA; cuando SMTP esté activo (Slice 6), la entrega por email podrá hacerse sin cambiar el contrato base de aceptación.
- **A-008 (2026-02-22):** En Slice 6, el endpoint `POST /settings/smtp/test` valida configuración y responde en modo simulado (sin envío real) para mantener bootstrap local sin dependencia de servidor SMTP externo; la verificación de entrega real se completará cuando se integre transporte SMTP productivo.
- **A-009 (2026-02-23):** En la primera iteración de Slice 7, la cola offline del frontend cubre de forma explícita los comandos de uso rápido (`item.favorite/unfavorite` y `stock.adjust`); el resto de operaciones mantiene modo online-first y puede ampliarse por comando sin romper el contrato `/sync`.
- **A-010 (2026-02-23):** En Slice 8, al importar un snapshot en un warehouse distinto, backend remapea IDs (`boxes`, `items`, `stock_movements`) y `qr_token` cuando detecta colisión global para preservar integridad sin exigir preprocesado del JSON en cliente.
- **A-011 (2026-02-23):** La base de despliegue Kubernetes asume un único host público servido por Traefik con routing por path (`/` frontend, `/api` backend). El dominio/TLS (`my-warehouse.example.com`, `my-warehouse-tls`) queda como plantilla y debe ajustarse por entorno.
