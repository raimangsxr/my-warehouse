# my-warehouse

PWA para gestión de inventario de garaje/trastero con cajas jerárquicas, QR por caja, búsqueda avanzada y soporte offline-first.

La especificación viva del producto está en `/Users/rromanit/workspace/my-warehouse/specs.md` y es la fuente de verdad.

## Objetivo del proyecto

Permitir localizar objetos rápidamente mediante:

- Árbol de cajas (`box` dentro de `box`)
- Artículos con stock y favoritos
- Escaneo QR para abrir una caja
- Búsqueda por nombre, alias, tags, ruta y ubicación física
- Sincronización offline/online con resolución de conflictos

## Stack

- Frontend: Angular + Angular Material (PWA)
- Backend: FastAPI + SQLAlchemy + Alembic
- Base de datos objetivo: PostgreSQL
- Estado actual local (bootstrap): SQLite

## Estructura del repositorio

- `/Users/rromanit/workspace/my-warehouse/specs.md`: especificación funcional y técnica
- `/Users/rromanit/workspace/my-warehouse/backend`: API, modelos, migraciones y tests
- `/Users/rromanit/workspace/my-warehouse/frontend`: app Angular (UI + integración API)

## Estado actual

Se inició la **Slice 1 (Fundaciones)**:

- Backend implementado:
  - Auth: `signup`, `login`, `refresh`, `logout`, `me`
  - Warehouses: listar, crear, detalle y miembros
  - Migración Alembic inicial
  - Test de integración básico
- Frontend implementado:
  - Pantallas `login`, `signup`, `warehouses`, `shell`
  - Interceptor JWT y guards de autenticación
  - Creación/listado de warehouses y selección persistida

Pendiente para cerrar Slice 1:

- `forgot-password` y `reset-password`
- Ajustes UX responsive finos del shell

## Requisitos

- Python 3.11+
- Node.js 20+ (recomendado LTS par)
- npm

## Ejecutar backend

```bash
cd /Users/rromanit/workspace/my-warehouse/backend
python -m venv .venv
source .venv/bin/activate
pip install -e .
pytest -q
uvicorn app.main:app --reload --port 8000
```

## Ejecutar frontend

```bash
cd /Users/rromanit/workspace/my-warehouse/frontend
npm install
npm start
```

App frontend: `http://localhost:4200`  
API backend: `http://localhost:8000`

## Build frontend

```bash
cd /Users/rromanit/workspace/my-warehouse/frontend
npm run build
```

## Próximas slices (resumen)

1. Slice 1: Auth + Warehouses + Shell
2. Slice 2: Boxes + Items + Favoritos + Stock movements
3. Slice 3: Search + filtros + nube de tags
4. Slice 4: QR + scanner + detalle recursivo
5. Slice 5: Multiusuario invites + papelera/restauración
6. Slice 6: Settings SMTP + Gemini
7. Slice 7: Offline sync + conflictos
8. Slice 8: Export/Import

## Notas

- No guardar secretos en frontend (Gemini/SMTP siempre backend cifrado).
- En cambios funcionales, actualizar siempre `specs.md` + changelog.
