# API Contract: Delete Warehouse

**Change:** 002-delete-warehouse  
**Base path:** `/api/v1`  
**Date:** 2026-07-06

### Language policy

- API `detail` strings: **English** (matches existing endpoints in `backend/app/api/`).
- User-visible copy in the PWA: **Spanish** — the frontend maps HTTP status/`detail` to localized snackbar messages where shown.

## DELETE /warehouses/{warehouse_id}

Elimina permanentemente un almacén y todo su contenido.

### Authorization

- Bearer JWT requerido.
- Usuario debe ser miembro del warehouse.
- Usuario debe ser `created_by` del warehouse.

### Request

**Path parameters:**

| Name | Type | Description |
|------|------|-------------|
| `warehouse_id` | uuid string | ID del almacén |

**Body (JSON):**

```json
{
  "confirm_name": "Garaje principal"
}
```

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `confirm_name` | string | yes | Debe coincidir exactamente con `warehouse.name` |

### Responses

#### 200 OK

```json
{
  "message": "Warehouse deleted"
}
```

#### 400 Bad Request

- `confirm_name` no coincide con el nombre del almacén.
- Body inválido o ausente.

```json
{
  "detail": "Confirmation name does not match warehouse name"
}
```

#### 403 Forbidden

Usuario miembro pero no creador.

```json
{
  "detail": "Only the warehouse creator can delete this warehouse"
}
```

#### 404 Not Found

Warehouse inexistente o usuario no miembro.

```json
{
  "detail": "Warehouse not found"
}
```

#### 409 Conflict

Existe al menos un lote de intake con `status=processing`.

```json
{
  "detail": "Cannot delete warehouse while intake batches are processing"
}
```

#### 500 Internal Server Error

Fallo al borrar media o error de transacción; el warehouse permanece intacto.

```json
{
  "detail": "Warehouse deletion failed"
}
```

### Side effects (success)

1. Todas las filas relacionadas eliminadas (ver `data-model.md`).
2. Directorio `{media_root}/{warehouse_id}/` eliminado.
3. Log INFO: `warehouse_id`, `name`, `actor_user_id`, timestamp.

### Idempotency

- Segunda llamada tras borrado exitoso → **404**.

## GET /warehouses (sin cambio de contrato)

`WarehouseResponse` ya incluye `created_by` — el frontend lo usa para mostrar/ocultar la acción eliminar.

## GET /auth/me (sin cambio)

El frontend usa `id` del usuario actual para comparar con `created_by`.
