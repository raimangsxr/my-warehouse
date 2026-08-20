# Change 007 — Roles de usuario por warehouse

## Summary

Introducir roles Administrador y Contribuidor en cada membresía de warehouse, aplicar autorización backend por operación y adaptar la UI a los permisos del warehouse seleccionado.

## Known Product Direction

- Administrador: control total equivalente al comportamiento actual.
- Contribuidor: gestión operativa de inventario y lotes.
- Contribuidor no puede cambiar configuración protegida, borrar warehouses ni invitar personas.

## Clarified Additions

- Debe existir un módulo exclusivo para Administradores que permita consultar miembros y cambiar roles después de aceptar la invitación.
- En la migración, el creador queda como Administrador y el resto de miembros existentes como Contribuidores.
- Las invitaciones permiten elegir rol y usan Contribuidor por defecto.
- Los permisos son fijos por rol; no existen overrides individuales ni roles configurables.
- Settings queda completamente reservado a Administradores; Contribuidores no acceden a ninguna de sus funciones.
- Cualquier Administrador puede eliminar el warehouse; `created_by` queda como dato histórico.

## Governing Contract

- `specs/contracts/app/contract.md`

## Likely Impact Areas

- Modelo y migración de `memberships` y `warehouse_invites`.
- Dependencias de autorización FastAPI y endpoints administrativos.
- Respuestas de warehouses/miembros/invitaciones.
- Estado de warehouse seleccionado, guards, navegación y visibilidad de Settings/invitaciones/eliminación.
- Tests backend/frontend y contrato activo.
