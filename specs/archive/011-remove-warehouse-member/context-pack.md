# Context Pack: Eliminar miembro del warehouse

## Active contract

- `specs/contracts/app/contract.md`, secciones **Miembros y roles**, **Matriz de permisos por warehouse**, **Data Model** y **API Summary**.

## Current behavior

- El módulo `/app/members` es exclusivo para Administradores y permite listar miembros y cambiar sus roles.
- La API ofrece listado de miembros y cambio de rol, ambos protegidos por el rol Administrador.
- La interfaz no ofrece ninguna acción para retirar una membresía.
- El contrato excluye expresamente la expulsión y el abandono de warehouses.
- La degradación del último Administrador se bloquea para conservar al menos un Administrador.
- El warehouse predeterminado de cada cuenta debe apuntar a una membresía accesible.

## Scope

- Permitir que un Administrador retire a otro miembro del warehouse, tanto Administrador como Contribuidor.
- Confirmar la acción destructiva y actualizar inmediatamente la lista visible tras el éxito.
- Revocar el acceso del miembro retirado y reparar su preferencia de warehouse predeterminado si apuntaba al warehouse afectado.
- Mantener autorización server-side, respuesta coherente ante miembros inexistentes y registro de actividad.
- Cubrir API, servicio cliente e interfaz con pruebas estrechas.

## Out of scope

- Abandonar voluntariamente un warehouse o eliminar la propia membresía.
- Eliminar la cuenta del miembro, su historial o el contenido que creó en el warehouse.
- Revocar invitaciones pendientes.
- Añadir nuevos roles, permisos individuales o transferencias de propiedad.
