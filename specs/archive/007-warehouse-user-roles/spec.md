# Feature Specification: Roles de usuario por warehouse

**Feature Branch**: `codex/007-warehouse-user-roles`

**Created**: 2026-08-20

**Status**: Ready for planning

**Input**: Añadir roles Administrador y Contribuidor por warehouse. El Administrador mantiene control total; el Contribuidor gestiona inventario y lotes, pero no puede administrar configuración, borrar el warehouse ni invitar personas.

## Clarifications

### Session 2026-08-20

- Q: ¿Debe existir gestión posterior a la invitación? → A: Sí. Los Administradores necesitan un módulo de gestión de miembros, roles y permisos para modificar asignaciones a posteriori.
- Q: ¿Qué roles reciben las membresías existentes? → A: El creador del warehouse pasa a Administrador y los demás miembros existentes pasan a Contribuidor.
- Q: ¿Cómo se asigna el rol en una nueva invitación? → A: El Administrador elige Administrador o Contribuidor y el valor por defecto es Contribuidor.
- Q: ¿Los permisos pueden personalizarse por usuario o por rol? → A: No. Los permisos son fijos para Administrador y Contribuidor; el módulo los muestra y permite cambiar el rol asignado.
- Q: ¿Qué partes de Settings puede usar un Contribuidor? → A: Ninguna. Settings y todas sus funciones quedan reservadas a Administradores del warehouse seleccionado.
- Q: ¿Quién puede borrar un warehouse? → A: Cualquier Administrador del warehouse, manteniendo las confirmaciones y bloqueos existentes.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Administrar un warehouse con control total (Priority: P1)

Como administrador de un warehouse, quiero mantener todas las capacidades actuales y gestionar quién colabora para poder gobernar el espacio compartido.

**Why this priority**: El nuevo modelo no debe retirar capacidades legítimas a quienes administran cada warehouse y debe asegurar que las acciones sensibles tengan un responsable.

**Independent Test**: Un administrador puede gestionar contenido, configuración, invitaciones y eliminación del warehouse; una cuenta sin ese rol recibe denegación tanto en interfaz como en peticiones directas.

**Acceptance Scenarios**:

1. **Given** un usuario que crea un warehouse, **When** termina la creación, **Then** queda registrado como Administrador de ese warehouse.
2. **Given** un Administrador, **When** gestiona cajas, artículos, lotes, configuración, invitaciones o eliminación, **Then** conserva todas las capacidades actuales.
3. **Given** un Administrador de un warehouse, **When** accede a otro warehouse donde es Contribuidor, **Then** sus permisos se ajustan al rol de ese segundo warehouse.

---

### User Story 2 - Colaborar sin acceso administrativo (Priority: P1)

Como Contribuidor, quiero gestionar el inventario cotidiano del warehouse al que fui invitado sin poder modificar decisiones administrativas o sensibles.

**Why this priority**: Permite colaboración operativa con menor riesgo sobre configuración, acceso de terceros y eliminación del espacio.

**Independent Test**: Un Contribuidor puede completar flujos de inventario y lotes, pero no puede ejecutar ninguna operación administrativa aunque llame directamente al backend.

**Acceptance Scenarios**:

1. **Given** un Contribuidor, **When** crea o gestiona cajas, artículos, stock, fotos, tags, favoritos, papelera y lotes, **Then** la operación se permite dentro de su warehouse.
2. **Given** un Contribuidor, **When** intenta invitar personas, cambiar configuración protegida, administrar miembros o borrar el warehouse, **Then** la acción no se ofrece en la UI y el backend responde acceso denegado.
3. **Given** un Contribuidor, **When** consulta actividad, busca, usa QR o resuelve trabajo operativo, **Then** mantiene acceso de lectura y gestión necesario.
4. **Given** un usuario que es Administrador en un warehouse y Contribuidor en otro, **When** cambia de warehouse, **Then** la UI actualiza inmediatamente las acciones disponibles sin reutilizar permisos del anterior.

---

### User Story 3 - Asignar y mantener roles (Priority: P1)

