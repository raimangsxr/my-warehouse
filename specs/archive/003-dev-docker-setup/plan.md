# Implementation Plan: Entorno de desarrollo con Docker Compose

**Change**: `003-dev-docker-setup` | **Date**: 2026-07-06 | **Spec**: [spec.md](./spec.md)  
**Constitution**: `.specify/memory/constitution.md` v1.0.0

## Summary

Añadir `docker-compose.yml` y refactorizar Dockerfiles/workflows al patrón de `amrn-bull`, adaptado a JWT sin prefijo, API `/api/v1`, health `GET /healthz`, volumen media y nginx PWA. Crear contrato `ops-platform` como fuente de verdad operativa. No cambia comportamiento de dominio en `app` contract.

## Technical Context

**Language/Version**: Python 3.12 (backend), TypeScript / Angular 20 (frontend)

**Primary Dependencies**: FastAPI, SQLAlchemy 2.x, Alembic, Angular Material, Docker Compose v2

**Storage**: PostgreSQL 16 en compose; volumen `media-data` → `/app/media`; SQLite sigue como default en código para dev nativo

**Testing**: pytest (backend), `npm run build` (frontend), `docker compose config`

**Target Platform**: Linux containers (dev compose + k8s prod)

**Project Type**: Web application (backend + frontend)

**Performance Goals**: `docker compose up --build` primera vez <10 min (red dependiente); hot-reload frontend comparable a `ng serve`

**Constraints**: Sin HEALTHCHECK backend; migrate one-shot; PWA nginx intacto; workflows con nombres `my-warehouse-*`

**Scale/Scope**: ~10 archivos ops (compose, Dockerfiles, env example, workflows, docs); 0 cambios de API de dominio

## Constitution Check

| Principle | Status | Evidence |
|-----------|--------|----------|
| **I.** Code / contracts | PASS | Nuevo contrato `ops-platform`; `app` contract sin cambios funcionales |
| **II.** Manifest-driven | PASS | Change `003-dev-docker-setup` activo en manifest |
| **III.** Contract before impl | PASS | T0 = `ops-platform/contract.md` (ya redactado) antes de T1+ |
| **IV.** Incremental changes | PASS | Artefactos en `specs/changes/003-dev-docker-setup/` |
| **V.** Tests | PASS | pytest + build + compose config; smoke manual en quickstart |
| **VI.** Security | PASS | Secretos obligatorios en `.env`; dev defaults documentados; no commitear `.env` |
| **VII.** Simplicity | PASS | Copiar patrón probado de amrn-bull; sin refactors de app |

**Pre-implementation gate:** T0 (`ops-platform` contract) complete → proceed to T1.  
**Pre-merge gate:** compose config + pytest + build + smoke quickstart.

## Implementation Order

```
T0  specs/contracts/ops-platform/contract.md          [DONE — spec phase]
T1  docker-compose.yml + .env.example
T2  backend/Dockerfile + backend/.dockerignore
T3  frontend/Dockerfile + frontend/.dockerignore
T4  frontend/src/app/core/environment.ts (localhost)
T5  .github/workflows/release-images.yml + bump-app.yml
T6  README.md + specs/README.md
T7  Validación (compose config, pytest, build, smoke)
T8  Cierre SDD (archive, manifest) — post-merge
```

## Project Structure

### Documentation (this change)

```text
specs/changes/003-dev-docker-setup/
├── spec.md
├── plan.md
├── research.md
├── quickstart.md
├── context-pack.md
├── tasks.md
└── checklists/requirements.md

specs/contracts/ops-platform/
└── contract.md
```

### Source Code (deliverables)

```text
docker-compose.yml
.env.example
backend/Dockerfile
backend/.dockerignore
frontend/Dockerfile
frontend/.dockerignore
frontend/src/app/core/environment.ts
.github/workflows/release-images.yml
.github/workflows/bump-app.yml
README.md
```

## Design Details

### docker-compose.yml

Servicios (patrón amrn-bull con anchors YAML):

| Service | Image / build | Notes |
|---------|---------------|-------|
| `postgres` | `postgres:16` | healthcheck `pg_isready`, volumen `postgres-data` |
| `migrate` | `my-warehouse-backend:local` | `alembic upgrade head`, `restart: "no"` |
| `backend` | same | depends migrate success, puerto `8000:8000`, volumen `media-data:/app/media` |
| `frontend` | build target `dev` | puerto `4200:4200`, bind `./frontend`, volumen `frontend_node_modules` |

Variables backend (anchor `x-backend-env`):

- `DATABASE_URL=postgresql+psycopg://mywarehouse:${DATABASE_PASSWORD}@postgres:5432/mywarehouse`
- `JWT_SECRET`, `SECRET_ENCRYPTION_KEY` (required from `.env`)
- `CORS_ORIGINS` default `http://localhost:4200`
- `FRONTEND_URL` default `http://localhost:4200`
- `AUTH_COOKIE_SECURE=false`
- `MEDIA_ROOT=/app/media`

Postgres: user/db `mywarehouse`, password from `DATABASE_PASSWORD`.

### backend/Dockerfile

Multi-stage como amrn-bull:

1. `builder`: `build-essential`, `python -m build --wheel`
2. `runtime`: install wheel, copy `app/`, `alembic/`, `alembic.ini`, user `app` uid 10001, `EXPOSE 8000`, CMD uvicorn

Quitar `curl` salvo que k8s lo requiera (deploy/k8s no lo usa en probes actuales → omitir).

### frontend/Dockerfile

Targets: `base` → `deps` (`npm ci`) → `dev` | `build` → `prod`

- Args: `NODE_IMAGE=node:22-alpine`, `NGINX_IMAGE=nginxinc/nginx-unprivileged:1.27-alpine`, `BUILD_CONFIGURATION=production`
- `prod` COPY dist path: `dist/my-warehouse/browser/`
- Conservar `nginx.conf` existente (PWA)

### Workflows

Corregir `APP_NAME`, image names, añadir Buildx + GHA cache, `target: prod` en frontend, tags `latest` + release tag.

Node CI: 22 (alineado con package-lock actual).

## Complexity Tracking

N/A — no constitution violations.

## References

- `../amrn-bull/docker-compose.yml`
- `../amrn-bull/specs/changes/012-platform-standardization/`
- `deploy/k8s/secret.example.yaml` (nombres de env compatibles)
