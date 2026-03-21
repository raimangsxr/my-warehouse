---
inclusion: manual
---

# Despliegue — Docker y Kubernetes

## Imágenes Docker

### Backend (`backend/Dockerfile`)
- Base: Python 3.11 slim
- Usuario no privilegiado: `uid=10001`
- Escritura permitida en `/app/media`
- Comando: `uvicorn app.main:app --host 0.0.0.0 --port 8000`

### Frontend (`frontend/Dockerfile`)
- Build: `ng build --configuration production` (activa `fileReplacements` + SW)
- Serving: `nginxinc/nginx-unprivileged`, puerto interno **8080**
- Nginx configurado para SPA (fallback a `index.html`) y sin caché agresiva en `manifest`/`ngsw`

## Variables de entorno del backend

| Variable | Descripción | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `sqlite:///./my_warehouse.db` |
| `JWT_SECRET` | Secreto para firmar tokens | `change-me` |
| `JWT_ALGORITHM` | Algoritmo JWT | `HS256` |
| `ACCESS_TOKEN_MINUTES` | Expiración access token | `30` |
| `REFRESH_TOKEN_DAYS` | Expiración refresh token | `30` |
| `PERSISTENT_LOGIN_DAYS` | Expiración sesión persistente | `365` |
| `SECRET_ENCRYPTION_KEY` | Clave para cifrar SMTP/LLM secrets | `change-me-secret-key` |
| `FRONTEND_URL` | URL del frontend (CORS) | `http://localhost:4200` |
| `CORS_ORIGINS` | Lista separada por comas | `http://localhost:4200` |
| `MEDIA_ROOT` | Ruta de almacenamiento de fotos | `./media` |
| `LOG_LEVEL` | Nivel de logging | `INFO` |

## Kubernetes (`deploy/k8s/`)

### Manifests (aplicar con `kubectl apply -f`)
- `namespace.yaml` — Namespace con PSS `restricted`
- `config.yaml` — ConfigMap con variables de entorno no secretas
- `secrets.yaml` — Template para `DATABASE_URL`, `JWT_SECRET`, `SECRET_ENCRYPTION_KEY`
- `backend.yaml` — Deployment + Service (puerto 8000)
- `frontend.yaml` — Deployment + Service (containerPort/targetPort **8080**, service 80)
- `ingress.yaml` — Traefik Ingress: `/api` + `/media` → backend, `/` → frontend
- `media-nfs.yaml` — PV/PVC NFS RWX montado en `/app/media` del backend
- `alembic-job.yaml` — Job de migración (`alembic upgrade head`) antes del deploy

### Hardening de pods (Talos / PSS restricted)
- `runAsNonRoot: true`
- `seccompProfile: RuntimeDefault`
- `allowPrivilegeEscalation: false`
- `capabilities.drop: [ALL]`
- `readOnlyRootFilesystem: true` con `emptyDir` para `/tmp`

### Dependencias externas
- PostgreSQL: **fuera del cluster**, inyectado por `DATABASE_URL` en Secret
- Media storage: NFS estático (PV/PVC RWX), el servidor NFS debe conceder escritura a `uid/gid 10001`
- Sin `kustomization.yaml` (despliegue directo con `kubectl apply`)

## Ingress (Traefik)

```
/ → frontend:80 (SPA)
/api → backend:8000
/media → backend:8000  ← importante: sin esto las fotos aparecen rotas
```

El dominio y TLS (`my-warehouse.example.com`, `my-warehouse-tls`) son plantillas; ajustar por entorno.

## Desarrollo local

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e .
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm start   # http://localhost:4200
```

- Frontend apunta a `http://localhost:8000/api/v1` en dev (ver `environment.ts`).
- SQLite como BD local (`./my_warehouse.db`).
