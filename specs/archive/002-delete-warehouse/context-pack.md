# Context Pack: 002-delete-warehouse

## Goal

Permitir eliminar permanentemente un almacén (warehouse) con borrado completo de datos y ficheros asociados, dejando el sistema estable.

## Naming

| Concepto | Valor | Notas |
|----------|-------|-------|
| **Change ID** | `002-delete-warehouse` | Carpeta en `specs/changes/` |
| **Git branch** | `001-delete-warehouse` | Primer feature branch del repo; número independiente del change SDD |
| **Archive path** | `specs/archive/002-delete-warehouse/` | Usa ID del change, no del branch |

## Relevant Contract

- `specs/contracts/app/contract.md` — **actualizar en T003 antes de código** (Principle III)
- `specs/changes/002-delete-warehouse/contracts/delete-warehouse-api.md` — borrador incremental del endpoint

## Constitution (v1.0.0)

- **III:** Contrato activo antes de implementar → T003 obligatorio primero
- **V:** `test_delete_warehouse.py` estrecho (9 casos), luego suite completa
- **VI:** Solo creador; confirmación; API `detail` en inglés; UI/snackbars en español; sin paths internos

## Current Understanding

- **No existe** DELETE warehouse hoy.
- Solo el **creador** (`created_by`) puede eliminar; UI oculta acción a otros.
- Acción solo en `/warehouses`; sin red → acción deshabilitada.
- Bloqueo si `intake_batches.status == processing`.
- Borrado atómico: BD + `{media_root}/{warehouse_id}/`; rollback si falla media.
- Co-miembro con sesión en `/app/*`: guard valida selección; si warehouse borrado → limpiar, snackbar español, `/warehouses`.

## Implementation Order

1. T003 — `specs/contracts/app/contract.md`
2. Tests backend (todos, antes de implementación) → servicio + endpoint
3. Frontend — dialog, offline guard, sync purge, warehouse guard
4. Validación amplia + cierre SDD (archive, manifest)

## Files / Areas Likely Involved

```
specs/contracts/app/contract.md                 # T003 — FIRST
backend/app/services/warehouse_delete.py
backend/app/api/v1/endpoints/warehouses.py
backend/app/schemas/warehouse.py
backend/tests/test_delete_warehouse.py
frontend/src/app/warehouses/warehouses.component.ts
frontend/src/app/services/warehouse.service.ts
frontend/src/app/services/sync.service.ts
frontend/src/app/core/warehouse.guard.ts        # NEW — co-miembro / warehouse borrado
```

## Do Not Read (unless justified)

- `specs.md` (raíz) — deprecado
- `specs/archive/**` — salvo baseline histórico
- Otros changes inactivos

## Validation Plan

```bash
cd backend && uv run pytest tests/test_delete_warehouse.py -q
cd backend && uv run pytest -q
cd frontend && npm run build
```

## Plan

[plan.md](./plan.md) | [quickstart.md](./quickstart.md) | [research.md](./research.md) | [tasks.md](./tasks.md)
