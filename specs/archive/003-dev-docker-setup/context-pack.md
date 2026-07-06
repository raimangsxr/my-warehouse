# Context Pack: 003-dev-docker-setup

## Goal

Introducir entorno de desarrollo local con Docker Compose y estandarizar Dockerfiles/workflows siguiendo el patrón de `amrn-bull`, adaptado a media persistente, PWA nginx y variables JWT de `my-warehouse`.

## Mandatory Context

- `specs/manifest.yml`
- `specs/contracts/ops-platform/contract.md` — **actualizar antes de implementar** (Principle III)
- `specs/contracts/app/contract.md` — solo lectura; no cambia comportamiento funcional
- `deploy/k8s/` — manifests de producción (imágenes, env, probes, ingress)
- Referencia externa: `../amrn-bull/docker-compose.yml`, `../amrn-bull/backend/Dockerfile`, `../amrn-bull/frontend/Dockerfile`, `../amrn-bull/specs/contracts/ops-platform/contract.md`

## Constraints

- No añadir `HEALTHCHECK` en Dockerfile backend ni healthcheck en servicio backend de compose.
- Conservar artefacto `release-tag` en workflow de release (bump ArgoCD).
- Mantener `nginx.conf` PWA del frontend en target `prod` (`/healthz`, service worker, manifest).
- No copiar prefijo `BULL_` ni bootstrap de operador de `amrn-bull`.
- API prefix permanece `/api/v1`; health backend `GET /healthz`.
- Volumen media obligatorio en compose para fotos de artículos.

## Diferencias respecto a amrn-bull (no copiar literal)

| Tema | amrn-bull | my-warehouse |
|------|-----------|--------------|
| Env prefix | `BULL_` | Sin prefijo (`JWT_SECRET`, `DATABASE_URL`, …) |
| Bootstrap | Operador fijo | Registro/login JWT |
| API | `/api` | `/api/v1` |
| Health | `/api/health` | `/healthz` |
| Media | N/A | Volumen `/app/media` |
| nginx prod | Básico | PWA (`ngsw`, manifest) |
| Node image | 24 | 22 (Angular 20) |

## Implementation Order

```
T0  specs/contracts/ops-platform/contract.md
 → T1  docker-compose.yml + .env.example
 → T2  backend/Dockerfile + .dockerignore
 → T3  frontend/Dockerfile + .dockerignore + environment.ts
 → T4  .github/workflows/release-images.yml + bump-app.yml
 → T5  README + quickstart validation
 → T6  docker compose config + pytest + npm run build
```

## Files / Areas Likely Involved

```
specs/contracts/ops-platform/contract.md    # T0 — FIRST
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
specs/README.md
AGENTS.md
.cursor/rules/specify-rules.mdc
```

## Do Not Read (unless justified)

- `specs.md` (raíz) — deprecado
- `specs/archive/**` — salvo consulta histórica

## Validation Plan

```bash
docker compose config
cd backend && uv run pytest -q
cd frontend && npm run build
# Smoke manual: ver quickstart.md
```

## Plan

[plan.md](./plan.md) | [quickstart.md](./quickstart.md) | [research.md](./research.md) | [tasks.md](./tasks.md)