Como Administrador, quiero asignar el nivel apropiado a cada miembro para controlar quién puede gobernar y quién solo colabora.

**Why this priority**: Sin un mecanismo explícito de asignación y mantenimiento, los dos roles no pueden operarse de forma segura a lo largo del tiempo.

**Independent Test**: Se invita o actualiza un miembro con cada rol permitido y se verifica que sus permisos cambian únicamente en ese warehouse, sin dejarlo sin administradores.

**Acceptance Scenarios**:

1. **Given** un Administrador que invita a una persona, **When** crea la invitación, **Then** elige Administrador o Contribuidor, con Contribuidor seleccionado por defecto, y el rol queda visible antes de enviar el enlace.
2. **Given** miembros existentes, **When** se despliega la migración de roles, **Then** el creador de cada warehouse recibe Administrador y todas las demás membresías reciben Contribuidor.
3. **Given** un Administrador, **When** abre el módulo de gestión de miembros, **Then** puede listar miembros, consultar sus roles y permisos derivados, y cambiar su rol después de aceptar la invitación.
4. **Given** un warehouse con un único Administrador, **When** una operación intentaría dejarlo sin administradores, **Then** se rechaza y se explica que debe existir al menos uno.

### Edge Cases

- Un usuario tiene roles distintos en warehouses distintos.
- Dos administradores intentan cambiar el mismo rol de forma concurrente.
- Una invitación se crea con un rol y se acepta después de que el invitador pierda privilegios.
- Un miembro intenta promoverse, cambiar su rol o acceder a endpoints administrativos directamente.
- El único administrador intenta salir, expulsarse, degradarse o borrar su cuenta.
- Un Contribuidor conserva abierta una pantalla administrativa cuando su rol cambia.
- Operaciones offline se crearon antes de una degradación de rol y se sincronizan después.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Cada membresía MUST tener exactamente un rol por warehouse: `Administrador` o `Contribuidor`.
- **FR-002**: El creador de un warehouse MUST convertirse automáticamente en Administrador.
- **FR-003**: Los permisos MUST evaluarse por la membresía del warehouse objetivo, nunca como rol global del usuario.
- **FR-004**: Un Administrador MUST conservar control total sobre contenido, configuración, invitaciones, miembros y eliminación del warehouse.
- **FR-005**: Un Contribuidor MUST poder crear, editar, mover, restaurar y eliminar contenido operativo, incluyendo cajas, artículos, stock, fotos, tags y lotes.
- **FR-006**: Un Contribuidor MUST NOT poder crear invitaciones, administrar miembros/roles, cambiar configuración protegida ni eliminar el warehouse.
- **FR-007**: Las restricciones MUST aplicarse en backend a todas las operaciones protegidas aunque se invoquen sin usar la UI.
- **FR-008**: La UI MUST ocultar o deshabilitar acciones administrativas según el rol del warehouse seleccionado y MUST actualizarse al cambiar de warehouse o de rol.
- **FR-009**: La API que lista warehouses y miembros MUST exponer el rol relevante para que el cliente represente permisos correctamente.
- **FR-010**: La aceptación de una invitación MUST crear la membresía con el rol fijado en la invitación, sin permitir que el invitado lo altere.
- **FR-011**: Solo un Administrador MUST poder asignar o modificar roles.
- **FR-012**: El sistema MUST impedir cualquier transición que deje un warehouse existente sin al menos un Administrador.
- **FR-013**: Los intentos no autorizados MUST responder de forma consistente sin filtrar información sensible y MUST NOT producir cambios parciales.
- **FR-014**: Las membresías existentes MUST migrarse asignando Administrador al creador del warehouse y Contribuidor a los demás miembros.
- **FR-015**: El alcance exacto de configuración y operaciones auxiliares permitidas al Contribuidor MUST quedar reflejado en una matriz de permisos antes de planificar.
- **FR-016**: El sistema MUST ofrecer a los Administradores un módulo de gestión de miembros con identidad, rol actual y permisos derivados dentro del warehouse.
- **FR-017**: Desde el módulo, un Administrador MUST poder cambiar posteriormente una membresía entre Administrador y Contribuidor, sujeto a la regla de conservar al menos un Administrador.
- **FR-018**: Una nueva invitación MUST permitir al Administrador seleccionar el rol y MUST usar Contribuidor como valor por defecto.
- **FR-019**: Los permisos MUST ser conjuntos fijos derivados exclusivamente del rol; el sistema MUST NOT admitir excepciones por usuario ni edición de las capacidades del rol.
- **FR-020**: El módulo y la ruta Settings, incluyendo contraseña, PWA, SMTP, LLM, sync, exportación e importación, MUST quedar inaccesible para Contribuidores y reservado a Administradores del warehouse seleccionado.
- **FR-021**: Cualquier Administrador MUST poder eliminar el warehouse con las confirmaciones y bloqueos existentes; `created_by` MUST NOT ser el criterio exclusivo de autorización.

