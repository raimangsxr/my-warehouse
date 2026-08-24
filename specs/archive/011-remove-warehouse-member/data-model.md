# Data Model: Eliminar miembro del warehouse

No se añaden tablas, columnas ni migraciones.

## Membership

- Identidad: clave compuesta `(user_id, warehouse_id)`.
- Estado previo requerido: existe y el actor posee otra membresía `administrator` en el mismo warehouse.
- Transición: existente → eliminada.
- Restricción: `target.user_id != actor.user_id`.
- Efecto: las comprobaciones warehouse-scoped dejan de autorizar al usuario objetivo inmediatamente después del commit.

## User.default_warehouse_id

- Si no coincide con el warehouse afectado: permanece sin cambios.
- Si coincide: se establece a `null` dentro de la misma transacción.
- La selección de un nuevo predeterminado se mantiene a cargo del flujo existente de resolución al siguiente acceso.

## ActivityEvent

- `warehouse_id`: warehouse del que se retira la membresía.
- `actor_user_id`: Administrador autenticado.
- `event_type`: `member.removed`.
- `entity_type`: `membership`.
- `entity_id`: identificador del usuario retirado.
- `metadata`: `user_id` y `role` efectivo antes de retirar.

El evento se conserva como historial del warehouse y no depende de que la membresía objetivo siga existiendo.

## Transaction invariants

- Autorización fallida, autoeliminación o miembro inexistente no cambia ninguna entidad.
- Una retirada exitosa elimina exactamente una membresía y crea exactamente un evento.
- Tras el commit no existe una preferencia predeterminada del objetivo que apunte al warehouse retirado.
- La cuenta, favoritos, contenido compartido y eventos históricos no se eliminan.
