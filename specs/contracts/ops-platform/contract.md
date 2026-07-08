# ops-platform Contract

Status: active. Owns local development and release/deployment tooling for
the FastAPI + Angular stack. Does **not** define application domain behavior
(see `specs/contracts/app/contract.md`).

## Golden Path

- Local development runs with the root `docker-compose.yml`.
- Compose starts `postgres`, `migrate`, `backend`, and `frontend`.
- PostgreSQL is the only service with a Docker Compose healthcheck.
- The backend image and backend compose service MUST NOT define a Docker
  `HEALTHCHECK`. Runtime readiness is owned by the orchestrator and by
  explicit smoke checks against `GET /health`.
- Migrations run in a one-shot `migrate` container before the backend
  service starts (`alembic upgrade head`).
- Compose uses PostgreSQL (`postgresql+psycopg://...`), not SQLite.
- Backend `media_root` (`/app/media` in the container) MUST use a named
  volume or equivalent persistent mount so item photos survive restarts.
- Backend images are multi-stage Python builds that build and install the
  project wheel, run as a non-root user (`uid` 10001), and expose port
  `8000`.
- Frontend images are parameterized multi-target builds:
  - `dev` target: Node dev server on port `4200` for compose (bind-mount
    source + named `node_modules` volume, `CHOKIDAR_USEPOLLING=true`).
  - `prod` target: unprivileged nginx serving the Angular production build
    on port `8080`, preserving PWA routes in `nginx.conf` (`/health`,
    `ngsw-worker.js`, `manifest.webmanifest`).
- Frontend build arguments include the Node base image, nginx base image,
  Angular build configuration, and `APP_VERSION` (default `dev`).
- Frontend production Docker builds run `scripts/write-app-version.mjs` to
  generate `src/app/core/app-version.ts` before `ng build`. Release workflow
  passes `github.event.release.tag_name` as `APP_VERSION`.
- Frontend dev `environment.ts` MUST target `http://localhost:8000/api`
  when using compose (prod build keeps `/api` relative path).
- Required compose secrets (validated via `.env` at repo root):
  `DATABASE_PASSWORD`, `JWT_SECRET`, `SECRET_ENCRYPTION_KEY`.
- Optional compose variables with dev defaults: `CORS_ORIGINS`,
  `FRONTEND_URL`, `AUTH_COOKIE_SECURE`, `DATABASE_URL` override.
- GitHub release workflows cache Python, npm, and Docker Buildx layers.
- Release workflows publish both the release tag and `latest` for each
  backend/frontend image, and keep uploading the `release-tag` artifact
  consumed by the argocd bump workflow.
- Workflow env: `APP_NAME=my-warehouse`, `BACKEND_IMAGE=my-warehouse-backend`,
  `FRONTEND_IMAGE=my-warehouse-frontend`.

## Kubernetes Production (`deploy/k8s/`)

Production deploys use the **same backend/frontend images** built by
`release-images.yml` (Docker Hub `rromani/my-warehouse-backend` /
`rromani/my-warehouse-frontend`). Image tags in manifests are bumped by
the `bump-app.yml` → argocd-apps workflow.

| Manifest | Role |
|----------|------|
| `namespace.yaml` | Namespace `my-warehouse` (Pod Security `restricted`) |
| `configmap.yaml` | `FRONTEND_URL`, `CORS_ORIGINS` |
| `secret.yaml` | `DATABASE_URL`, `JWT_SECRET`, `SECRET_ENCRYPTION_KEY` (gitignored locally) |
| `pv.yaml` | NFS RWX volume for `/app/media` |
| `migration-job.yaml` | One-shot `alembic upgrade head` (backend image) |
| `backend.yaml` | API `:8000`, uid `10001`, media PVC, probes `GET /health` |
| `frontend.yaml` | nginx `:8080`, probes `GET /health` |
| `ingress.yaml` | Traefik: `/api`, `/media` → backend; `/` → frontend |

Operational alignment with compose/Dockerfiles:

- Backend runs as uid **10001**; media at **`/app/media`**.
- Migrations are **out-of-band** (Job), not in container entrypoint.
- No Docker `HEALTHCHECK` in images; k8s probes use **`/health`**.
- API routes are served under **`/api`** (no version segment in the path).
- Frontend prod image listens on **8080**; Service maps port 80 → 8080.

When changing Dockerfiles, compose env, or image names, verify compatibility
with `backend.yaml`, `frontend.yaml`, and `migration-job.yaml` before release.

## Non-Docker Development

- Native backend dev MAY still use SQLite (`DATABASE_URL` default in code)
  and `uvicorn --reload`; document in README as alternative to compose.
- Native frontend dev: `npm start` on port `4200`.

## Owned Files

- `docker-compose.yml`
- `.env.example` (repo root)
- `backend/Dockerfile`
- `backend/.dockerignore`
- `frontend/Dockerfile`
- `frontend/.dockerignore`
- `frontend/scripts/write-app-version.mjs`
- `.github/workflows/release-images.yml`
- `.github/workflows/bump-app.yml`
- `deploy/k8s/` (production manifests; keep aligned with images and env)

## Validation

- `docker compose config` succeeds.
- `cd backend && uv run pytest`
- `cd frontend && npm run test -- --configuration=ci`
- `cd frontend && npm run build`
- Smoke: `GET /health`, frontend on `:4200`, media write persists across
  backend restart.
