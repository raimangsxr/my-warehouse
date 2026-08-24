# Context Pack: Mostrar caja en la lista de lotes

## Active contract

- `specs/contracts/app/contract.md`, sección **IA**, que documenta `/app/batches` y `/app/batches/:batchId`.

## Current code behavior

- `frontend/src/app/items/intake-batches.component.ts` representa cada lote con `batchTitle(batch)`, estado, antigüedad, contadores y acciones, pero no muestra la caja junto al título.
- `frontend/src/app/services/intake.service.ts` ya declara `IntakeBatch.target_box_name`.
- `backend/app/schemas/intake.py` y `backend/app/api/v1/endpoints/intake.py` ya incluyen y rellenan `target_box_name` en las respuestas de lotes.
- `frontend/src/app/items/intake-batches.component.spec.ts` cubre títulos, estados, contadores, creación y recarga, pero no la representación de la caja.

## Scope

- Actualizar primero el contrato activo de la aplicación.
- Mostrar `target_box_name` junto al nombre visible del lote en la lista.
- Mantener un fallback seguro cuando `target_box_name` sea nulo.
- Añadir cobertura frontend enfocada y validar el comportamiento existente.

## Out of scope

- Cambios en API, base de datos o modelos.
- Mostrar la ruta jerárquica completa de la caja.
- Cambios en la vista de detalle del lote o navegación a la caja.
