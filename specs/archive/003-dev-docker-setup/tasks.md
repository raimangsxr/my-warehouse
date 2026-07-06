# Tasks: 003-dev-docker-setup

**Spec:** [spec.md](./spec.md) | **Plan:** [plan.md](./plan.md)

## Phase 0 — Contract (blocking)

- [x] T0.1 Crear `specs/contracts/ops-platform/contract.md`
- [x] T0.2 Registrar contrato y change activo en `specs/manifest.yml`

## Phase 1 — Compose y entorno

- [x] T1.1 Crear `.env.example` en raíz con secretos y defaults documentados
- [x] T1.2 Crear `docker-compose.yml` (`postgres`, `migrate`, `backend`, `frontend`)
  - Anchors YAML para build/env backend
  - Volumen `media-data` en backend
  - Validación `:?` en `DATABASE_PASSWORD`, `JWT_SECRET`, `SECRET_ENCRYPTION_KEY`
  - Frontend target `dev`, bind-mount, `frontend_node_modules`, polling env

## Phase 2 — Dockerfiles

- [x] T2.1 Refactor `backend/Dockerfile` a multi-stage wheel build (non-root uid 10001)
- [x] T2.2 Ampliar `backend/.dockerignore` (patrón amrn-bull)
- [x] T3.1 Refactor `frontend/Dockerfile` a multi-target (`deps`, `dev`, `build`, `prod`)
- [x] T3.2 Ampliar `frontend/.dockerignore`
- [x] T3.3 Actualizar `frontend/src/app/core/environment.ts` → `http://localhost:8000/api/v1`

## Phase 3 — CI / release

- [x] T4.1 Actualizar `.github/workflows/release-images.yml`
  - `APP_NAME=my-warehouse`, imágenes `my-warehouse-backend` / `my-warehouse-frontend`
  - pip/npm cache, Docker Buildx, GHA cache scopes
  - Frontend `target: prod`, build-args, tags release + `latest`
- [x] T4.2 Actualizar `.github/workflows/bump-app.yml` con mismos nombres de app/imagen

## Phase 4 — Documentación

- [x] T5.1 Actualizar `README.md` sección "Ejecutar en local" con golden path compose
- [x] T5.2 Actualizar `specs/README.md` (contrato ops-platform, change activo)
- [x] T5.3 Actualizar `AGENTS.md` y `.cursor/rules/specify-rules.mdc`

## Phase 5 — Validación

- [x] T6.1 `docker compose config`
- [x] T6.2 `cd backend && uv run pytest -q`
- [x] T6.3 `cd frontend && npm run build`
- [x] T6.4 Smoke manual: healthz, frontend :4200, signup + crear warehouse vía API

## Phase 6 — Cierre SDD (post-merge)

- [x] T7.1 Mover change a `specs/archive/003-dev-docker-setup/`
- [x] T7.2 Actualizar `specs/manifest.yml` (`active.change: null`)

## Dependency Graph

```text
T0 → T1 → T2/T3 (paralelo) → T4 → T5 → T6 → T7
```

## Parallel Example

Tras T1, pueden ejecutarse en paralelo:
- T2.* (backend Dockerfile + dockerignore)
- T3.* (frontend Dockerfile + dockerignore + environment.ts)
