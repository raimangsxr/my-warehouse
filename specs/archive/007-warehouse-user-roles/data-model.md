# Data Model: Roles de usuario por warehouse

## WarehouseRole

Valores canónicos:

- `administrator`: acceso operativo y administrativo completo.
- `contributor`: acceso operativo sin administración.

No existe rol global ni permisos por usuario.

## Membership

Campos existentes: `user_id`, `warehouse_id`, timestamps.

Campo nuevo:

| Campo | Tipo | Nulo | Regla |
|-------|------|------|-------|
| `role` | string | No | `administrator` o `contributor` |

Invariantes:

- La PK compuesta mantiene una sola membresía por usuario/warehouse.
- Todo warehouse existente con membresías debe conservar al menos una con rol `administrator`.
- Crear warehouse crea la membresía del creador como `administrator`.
- Cambiar rol no modifica `warehouses.created_by`.

## WarehouseInvite

Campo nuevo:

| Campo | Tipo | Nulo | Default | Regla |
|-------|------|------|---------|-------|
| `role` | string | No | `contributor` | rol que recibirá la membresía al aceptar |

El destinatario no envía ni puede modificar el rol durante aceptación.

## Migración

1. Añadir `memberships.role` de forma compatible con filas existentes.
2. Asignar `administrator` cuando la membresía corresponde a `warehouses.created_by`.
3. Asignar `contributor` a las demás membresías.
4. Hacer la columna no nula y establecer un default seguro para inserciones legacy durante despliegue.
5. Añadir `warehouse_invites.role` no nulo con default `contributor`; invitaciones pendientes existentes quedan como Contribuidor.
6. El downgrade elimina ambas columnas.

## Transiciones

```text
contributor ──(admin asigna)──> administrator
administrator ──(admin asigna y quedan otros admins)──> contributor
```

Una transición al mismo rol es idempotente. Una degradación del último Administrador devuelve conflicto y no persiste cambios.
