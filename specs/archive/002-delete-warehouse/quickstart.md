# Quickstart: 002-delete-warehouse

**Orden alineado con constitución v1.0.0** — contrato activo **antes** de código (Principle III).

## Prerequisites

```bash
cd backend && uv sync
cd frontend && npm install
```

## Implementación

### 0. Contrato activo (OBLIGATORIO — antes de código)

Actualizar `specs/contracts/app/contract.md`:

- Flujo warehouse: eliminación por creador desde `/warehouses`
- API: `DELETE /warehouses/{warehouse_id}` con `confirm_name`
- Permisos, 403/409, limpieza media, sync cliente
- Feature matrix: eliminar warehouse ✅

Referencia incremental: [contracts/delete-warehouse-api.md](./contracts/delete-warehouse-api.md)

### 1. Backend — servicio de borrado

`backend/app/services/warehouse_delete.py`:

- `assert_can_delete_warehouse(db, warehouse_id, user_id, confirm_name) -> Warehouse`
- `delete_warehouse(db, warehouse, actor_user_id) -> None`
- Orden: validar processing → DELETE tablas sync/stock/favorites → boxes/items/... → media → commit

### 2. Backend — endpoint

`backend/app/api/v1/endpoints/warehouses.py`:

- `DELETE /{warehouse_id}` + `WarehouseDeleteRequest`
- `logger.info` auditoría (FR-010); API `detail` en inglés; snackbars UI en español sin paths internos

### 3. Backend — tests (estrecho primero)

`backend/tests/test_delete_warehouse.py`:

| Test | Verifica |
|------|----------|
| `test_creator_can_delete_warehouse` | 200, no listado, media ausente, **otros warehouses del usuario intactos** (FR-009) |
| `test_non_creator_forbidden` | 403 |
| `test_wrong_confirm_name` | 400 |
| `test_blocked_while_batch_processing` | 409 |
| `test_delete_removes_all_related_data` | sync, settings, boxes, items |
| `test_co_member_loses_access` | segundo usuario no ve warehouse |
| `test_delete_rollback_on_media_failure` | FR-008: fallo media → warehouse intacto |
| `test_delete_idempotent_404` | segundo DELETE → 404 |

```bash
cd backend && uv run pytest tests/test_delete_warehouse.py -q
```

### 4. Frontend — servicio + UI

- `warehouse.service.ts` → `delete(warehouseId, confirmName)`
- `warehouses.component.ts` → botón solo si `created_by === me.id`, `MatDialog` confirmación, **deshabilitar sin red**
- Copy UI en **español**; mapear errores API a snackbars en español

### 5. Frontend — estado cliente

- Limpiar `mw_selected_warehouse_id` si coincide
- `sync.service.purgeWarehouse(warehouseId)`
- `warehouse.guard.ts` en rutas `/app/*`: si selección no está en `list()` → limpiar, snackbar «Este almacén ya no está disponible», redirect `/warehouses` (US3 escenario co-miembro)

### 6. Validación amplia

```bash
cd backend && uv run pytest -q
cd frontend && npm run build
```

### 7. Cierre SDD (al completar feature)

- Verificar contrato `app` alineado con código
- Mover `specs/changes/002-delete-warehouse/` → `specs/archive/`
- `specs/manifest.yml` → `status: completed`

## Manual smoke test

1. Login como creador → warehouse con cajas/items/foto.
2. (Opcional) Segundo miembro — no debe ver botón eliminar.
3. Eliminar con nombre exacto desde `/warehouses`.
4. Verificar lista, media ausente, co-miembro sin acceso.
5. Con lote `processing` activo → 409 / mensaje bloqueo.
6. (Opcional) Medir tiempo de delete típico — objetivo <30s; no es gate CI.
7. Co-miembro en `/app/home` cuando creador elimina → guard redirige a `/warehouses` con mensaje.

## Branch vs Change

| | ID |
|--|-----|
| Git branch | `001-delete-warehouse` |
| SDD change | `002-delete-warehouse` |