### Permission Matrix

| Capacidad dentro del warehouse | Administrador | Contribuidor |
|---------------------------------|---------------|--------------|
| Ver y seleccionar el warehouse | Permitido | Permitido |
| Crear un warehouse nuevo propio | Permitido | Permitido; será Administrador del nuevo warehouse |
| Buscar, consultar actividad y usar QR | Permitido | Permitido |
| Crear/editar/mover/eliminar/restaurar cajas y artículos | Permitido | Permitido |
| Gestionar stock, favoritos, fotos, tags y papelera | Permitido | Permitido |
| Crear, procesar y guardar lotes | Permitido | Permitido |
| Crear invitaciones y seleccionar su rol | Permitido | Denegado |
| Consultar miembros y matriz de permisos | Permitido | Denegado |
| Cambiar el rol de un miembro | Permitido, salvo dejar cero Administradores | Denegado |
| Eliminar el warehouse | Permitido a cualquier Administrador, con confirmación y bloqueos existentes | Denegado |
| Acceder a Settings: contraseña, PWA, SMTP, LLM, sync, export/import | Permitido | Denegado |

### Out of Scope

- Permisos individuales, excepciones por usuario o edición de los conjuntos de permisos.
- Roles adicionales a Administrador y Contribuidor.
- Expulsar miembros o permitir que un miembro abandone un warehouse.
- Transferir explícitamente la propiedad histórica `created_by`; varios miembros pueden ser Administradores y cualquiera de ellos puede eliminar el warehouse.

### Key Entities

- **Membresía**: Relación entre usuario y warehouse que incorpora un único rol y determina permisos solo dentro de ese warehouse.
- **Rol**: Nivel `Administrador` o `Contribuidor` con capacidades administrativas u operativas.
- **Invitación**: Acceso pendiente que fija el warehouse, destinatario y rol que se copiará a la membresía al aceptar.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de las operaciones administrativas controladas se permite a Administradores y se rechaza a Contribuidores tanto desde UI como mediante petición directa.
- **SC-002**: El 100% de los flujos operativos existentes de inventario y lotes continúa funcionando para ambos roles.
- **SC-003**: Un usuario con roles diferentes en dos warehouses ve y obtiene permisos correctos inmediatamente después de cambiar entre ellos.
- **SC-004**: Ninguna migración, invitación o modificación de rol puede dejar un warehouse sin Administrador.
- **SC-005**: El 100% de las membresías existentes recibe un rol determinista tras la actualización.

## Assumptions

- Los roles son por warehouse y un mismo usuario puede tener distintos roles en distintos espacios.
- Los dos roles tienen permisos fijos; “gestionar permisos” significa consultar la matriz efectiva y cambiar la asignación de rol, no crear excepciones.
- Crear un warehouse propio sigue disponible para cualquier usuario autenticado y lo convierte en Administrador del nuevo warehouse.
- La autorización real reside en backend; ocultar controles frontend es una mejora de UX, no una barrera de seguridad.
- Las operaciones de contenido permitidas al Contribuidor mantienen el comportamiento actual salvo las restricciones administrativas explícitas.
- Siempre debe existir al menos un Administrador por warehouse.
- La recuperación de contraseña fuera de Settings permanece disponible para todos los usuarios; no forma parte de la administración del warehouse.
