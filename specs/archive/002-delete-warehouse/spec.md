# Feature Specification: Eliminar almacén (warehouse)

**Feature Branch**: `001-delete-warehouse` (git — primer feature numerado en branch)

**Change ID**: `002-delete-warehouse` (carpeta SDD en `specs/changes/`; el número de change no coincide con el prefijo del branch)

**Created**: 2026-07-06

**Status**: Draft

**Input**: User description: "quiero crear una nueva feature que me permita eliminar almacenes que ya no quiero conservar. Al eliminar un almacén deben borrarse todos los elementos y ficheros relacionados, es crucial borrar todos los restos y dejar todo limpio y estable."

## Clarifications

### Session 2026-07-06

- Q: ¿Quién puede iniciar la eliminación permanente de un almacén? → A: Solo el usuario que creó el almacén (`created_by`).
- Q: ¿Cómo debe comportarse la UI para miembros que no son el creador? → A: No mostrar la acción de eliminar (ni botón ni menú).
- Q: ¿Qué hacer si hay un lote de captura masiva en procesamiento activo? → A: Bloquear la eliminación hasta que no queden lotes en procesamiento.
- Q: Tras eliminar el almacén, ¿dónde debe quedar la auditoría? → A: Solo en registros del servidor (logs), no en la base de datos de la app.
- Q: ¿Desde qué pantalla puede el creador iniciar la eliminación? → A: Solo en la lista de almacenes (`/warehouses`).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Eliminar un almacén que ya no necesito (Priority: P1)

Como creador de un almacén, quiero poder eliminarlo de forma permanente cuando ya no lo uso, para no acumular espacios de trabajo obsoletos ni datos que ya no me interesan.

**Why this priority**: Es el valor central de la feature: dar de baja un almacén completo con garantía de que desaparece del sistema.

**Independent Test**: Se puede probar creando un almacén con cajas, artículos y fotos, eliminándolo con confirmación, y verificando que ya no aparece en la lista ni es accesible para ningún miembro.

**Acceptance Scenarios**:

1. **Given** el creador de un almacén con inventario (cajas, artículos, fotos, lotes, configuración), **When** confirma la eliminación del almacén, **Then** el almacén deja de existir para todos los miembros y no queda inventario asociado consultable.
2. **Given** un almacén eliminado, **When** cualquier miembro anterior intenta abrirlo o seleccionarlo, **Then** el sistema indica que el almacén no existe o no está disponible.
3. **Given** un almacén con archivos de imagen asociados (fotos de artículos, borradores de lotes), **When** se elimina el almacén, **Then** esos archivos dejan de estar disponibles y no quedan restos accesibles del almacén eliminado.

---

### User Story 2 - Confirmación explícita antes de borrar (Priority: P1)

Como usuario, quiero un paso de confirmación claro y difícil de ejecutar por error, porque la eliminación es irreversible y afecta a todo el contenido del almacén.

**Why this priority**: Sin salvaguardas, un clic accidental destruiría datos valiosos; la confirmación es requisito de seguridad de producto al mismo nivel que la eliminación en sí.

**Independent Test**: Se puede probar intentando eliminar sin completar la confirmación (debe bloquearse) y completándola correctamente (debe proceder).

**Acceptance Scenarios**:

1. **Given** un usuario en la lista de almacenes (`/warehouses`), **When** inicia la eliminación de un almacén del que es creador, **Then** el sistema muestra una advertencia visible de que la acción es permanente e irreversible.
2. **Given** el diálogo de confirmación abierto, **When** el usuario no escribe el nombre exacto del almacén, **Then** el botón de confirmar permanece deshabilitado o la acción se rechaza.
3. **Given** el diálogo de confirmación abierto, **When** el usuario escribe el nombre exacto del almacén y confirma, **Then** el sistema ejecuta la eliminación.

---

### User Story 3 - Comportamiento estable tras la eliminación (Priority: P2)

Como usuario que trabaja a diario en la aplicación, quiero que, tras borrar un almacén, la aplicación me deje en un estado coherente (sin pantallas rotas, sin referencias al almacén borrado).

**Why this priority**: La limpieza de datos no basta si la experiencia queda inconsistente; la estabilidad percibida es parte del requisito de "dejar todo limpio".

