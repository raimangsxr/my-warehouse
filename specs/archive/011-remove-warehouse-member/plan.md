# Implementation Plan: Eliminar miembro del warehouse

**Branch**: `005-remove-warehouse-member` | **Date**: 2026-08-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/changes/011-remove-warehouse-member/spec.md`

## Summary

Añadir una operación administrativa para retirar la membresía de otro usuario sin importar su rol. El backend incorporará un `DELETE` warehouse-scoped, autorizará al actor, impedirá autoeliminación, bloqueará la membresía objetivo, limpiará su warehouse predeterminado y registrará la actividad en una sola transacción. Angular añadirá el método de servicio y una acción confirmada por fila que se oculta para el usuario actual y actualiza la lista tras el éxito.

## Technical Context

**Language/Version**: Python 3.11+, TypeScript 5.8

**Primary Dependencies**: FastAPI 0.116+, SQLAlchemy 2.x, Angular 20, Angular Material 20, RxJS 7.8

**Storage**: PostgreSQL en producción y SQLite en desarrollo/tests; no requiere migración

**Testing**: pytest 8, Vitest 3 mediante Angular test builder

**Target Platform**: API Linux y aplicación web responsive/PWA

**Project Type**: Aplicación web con backend FastAPI y frontend Angular

**Performance Goals**: Una transacción y un número constante de consultas por retirada; actualización inmediata de la fila sin recargar la página

**Constraints**: Autorización server-side; operación online; confirmación explícita; sin borrado de cuenta, contenido o historial; mensajes UI en español

**Scale/Scope**: Un endpoint, un método de servicio, un componente existente y sus pruebas estrechas

## Constitution Check

| Principle | Result | Rationale |
|-----------|--------|-----------|
| I. Code / contracts | PASS | El delta contractual documenta el cambio y el contrato activo se actualizará antes del producto. |
| II. Manifest-driven | PASS | Manifiesto y context pack apuntan al cambio 011. |
| III. Contract before impl | PASS | La actualización de `specs/contracts/app/contract.md` será la primera fase de tareas. |
| IV. Incremental changes | PASS | Todos los artefactos viven bajo `specs/changes/011-remove-warehouse-member/`. |
| V. Tests | PASS | Se planifican pruebas de integración API, servicio y componente, seguidas por suites amplias. |
| VI. Security | PASS | La autorización es server-side, la autoeliminación se rechaza y la UI exige confirmación. |
| VII. Simplicity | PASS | Se reutilizan membresía, actividad, usuario actual y patrones de confirmación existentes. |

**Post-design re-check**: PASS. El contrato HTTP, el modelo y el quickstart conservan el alcance sin migración ni nueva abstracción.

## Project Structure

### Documentation (this feature)

```text
specs/changes/011-remove-warehouse-member/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/http-api.md
└── tasks.md
```

### Source Code (repository root)

```text
backend/
├── app/api/v1/endpoints/warehouses.py
└── tests/test_warehouse_roles.py

frontend/
└── src/app/
    ├── members/
    │   ├── members.component.ts
    │   └── members.component.spec.ts
    └── services/
        ├── warehouse.service.ts
        └── warehouse.service.spec.ts

specs/contracts/app/contract.md
```

**Structure Decision**: Extender los endpoints, servicio y componente existentes. No se crea servicio backend, diálogo dedicado ni migración porque la operación es una mutación transaccional pequeña sobre entidades ya modeladas y la confirmación nativa ya es patrón vigente para borrados acotados.

## Implementation Design

1. Actualizar el contrato activo y el delta HTTP con autorización, autoeliminación, estados y efectos de datos.
2. Añadir `DELETE /api/warehouses/{warehouse_id}/members/{user_id}` con respuesta de mensaje.
3. Exigir Administrador mediante la dependencia existente y comparar `user_id` con el usuario autenticado antes de mutar.
4. Seleccionar y bloquear la membresía objetivo; devolver `404` si no existe y `409` para autoeliminación, sin cambios parciales.
5. En la misma transacción, anular `default_warehouse_id` del usuario objetivo cuando coincida, registrar `member.removed` y eliminar la membresía.
6. Añadir al servicio Angular la llamada `DELETE` y usar `AuthService.currentUser` para no mostrar la acción en la fila propia.
7. Confirmar con identidad visible, bloquear la fila durante la petición, retirar la fila y su rol pendiente tras éxito, y traducir fallos previsibles.
8. Cubrir ambos roles objetivo, autorización, autoeliminación, inexistencia, preferencia, actividad, confirmación/cancelación y actualización de UI.

## Complexity Tracking

No hay violaciones que justificar.
