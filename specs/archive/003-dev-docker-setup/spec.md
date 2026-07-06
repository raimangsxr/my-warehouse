# Feature Specification: Entorno de desarrollo con Docker Compose

**Change**: `003-dev-docker-setup`  
**Created**: 2026-07-06  
**Status**: Active  
**Input**: Alinear `my-warehouse` con el patrón de `amrn-bull` para desarrollo local con `docker-compose`, Dockerfiles multi-stage/multi-target, y workflows de release corregidos.

## Goal

Ofrecer un **golden path** de desarrollo local reproducible: un único comando levanta PostgreSQL, migraciones, backend y frontend con hot-reload, sin cambiar el comportamiento funcional de la aplicación (`specs/contracts/app/contract.md`).

## User Scenarios & Testing

### User Story 1 - Levantar el stack completo (Priority: P1)

Como desarrollador, quiero ejecutar `docker compose up --build` desde la raíz del repositorio y tener la aplicación funcionando contra PostgreSQL real, para no depender de venv + SQLite + `npm start` en tres terminales.

**Why this priority**: Desbloquea onboarding y pruebas de integración local con la misma BD que producción.

**Independent Test**: Tras `docker compose up --build`, `GET http://localhost:8000/healthz` responde OK, el frontend carga en `http://localhost:4200`, y puedo registrar un usuario y crear un almacén.

**Acceptance Scenarios**:

1. **Given** un `.env` válido en la raíz, **When** ejecuto `docker compose up --build`, **Then** los servicios `postgres`, `migrate`, `backend` y `frontend` arrancan en orden (migrate antes de backend).
2. **Given** el stack levantado, **When** abro `http://localhost:4200`, **Then** el frontend llama a `http://localhost:8000/api/v1` (no a una IP LAN hardcodeada).
3. **Given** el stack levantado, **When** subo una foto de artículo, **Then** el fichero persiste en el volumen de media del backend y sobrevive a `docker compose restart backend`.

---

### User Story 2 - Iterar frontend con hot-reload (Priority: P2)

Como desarrollador frontend, quiero editar código Angular y ver los cambios sin reconstruir la imagen, cuando uso compose en modo desarrollo.

**Why this priority**: Mantiene la productividad diaria comparable a `ng serve` nativo.

**Independent Test**: Cambiar un texto visible en una pantalla y ver el reload automático con el servicio `frontend` en target `dev`.

**Acceptance Scenarios**:

1. **Given** compose con servicio `frontend` (target `dev`), **When** modifico un `.ts` o `.html` en `./frontend`, **Then** el dev server recarga sin `docker compose build frontend`.
2. **Given** macOS o Docker Desktop con file watching limitado, **When** el servicio frontend arranca, **Then** usa polling (`CHOKIDAR_USEPOLLING`) y volumen nombrado para `node_modules`.

---

### User Story 3 - Imágenes y release alineados con el proyecto (Priority: P3)

Como mantenedor, quiero que los Dockerfiles y workflows de GitHub Actions sigan el mismo modelo que `amrn-bull` (multi-stage, caches, tags `latest`), con nombres correctos de `my-warehouse` (no `kiosk-screen`).

**Why this priority**: Evita releases rotos y facilita despliegue k8s/ArgoCD existente.

**Independent Test**: `docker compose config` válido; workflow `release-images.yml` referencia `my-warehouse` / `my-warehouse-backend` / `my-warehouse-frontend`; build frontend usa `target: prod` con PWA nginx intacto.

**Acceptance Scenarios**:

1. **Given** un release de GitHub, **When** corre `Release Images`, **Then** publica backend y frontend con tag de release y `latest`, conservando el artefacto `release-tag`.
2. **Given** build de imagen frontend prod, **When** inspecciono nginx, **Then** siguen las rutas PWA (`ngsw-worker.js`, `manifest.webmanifest`, `/healthz`).

---

### Edge Cases

