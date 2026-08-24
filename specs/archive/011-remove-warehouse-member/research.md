# Research: Eliminar miembro del warehouse

## Operación y respuesta HTTP

**Decision**: Añadir `DELETE /api/warehouses/{warehouse_id}/members/{user_id}` y devolver `200` con un mensaje breve, siguiendo los borrados existentes del producto.

**Rationale**: El recurso eliminado es la membresía identificada por warehouse y usuario. El proyecto ya representa los borrados exitosos con respuestas de mensaje, lo que evita introducir un formato nuevo.

**Alternatives considered**: `204 No Content` era semánticamente válido, pero sería inconsistente con las operaciones destructivas actuales; un `POST /remove` no expresa el recurso afectado.

## Autorización y autoeliminación

**Decision**: Reutilizar la dependencia que exige Administrador y rechazar que `user_id` coincida con el actor mediante `409 Conflict`.

**Rationale**: El backend permanece como autoridad y el conflicto expresa que el actor sí tiene permisos generales, pero la transición concreta está prohibida. Al excluir autoeliminación, siempre queda al menos el Administrador actor incluso cuando el objetivo también es Administrador.

**Alternatives considered**: Permitir abandono habría requerido resolver selección local, navegación y último Administrador para el propio actor; degradar automáticamente al objetivo antes de borrarlo no aporta integridad adicional.

## Consistencia transaccional

**Decision**: Bloquear la membresía objetivo y realizar limpieza del predeterminado, evento de actividad y eliminación en una sola transacción.

**Rationale**: Evita respuestas exitosas con referencias predeterminadas inválidas o sin auditoría. El bloqueo serializa intentos concurrentes sobre el mismo objetivo; el segundo observa ausencia y obtiene `404`.

**Alternatives considered**: Depender solo de la restricción de clave primaria no cubre la transición de borrado ni permite un error de dominio estable; limpiar la preferencia después del commit abriría una ventana inconsistente.

## Confirmación de interfaz

**Decision**: Usar confirmación explícita con la identidad visible del miembro y una acción destructiva por fila; ocultarla para el usuario actual usando el estado de autenticación ya cargado por el shell.

**Rationale**: Mantiene la operación en un máximo de dos acciones, conserva el patrón existente de confirmaciones breves y evita ampliar el contrato de listado solo para marcar la fila propia.

**Alternatives considered**: Un diálogo con escritura del email añade fricción desproporcionada para una membresía recuperable mediante nueva invitación; devolver `is_current_user` duplicaría información que el cliente ya posee.
