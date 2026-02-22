# my-warehouse — `specs.md` (Source of Truth)

**Proyecto:** my-warehouse (PWA para inventario de garaje con cajas jerárquicas y QR)  
**Frontend:** Angular PWA + Angular Material (Material Design)  
**Backend:** FastAPI + SQLAlchemy + Alembic + PostgreSQL  
**Multiusuario:** Sí (desde el día 1, sin roles)  
**Offline-first + Sync + Conflictos:** Sí  
**LLM:** Gemini (tags y alias automáticos)

---

## Control del documento

- **Versión:** v0.2  
- **Última actualización:** 2026-02-22  
- **Owner:** (mantener por el equipo)  
- **Estado:** Activo (este fichero es la especificación viva del producto)

### Changelog (mantener siempre al día)
> Regla: **cualquier cambio de implementación que afecte funcionalidad/UX/API/datos debe reflejarse aquí** y anotarse en el changelog.

- **v0.1 (2026-02-22):** Primera especificación completa (MVP + roadmap + arquitectura + sync + Gemini).
- **v0.2 (2026-02-22):** Arranque Slice 1 implementado (backend auth + warehouses + migración inicial + tests, frontend login/signup/warehouses/shell conectado por API). Se añade CORS de desarrollo para `http://localhost:4200`. Nota temporal: entorno local inicial con SQLite para bootstrap, objetivo final sigue siendo PostgreSQL.

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
- `/warehouses` (lista + crear + seleccionar)
- `/app` (shell)
  - `/app/home` (buscador + favoritos)
  - `/app/items/new`
  - `/app/items/:id` (detalle/edición)
  - `/app/boxes` (árbol de cajas)
  - `/app/boxes/:id` (detalle de caja)
  - `/app/scan` (escaneo QR)
  - `/app/settings` (configuración)
  - `/app/conflicts` (lista + resolución)

### Shell (Material)
- Toolbar superior con:
  - selector de warehouse (si aplica)
  - icono escáner/cámara (QR)
  - acceso a settings
- Responsive:
  - móvil: navegación compacta (sidenav overlay)
  - tablet/escritorio: sidenav persistente

### Home
- Buscador arriba (input fijo).
- Estado inicial: favoritos del usuario + chips de filtros rápidos.
- Al escribir: filtra y ordena por relevancia.
- Acciones rápidas en cada card: ⭐, +/- stock, mover, borrar.

### Árbol de cajas
- Árbol con expand/collapse (Material Tree).
- Drag & drop:
  - mover caja dentro de otra caja
  - mover artículo a otra caja
- Mostrar contadores por caja:
  - total artículos recursivo
  - total cajas recursivo

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
- [ ] Registro con email + password.
- [ ] Validación password (mínimo longitud, etc.).
- [ ] Tras registro: acceso a crear/seleccionar warehouse.

**US-A2: Login/Logout**
- [ ] Login devuelve access token + refresh token.
- [ ] Logout invalida refresh token.
- [ ] Sesión persistente (PWA).

**US-A3: Cambio de contraseña**
- [ ] Usuario autenticado puede cambiar contraseña (requiere password actual).

**US-A4: Recuperación de contraseña por email**
- [ ] Solicitud reset → email con link token.
- [ ] Token caduca, un solo uso.
- [ ] Tras reset, refresh tokens previos quedan invalidados.

---

### EPIC B — Warehouses (multiusuario sin roles)
**US-B1: Crear warehouse**
- [ ] Crear warehouse con nombre.
- [ ] Creador queda como miembro.

**US-B2: Listar/seleccionar warehouses**
- [ ] Listar warehouses donde el usuario es miembro.
- [ ] Selección persistida en cliente.

**US-B3: Invitar usuario**
- [ ] Generar invitación (token/link).
- [ ] Opcional: enviar por email (SMTP).
- [ ] Expira.
- [ ] Aceptar → miembro.

**US-B4: Ver miembros**
- [ ] Miembros visibles para cualquier miembro.

---

### EPIC C — Cajas (árbol)
**US-C1: Crear caja**
- [ ] Crear en raíz o bajo `parent_box_id`.
- [ ] Si no nombre: “Caja N” incremental por warehouse.
- [ ] Genera QR token + short_code único.

**US-C2: Editar caja**
- [ ] Editar nombre, descripción, ubicación física opcional.

**US-C3: Mover caja**
- [ ] Drag & drop cambia parent.
- [ ] Prohibido crear ciclos (no mover dentro de un descendiente).

**US-C4: Borrado seguro**
- [ ] Soft-delete a papelera.
- [ ] Si contiene elementos, requiere confirmación explícita.
- [ ] Restauración.

**US-C5: Conteos**
- [ ] Mostrar:
  - `total_items_recursive`
  - `total_boxes_recursive`

---

### EPIC D — Artículos
**US-D1: Crear artículo**
- [ ] Campos: name (req), desc (opt), photo (opt), box (req), ubicación física (opt).
- [ ] Enriquecimiento LLM (tags + alias) si habilitado.

**US-D2: Editar artículo**
- [ ] Cambiar name/desc/photo/box/ubicación.
- [ ] Si cambia name/desc → re-LLM (si habilitado).

**US-D3: Favoritos por usuario**
- [ ] Toggle ⭐ por usuario.
- [ ] Home muestra favoritos por defecto.

