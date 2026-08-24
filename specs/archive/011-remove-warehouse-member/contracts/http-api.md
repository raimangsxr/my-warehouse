# HTTP API Contract Delta: Eliminar miembro del warehouse

Base real: `/api`.

## Retirar membresía

`DELETE /warehouses/{warehouse_id}/members/{user_id}`

No tiene body. Requiere autenticación y rol `administrator` en el warehouse objetivo.

### Success response

`200 OK`

```json
{
  "message": "Member removed"
}
```

Al completarse:

- la membresía objetivo deja de existir;
- si el warehouse era el predeterminado del objetivo, esa preferencia queda vacía;
- se registra un evento `member.removed` con el actor, el objetivo y su rol anterior;
- cuenta, contenido e historial permanecen intactos.

### Error responses

- `403 Forbidden`, `Administrator role required`: el actor no es Administrador del warehouse.
- `404 Not Found`, `Member not found`: el objetivo no pertenece al warehouse o una retirada concurrente ya terminó.
- `409 Conflict`, `Administrators cannot remove themselves`: actor y objetivo son la misma cuenta.

Todos los errores dejan membresías, preferencias y actividad sin cambios parciales.

## Existing member operations

`GET /warehouses/{warehouse_id}/members` y `PATCH /warehouses/{warehouse_id}/members/{user_id}` conservan sus contratos actuales. La retirada no cambia roles antes de eliminar la membresía y acepta ambos roles como objetivo.
