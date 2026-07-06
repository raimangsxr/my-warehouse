# Research: 003-dev-docker-setup

## R1 — Patrón de referencia (amrn-bull)

**Decision:** Adoptar la estructura de `amrn-bull` change `012-platform-standardization` como baseline.

**Rationale:** Mismo stack (FastAPI + Angular + Postgres + Alembic + k8s/ArgoCD). El patrón está probado en producción y documentado en `ops-platform` contract.

**Alternatives considered:**
- Mantener solo dev nativo (venv + SQLite) — rechazado: onboarding lento, divergencia con prod.
- Monolito SPA en backend (como README antiguo de bull) — rechazado: my-warehouse ya separa frontend nginx en k8s.

## R2 — Variables de entorno

**Decision:** Mantener nombres sin prefijo (`DATABASE_URL`, `JWT_SECRET`, …) compatibles con `deploy/k8s/`.

**Rationale:** Evita refactor de `config.py` y manifests k8s. Compose construye `DATABASE_URL` desde `DATABASE_PASSWORD` como hace bull con `BULL_DATABASE_PASSWORD`.

**Alternatives considered:**
- Prefijo `MW_` — rechazado: breaking change sin beneficio claro.

## R3 — Node.js version en imágenes

**Decision:** `node:22-alpine` para target `dev` y builds CI.

**Rationale:** Angular 20 compatible; `release-images.yml` actual ya usa Node 22. Bull usa 24 con Angular 22 — no aplicable aquí.

## R4 — Volumen media

**Decision:** Volumen nombrado `media-data` montado en `/app/media` en servicio backend.

**Rationale:** Fotos de artículos e intake deben persistir entre reinicios; alineado con `media_root` en k8s (NFS en prod, volumen local en dev).

**Alternatives considered:**
- Bind-mount `./media` — válido pero ensucia working tree; volumen nombrado más limpio para dev.

## R5 — Frontend dev API URL

**Decision:** `environment.ts` → `http://localhost:8000/api/v1`.

**Rationale:** Elimina IP LAN hardcodeada (`192.168.1.136`); compose expone backend en localhost:8000.

**Alternatives considered:**
- Proxy en `angular.json` — más config; bull usa URL absoluta en environment dev y funciona bien.

## R6 — Healthchecks

**Decision:** Sin HEALTHCHECK en imagen backend; sin healthcheck en servicio backend compose. Solo postgres con healthcheck.

**Rationale:** Contrato ops-platform de amrn-bull; readiness vía `GET /healthz` en smoke/orquestador.

## R7 — Workflows kiosk-screen → my-warehouse

**Decision:** Renombrar `APP_NAME`, `BACKEND_IMAGE`, `FRONTEND_IMAGE` en ambos workflows.

**Rationale:** Copia errónea de otro repo; bump ArgoCD apunta a manifests `my-warehouse` (ver `deploy/k8s/`).

## R8 — Contrato app vs ops-platform

**Decision:** Nuevo contrato `ops-platform`; `app` contract sin cambios.

**Rationale:** Principle III aplica a "deployment assumptions"; el dominio de inventario no cambia. Constitution permite contratos separados por ámbito.
