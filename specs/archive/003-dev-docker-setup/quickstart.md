# Quickstart: Desarrollo local con Docker Compose

Prerrequisitos: Docker Engine + Compose v2.

## 1. Configurar entorno

```bash
cd /Users/rromanit/workspace/my-warehouse
cp .env.example .env
```

Edita `.env` y define al menos:

```env
DATABASE_PASSWORD=dev-db-password-change-me
JWT_SECRET=dev-jwt-secret-change-me-with-openssl-rand-hex-32
SECRET_ENCRYPTION_KEY=dev-encryption-key-change-me-32chars-min
```

Valores opcionales (tienen default en compose):

```env
CORS_ORIGINS=http://localhost:4200
FRONTEND_URL=http://localhost:4200
AUTH_COOKIE_SECURE=false
```

## 2. Levantar el stack

```bash
docker compose up --build
```

Servicios:

| Servicio | URL |
|----------|-----|
| Frontend (ng serve) | http://localhost:4200 |
| Backend API | http://localhost:8000/api/v1 |
| Health | http://localhost:8000/healthz |

## 3. Smoke test manual

1. Abre http://localhost:4200
2. Registra un usuario nuevo
3. Crea un almacén
4. Sube una foto en un artículo (opcional)
5. Verifica health: `curl -s http://localhost:8000/healthz`
6. Reinicia backend: `docker compose restart backend` — la foto debe seguir visible

## 4. Desarrollo frontend con hot-reload

El servicio `frontend` monta `./frontend` y usa target `dev`. Edita archivos en `frontend/src/`; los cambios recargan automáticamente.

## 5. Parar y limpiar

```bash
docker compose down          # conserva volúmenes (postgres + media)
docker compose down -v     # borra datos locales
```

## 6. Alternativa sin Docker

```bash
# Terminal 1 — backend (SQLite)
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend
npm install
npm start
```

## 7. Validación CI local

```bash
docker compose config
cd backend && uv run pytest -q
cd frontend && npm run build
```

## Troubleshooting

- **migrate falla:** revisa logs `docker compose logs migrate`; Postgres debe estar healthy.
- **frontend no recarga en macOS:** ya está `CHOKIDAR_USEPOLLING=true` y `--poll 2000`.
- **CORS errors:** confirma `CORS_ORIGINS` incluye `http://localhost:4200`.
- **401 en API desde frontend:** confirma `environment.ts` apunta a `http://localhost:8000/api/v1`.
