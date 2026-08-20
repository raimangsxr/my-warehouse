# HTTP API Contract Delta: Warehouse roles

Base: `/api/v1` (se conserva el prefijo real del router).

## Tipos

`WarehouseRole = "administrator" | "contributor"`

## Warehouses

Las respuestas de listado, creación y detalle de warehouse añaden:

```json
{ "role": "administrator" }
```

El rol corresponde al usuario autenticado en ese warehouse.

## Invitations

`POST /warehouses/{warehouse_id}/invites` requiere Administrador.

Request:

```json
{ "email": "persona@example.com", "role": "contributor", "expires_in_hours": 72 }
```

`role` es opcional y su default es `contributor`. La respuesta incluye el mismo rol. La aceptación copia este valor a la membresía y no acepta un rol en su request.

## Members

`GET /warehouses/{warehouse_id}/members` requiere Administrador y devuelve identidad básica, timestamps y rol de cada miembro.

`PATCH /warehouses/{warehouse_id}/members/{user_id}` requiere Administrador.

Request:

```json
{ "role": "administrator" }
```

Responses:

- `200`: miembro actualizado con rol efectivo.
- `403`: el actor no es Administrador de ese warehouse.
- `404`: warehouse o miembro no visible dentro del alcance autorizado.
- `409`: la transición dejaría el warehouse sin Administradores.
- `422`: rol fuera del conjunto permitido.

## Administrative authorization

Requieren rol Administrador en el warehouse objetivo:

- crear invitaciones;
- listar miembros y cambiar roles;
- eliminar warehouse;
- todos los endpoints warehouse-scoped de Settings, SMTP y LLM;
- sync push/pull/resolve;
- export e import.

Un miembro Contribuidor recibe `403` con un detalle genérico de rol requerido y ningún cambio parcial.

## Operational authorization

Los endpoints actuales de cajas, artículos, stock, fotos, tags, favoritos, papelera, lotes, búsqueda, actividad y QR continúan requiriendo membresía y aceptan ambos roles.

## Deletion

`DELETE /warehouses/{warehouse_id}` ya no depende de `created_by`: cualquier Administrador puede ejecutarlo. Se conservan la confirmación por nombre y los bloqueos por lotes en proceso o media no eliminable.