**Independent Test**: Se puede probar eliminando el almacén actualmente seleccionado o el único almacén del usuario y verificando redirección y mensajes correctos.

**Acceptance Scenarios**:

1. **Given** un usuario con el almacén eliminado seleccionado como activo, **When** la eliminación termina con éxito, **Then** el sistema le lleva a la lista de almacenes (o equivalente) y limpia la selección del almacén borrado.
2. **Given** un usuario que elimina su único almacén, **When** la operación termina, **Then** ve la lista vacía con opción clara de crear un almacén nuevo, sin errores de navegación.
3. **Given** otro miembro del mismo almacén con la sesión abierta, **When** el almacén es eliminado, **Then** en su próximo acceso al almacén el sistema le informa de que ya no está disponible y puede elegir otro almacén si tiene.

---

### User Story 4 - Eliminación completa para todos los miembros (Priority: P2)

Como creador de un almacén compartido, quiero que al eliminarlo desaparezca también para el resto de miembros, para que no queden datos huérfanos ni accesos residuales.

**Why this priority**: El producto es multiusuario sin roles; la eliminación debe ser global al almacén, no solo una "baja" local del usuario.

**Nota**: Complementa US1 con foco en co-miembros y acceso residual; la eliminación global ya está cubierta por US1 a nivel de API.

**Independent Test**: Dos usuarios miembros del mismo almacén; uno elimina; el otro ya no puede listarlo ni acceder.

**Acceptance Scenarios**:

1. **Given** un almacén con varios miembros, **When** el creador confirma la eliminación, **Then** el almacén desaparece de la lista de todos los miembros.
2. **Given** invitaciones pendientes o actividad histórica del almacén, **When** se elimina el almacén, **Then** esa información deja de estar asociada a un almacén activo (sin restos consultables del espacio eliminado).

---

### Edge Cases

- ¿Qué pasa si la eliminación falla a medias (p. ej. datos borrados pero quedan archivos)? El sistema debe informar del error, no marcar el almacén como eliminado, y permitir reintentar o contactar soporte; no debe quedar un estado inconsistente silencioso.
- ¿Qué pasa si hay lotes en procesamiento activo? La eliminación queda bloqueada hasta que finalicen o el creador los resuelva; se informa con mensaje claro.
- ¿Qué pasa si otro usuario está editando contenido del almacén durante la eliminación? La eliminación debe completarse de forma atómica desde la perspectiva del usuario que confirma, o fallar sin dejar datos parciales expuestos.
- ¿Qué pasa si el usuario cancela el diálogo de confirmación? No se elimina nada; el almacén permanece intacto.
- ¿Qué pasa con acciones en cola offline vinculadas al almacén eliminado? Deben descartarse o invalidarse en el dispositivo para no sincronizar comandos obsoletos.
- ¿Qué pasa si el nombre del almacén tiene espacios o mayúsculas distintas? La confirmación por nombre debe ser estricta (coincidencia exacta con el nombre mostrado).
- ¿Qué pasa si un miembro que no es el creador intenta eliminar el almacén? La acción de eliminar no se muestra en la interfaz; si se intenta por otro medio, el sistema rechaza con permiso denegado.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE permitir **solo al creador del almacén** (`created_by`) iniciar su eliminación permanente **desde la lista de almacenes** (`/warehouses`).
- **FR-001a**: Si un usuario miembro no creador intenta eliminar el almacén (p. ej. vía API), el sistema DEBE rechazar la operación con un mensaje claro de permiso denegado.
- **FR-001b**: La interfaz de gestión de almacenes (`/warehouses`) NO DEBE mostrar la acción de eliminar (botón, menú ni equivalente) a usuarios que no sean el creador del almacén.
- **FR-001c**: La acción de eliminar NO DEBE estar disponible en Configuración ni en otras pantallas dentro del almacén (`/app/*`); solo en `/warehouses`.
- **FR-002**: El sistema DEBE exigir confirmación explícita escribiendo el nombre exacto del almacén antes de ejecutar la eliminación.
- **FR-003**: El sistema DEBE advertir claramente que la eliminación es irreversible y que se perderán cajas, artículos, fotos, lotes, configuración y historial asociados.
- **FR-004**: Al eliminar un almacén, el sistema DEBE eliminar todo el contenido lógico asociado: estructura de cajas, artículos, stock, favoritos, invitaciones, actividad, configuración del almacén (correo/IA), lotes de captura y registros de sincronización vinculados a ese almacén.
- **FR-005**: Al eliminar un almacén, el sistema DEBE eliminar todos los archivos de imagen y medios almacenados para ese almacén, incluyendo fotos temporales de lotes.
- **FR-006**: Tras una eliminación exitosa, el almacén NO DEBE aparecer en la lista de almacenes de ningún miembro.
- **FR-007**: Si el almacén eliminado era el seleccionado en el dispositivo del usuario, el sistema DEBE limpiar esa selección y redirigir a un estado válido (lista de almacenes).
- **FR-008**: Si la eliminación no puede completarse, el sistema DEBE mostrar un error comprensible y el almacén DEBE permanecer accesible hasta que la operación tenga éxito.
- **FR-009**: La eliminación de un almacén NO DEBE eliminar la cuenta de usuario ni otros almacenes de los que el usuario sea miembro.
- **FR-010**: El sistema DEBE registrar la eliminación del almacén (quién y cuándo) en **registros del servidor** (logs operativos); no se persiste en la base de datos de la aplicación ni se muestra al usuario final en v1.
- **FR-011**: Si el almacén tiene lotes de captura masiva en estado de procesamiento activo, el sistema DEBE bloquear la eliminación hasta que no queden lotes en ese estado, mostrando un mensaje claro al creador.