- `.env` sin secretos obligatorios → compose falla al arrancar con mensaje claro (`:?` en variables críticas).
- Postgres aún no healthy → `migrate` y `backend` esperan; no arrancan con BD caída.
- `migrate` falla → `backend` no inicia (`condition: service_completed_successfully`).
- Desarrollo sin Docker sigue soportado: venv + SQLite documentado en README (no se elimina).
- Backend sin `HEALTHCHECK` en Dockerfile ni healthcheck en servicio compose (readiness vía `GET /healthz` manual o orquestador).

## Requirements

### Functional Requirements

- **FR-001**: Debe existir `docker-compose.yml` en la raíz con servicios `postgres`, `migrate`, `backend` y `frontend`.
- **FR-002**: `migrate` ejecuta `alembic upgrade head` como contenedor one-shot antes del backend.
- **FR-003**: Solo `postgres` define healthcheck en compose.
- **FR-004**: Backend Dockerfile multi-stage (wheel build + runtime non-root), sin `HEALTHCHECK`, puerto `8000`, directorio media preparado.
- **FR-005**: Frontend Dockerfile multi-target: `dev` (ng serve) y `prod` (nginx unprivileged `:8080`), con build-args parametrizables.
- **FR-006**: Compose monta volumen persistente para `/app/media` en backend.
- **FR-007**: Compose usa PostgreSQL (`postgresql+psycopg://...`); variables de entorno documentadas en `.env.example` raíz.
- **FR-008**: Secretos mínimos en compose: `DATABASE_PASSWORD`, `JWT_SECRET`, `SECRET_ENCRYPTION_KEY` (validación obligatoria en `.env`).
- **FR-009**: `frontend/src/app/core/environment.ts` usa `http://localhost:8000/api/v1` para desarrollo en Docker.
- **FR-010**: `.dockerignore` de backend y frontend alineados con el patrón de `amrn-bull`.
- **FR-011**: Workflows `release-images.yml` y `bump-app.yml` usan `APP_NAME=my-warehouse` e imágenes `my-warehouse-backend` / `my-warehouse-frontend`.
- **FR-012**: `release-images.yml` añade caches pip/npm y Docker Buildx GHA; publica tag de release y `latest`.
- **FR-013**: Contrato activo `specs/contracts/ops-platform/contract.md` define el golden path antes de implementar.
- **FR-014**: No se altera comportamiento de API, auth, sync ni PWA más allá de la URL base de desarrollo.

### Key Entities

- **Stack local**: Conjunto de servicios compose para desarrollo.
- **Volumen media**: Almacenamiento persistente de fotos bajo `media_root`.
- **Imagen backend/frontend**: Artefactos de build para dev (compose) y prod (k8s/release).

## Success Criteria

- **SC-001**: Un desarrollador nuevo levanta el stack en menos de 10 minutos siguiendo `quickstart.md` (excluyendo descarga inicial de imágenes).
- **SC-002**: `docker compose config` termina sin errores.
- **SC-003**: Flujo manual P1 (registro + crear warehouse + healthz) completable con el stack Docker.
- **SC-004**: `cd backend && uv run pytest` y `cd frontend && npm run build` siguen pasando tras los cambios.
- **SC-005**: Workflows de release referencian nombres de app/imagen correctos (verificación por revisión de YAML).

## Assumptions

- Docker Engine y Compose v2 disponibles en la máquina de desarrollo.
- Patrón de referencia: `amrn-bull` change `012-platform-standardization` y contrato `ops-platform`.
- Node 22 para imágenes CI/dev (compatible con Angular 20 del proyecto).
- Prefijo de variables sin `MW_`: se mantienen nombres actuales (`DATABASE_URL`, `JWT_SECRET`, etc.) por compatibilidad con k8s manifests existentes.
- LLM/Gemini se configura por warehouse en BD; no requiere secretos globales en compose para el golden path básico.
- Desarrollo nativo sin Docker permanece como alternativa documentada.

## Validation

- `docker compose config`
- Smoke manual descrito en `quickstart.md`
- `cd backend && uv run pytest`
- `cd frontend && npm run build`
- Revisión estática de `.github/workflows/*.yml`