**US-D4: Stock rápido**
- [ ] +/-1 crea `StockMovement` idempotente (command_id).
- [ ] Stock mostrado = suma movimientos.

**US-D5: Borrado seguro**
- [ ] Soft-delete + restauración.

**US-D6: Acciones en lote**
- [ ] Selección múltiple + acciones:
  - mover a caja
  - marcar/desmarcar favoritos
  - borrar

---

### EPIC E — Búsqueda + filtros + nube de tags
**US-E1: Búsqueda de artículos**
- [ ] Busca por: nombre, descripción, tags, alias, ruta, ubicación física.
- [ ] Actualización incremental con debounce.
- [ ] Orden por relevancia (match exacto > parcial).

**US-E2: Filtros rápidos**
- [ ] Chips: Favoritos, Stock=0, Con foto, Sin foto, etc.

**US-E3: Nube de tags**
- [ ] Chips discretos.
- [ ] Click en tag filtra.

---

### EPIC F — QR (solo cajas)
**US-F1: Escaneo desde header**
- [ ] Permisos cámara con UX claro.
- [ ] Escaneo abre detalle caja.

**US-F2: Deep link seguro**
- [ ] QR token no adivinable.
- [ ] Login redirect.
- [ ] Control acceso por warehouse.

---

### EPIC G — Configuración (SMTP + Gemini)
**US-G1: Config SMTP**
- [ ] Por warehouse.
- [ ] Guardado seguro (password cifrado).
- [ ] “Test email”.

**US-G2: Config Gemini API key**
- [ ] Guardada cifrada en backend.
- [ ] Toggles auto-tags/auto-alias.
- [ ] Reprocesar tags/alias.

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
- `POST /auth/forgot-password`
- `POST /auth/reset-password`

### Warehouses
- `GET /warehouses`
- `POST /warehouses`
- `GET /warehouses/{id}`
- `GET /warehouses/{id}/members`
- `POST /warehouses/{id}/invites`
- `POST /invites/{token}/accept`

### Boxes
- `GET /boxes?warehouse_id=...&parent_id=...`
- `POST /boxes`
- `GET /boxes/{id}`
- `PATCH /boxes/{id}`
- `POST /boxes/{id}/move` (new_parent_id)
- `DELETE /boxes/{id}` (soft)
- `POST /boxes/{id}/restore`
- `GET /boxes/by-qr/{qr_token}` → devuelve box_id + warehouse_id
- `GET /boxes/{id}/items?recursive=true` → lista plana con ruta

### Items
- `GET /items?warehouse_id=...&q=...&filters=...`
- `POST /items`
- `GET /items/{id}`
- `PATCH /items/{id}`
- `DELETE /items/{id}` (soft)
- `POST /items/{id}/restore`
- `POST /items/{id}/move` (box_id)
- `POST /items/{id}/favorite` (toggle o set)

Stock:
- `POST /items/{id}/stock` body: `{ "delta": 1, "command_id": "uuid" }`

### Photos
- `POST /photos` (multipart) → devuelve photo_id + url
- `GET /photos/{photo_id}` (cacheable, immutable por hash/etag)

### Tags
- `GET /tags?warehouse_id=...`
- `GET /tags/cloud?warehouse_id=...` → `{ tag, count }[]`

### Settings
- `GET /settings/smtp?warehouse_id=...`
- `PUT /settings/smtp?warehouse_id=...`
- `POST /settings/smtp/test?warehouse_id=...`

- `GET /settings/llm?warehouse_id=...`
- `PUT /settings/llm?warehouse_id=...`
- `POST /settings/llm/reprocess-item/{item_id}`

### Sync
- `POST /sync/push`
- `GET /sync/pull?warehouse_id=...&since_seq=...`
- `POST /sync/resolve`

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
- Estado actual (2026-02-22): **en progreso avanzado**.
  - Implementado: `signup`, `login`, `refresh`, `logout`, `me`; `list/create/get/members` de warehouses; migración inicial Alembic; test integración auth+warehouses.
  - Implementado frontend: pantallas login/signup/warehouses/shell, interceptor JWT, guards de ruta y persistencia local de tokens/warehouse seleccionado.
  - Pendiente de Slice 1: forgot/reset password y refinamientos de UX responsive del shell.

### Slice 2 — Core: Boxes + Items + Favoritos + Stock Movements
- CRUD cajas (sin QR aún).
- CRUD items.
- Favoritos por usuario.
- Stock +/-1 como eventos.

### Slice 3 — Search + filtros + nube de tags (inicial)
- Buscador incremental.
- Chips filtros.
- Nube tags (aunque aún se alimentará más tarde).

### Slice 4 — QR cajas + Scan + Detalle recursivo con rutas
- qr_token + endpoint by-qr.
- scanner.
- detalle caja con lista plana recursiva + breadcrumbs.

### Slice 5 — Multiusuario: invites + papelera/restauración + actividad mínima
- invitaciones.
- soft delete + restore.
- actividad básica.

### Slice 6 — Settings: SMTP + Gemini + autogen tags/alias
- settings SMTP + test.
- settings Gemini + autogen tags/alias.
- reprocesado manual.

### Slice 7 — Offline + Sync + Conflictos
- IndexedDB + cola.
- /sync push/pull + change_log + processed_commands.
- UI de conflictos.

### Slice 8 — Export/Import
- export JSON (y opcional CSV).
- import JSON con validación.

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