### Key Entities

- **Almacén (warehouse)**: Espacio de trabajo compartido que agrupa todo el inventario y configuración; es la unidad que se elimina.
- **Miembro**: Usuario con acceso al almacén; pierde el acceso cuando el almacén se elimina.
- **Contenido del almacén**: Cajas, artículos, movimientos de stock, favoritos, invitaciones, eventos de actividad, lotes y borradores, ajustes de correo e IA.
- **Medios del almacén**: Fotos y archivos asociados al inventario y a procesos de captura masiva.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un usuario puede eliminar un almacén con inventario completo en un flujo de confirmación de menos de 2 minutos (desde iniciar eliminación hasta ver la lista actualizada).
- **SC-002**: En el 100% de eliminaciones exitosas verificadas en prueba, el almacén eliminado no es recuperable ni listable por ningún miembro anterior.
- **SC-003**: En el 100% de eliminaciones exitosas verificadas en prueba, no quedan medios del almacén accesibles tras la operación (muestra representativa de fotos de artículos y lotes).
- **SC-004**: Tras eliminar el almacén activo, el 100% de usuarios de prueba llegan a la lista de almacenes sin pantallas de error ni referencias al almacén borrado.
- **SC-005**: El 0% de eliminaciones canceladas o con confirmación incorrecta producen cambios en los datos del almacén.

## Assumptions

- Solo el creador del almacén puede eliminarlo; el resto de miembros conservan acceso normal pero sin capacidad de borrado del espacio completo.
- La eliminación solo se inicia desde `/warehouses`; no hay acceso desde Settings ni otras vistas del almacén.
- La eliminación es **permanente** (hard delete); no hay papelera ni restauración del almacén en esta feature.
- Se requiere conexión a red para eliminar; no se soporta eliminación offline en v1.
- La confirmación por nombre exacto es suficiente como salvaguarda; no se exige contraseña adicional en v1.
- Los demás miembros no reciben notificación por correo de la eliminación en v1 (pueden descubrirlo al no ver el almacén en su lista).
- La cuenta de usuario y sus otros almacenes permanecen intactos.
- La auditoría de eliminación queda solo en logs del servidor; no se conservan eventos en base de datos tras borrar el almacén.
- Si falla el borrado de archivos, la operación completa se considera fallida y el almacén sigue existiendo hasta resolver el error.

## Out of Scope

- Restaurar un almacén eliminado.
- Eliminar solo a un miembro del almacén (expulsión) sin borrar el almacén.
- Transferir la propiedad del almacén a otro usuario antes de borrar.
- Archivar o “ocultar” almacenes en lugar de eliminarlos.
- Notificaciones por email a co-miembros cuando alguien elimina el almacén.
