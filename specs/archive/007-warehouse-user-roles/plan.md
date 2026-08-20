# Implementation Plan: Roles de usuario por warehouse

**Branch**: `codex/007-warehouse-user-roles` | **Date**: 2026-08-20 | **Spec**: `specs/changes/007-warehouse-user-roles/spec.md`

## Summary

Añadir un rol fijo (`administrator` o `contributor`) a cada membresía e invitación. La autorización seguirá siendo por warehouse: ambos roles gestionan contenido operativo y solo Administrador puede usar Settings, sincronización, export/import, invitaciones, miembros/roles y eliminación. El backend será la autoridad; Angular consumirá el rol del warehouse seleccionado para guards y visibilidad. Una migración asignará Administrador al creador histórico y Contribuidor al resto.

## Technical Context

**Language/Version**: Python 3.11+, TypeScript 5.8 / Angular 20
**Primary Dependencies**: FastAPI, SQLAlchemy 2.x, Alembic, Pydantic; Angular Material, RxJS
**Storage**: PostgreSQL en producción y SQLite en desarrollo/tests
**Testing**: pytest/pytest-asyncio/httpx; Vitest vía `ng test`; Angular production build
**Target Platform**: API Linux y aplicación web/PWA responsive
**Project Type**: Aplicación web con backend y frontend separados
**Performance Goals**: No introducir consultas por miembro en listados; autorización con una consulta de membresía por petición
**Constraints**: Multi-tenant estricto; permisos efectivos siempre derivados del backend; migración compatible con PostgreSQL y SQLite; al menos un Administrador por warehouse
**Scale/Scope**: Dos roles fijos, una migración, endpoints de invitación/membresía y un módulo Angular de miembros; sin permisos personalizados ni expulsión

## Constitution Check

| Principle | Result | Evidence |
|-----------|--------|----------|
| I. Code / contracts | PASS | El plan parte del código actual y exige sincronizar `specs/contracts/app/contract.md`. |
| II. Manifest-driven | PASS | `specs/manifest.yml` apunta al cambio 007 y a su context pack. |
| III. Contract before impl | PASS | La actualización del contrato es la primera tarea de Phase 0, antes de código. |
| IV. Incremental changes | PASS | Todos los artefactos viven bajo `specs/changes/007-warehouse-user-roles/`. |
| V. Tests | PASS | Se prevén tests de migración/API/autorización/UI y validaciones completas. |
| VI. Security | PASS | La autorización es server-side por membresía; se protege el último admin y las acciones destructivas existentes. |
| VII. Simplicity | PASS | Dos roles fijos, sin ACL configurable, ownership nuevo ni expulsión. |

**Post-design re-check**: PASS. El modelo, contrato HTTP y quickstart mantienen el alcance y los controles anteriores.

## Project Structure

### Documentation

```text
specs/changes/007-warehouse-user-roles/
├── spec.md
├── context-pack.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/http-api.md
├── checklists/
└── tasks.md
```

### Source Code

```text
backend/
├── alembic/versions/             # migración de roles y backfill
├── app/
│   ├── api/deps.py               # autorización Administrador reutilizable
│   ├── api/v1/endpoints/         # warehouses, settings, sync y transfer
│   ├── models/                   # Membership y WarehouseInvite
│   ├── schemas/warehouse.py      # contratos de rol, miembros e invitaciones
│   └── services/                 # autorización de eliminación y actividad
└── tests/                        # migración, API y matriz de permisos

frontend/src/app/
├── core/guards/                  # guard de Administrador
├── features/members/             # módulo de gestión de miembros
├── features/warehouses/          # invitación con rol y borrado por rol
├── layout/                       # navegación sensible al rol
├── services/                     # rol del warehouse seleccionado y API
└── **/*.spec.ts                  # guards, servicios y componentes
```

**Structure Decision**: Mantener la arquitectura FastAPI + Angular existente, centralizando únicamente el chequeo de Administrador y el estado de rol seleccionado. No se añade un subsistema ACL.

## Design Decisions

1. Persistir roles como cadenas canónicas `administrator`/`contributor`, validadas por schemas y constantes compartidas en backend; evita enums específicos de base de datos.
2. Mantener `require_warehouse_membership` para contenido y añadir `require_warehouse_administrator` para operaciones administrativas.
3. La invitación guarda el rol inmutable que se copia al aceptar. El valor por defecto es `contributor`.
4. El cambio de rol bloquea las membresías del warehouse, cuenta administradores y devuelve `409` si degradaría al último.
5. `created_by` permanece histórico; eliminar depende del rol Administrador y conserva confirmación/bloqueos actuales.
6. La API de warehouses incluye `role`; la lista de miembros incluye identidad y rol. La matriz efectiva es fija y se presenta en el módulo sin edición.
7. Angular revalida el rol al entrar a rutas administrativas y oculta navegación/acciones; un `403` sigue siendo la barrera real ante estado obsoleto.

## Complexity Tracking

No hay violaciones constitucionales ni complejidad adicional que justificar.
