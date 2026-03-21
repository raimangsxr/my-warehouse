---
inclusion: always
---

# my-warehouse — Visión general del proyecto

## Qué es

PWA para inventariar objetos de garaje/trastero/almacén. Premisa: **guardar rápido, encontrar rápido**.

- Cajas jerárquicas (árbol ilimitado) con QR único por caja
- Artículos con foto, stock, tags, alias y favoritos
- Enriquecimiento automático de metadatos con Gemini (backend)
- Captura masiva por lote con procesamiento IA paralelo
- Offline-first con sync incremental y resolución de conflictos
- Multiusuario sin roles (todos los miembros tienen los mismos permisos)

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | Angular 20 + Angular Material 20 (standalone components, PWA) |
| Backend | FastAPI 0.116+ + SQLAlchemy 2 + Alembic |
| Base de datos | PostgreSQL (SQLite en dev local) |
| Auth | JWT (HS256) + Argon2 + refresh tokens rotativos |
| LLM | Gemini API (solo backend, clave cifrada) |
| Despliegue | Docker + Kubernetes (Talos, Traefik ingress) |

## Estructura del repositorio

```
my-warehouse/
├── backend/          # FastAPI app
│   ├── app/
│   │   ├── api/v1/endpoints/   # Routers por dominio
│   │   ├── models/             # SQLAlchemy models
│   │   ├── schemas/            # Pydantic schemas
│   │   ├── services/           # Lógica de negocio
│   │   └── core/               # Config, LLM
│   └── alembic/versions/       # Migraciones
├── frontend/         # Angular PWA
│   └── src/app/
│       ├── core/               # Auth, interceptors, env
│       ├── services/           # HTTP services
│       └── (vistas por ruta)
├── deploy/k8s/       # Manifests Kubernetes
└── specs.md          # Fuente de verdad del producto ← LEER SIEMPRE
```

## Fuente de verdad

Las specs viven en `.kiro/specs/my-warehouse/`:
- `requirements.md` — requisitos en formato EARS (qué debe hacer el sistema)
- `design.md` — arquitectura, modelo de datos, API y componentes
- `tasks.md` — slices completados y backlog

**Leer las secciones relevantes antes de implementar cualquier cambio.**

Versión actual: **v1.79** (2026-03-08)
