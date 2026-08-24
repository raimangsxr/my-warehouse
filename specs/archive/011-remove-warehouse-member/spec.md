# Feature Specification: Eliminar miembro del warehouse

**Feature Branch**: `005-remove-warehouse-member`

**Created**: 2026-08-24

**Status**: Completed

**Input**: User description: "En la lista de miembros de un warehouse, si eres administrador, poder eliminar a un miembro sea cual sea su rol."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Retirar el acceso de otro miembro (Priority: P1)

Como Administrador de un warehouse, quiero eliminar desde la lista a otro miembro, con independencia de que sea Administrador o Contribuidor, para controlar quién conserva acceso al warehouse.

**Why this priority**: Es el valor principal de la feature y resuelve la imposibilidad actual de retirar accesos ya concedidos.

**Independent Test**: Con un warehouse que tenga varios miembros, un Administrador puede retirar primero a un Contribuidor y después a otro Administrador; ambos desaparecen de la lista y dejan de poder acceder al warehouse.

**Acceptance Scenarios**:

1. **Given** un Administrador consulta la lista y existe otro miembro Contribuidor, **When** confirma su eliminación, **Then** el miembro desaparece de la lista y pierde acceso al warehouse.
2. **Given** un Administrador consulta la lista y existe otro miembro Administrador, **When** confirma su eliminación, **Then** el miembro desaparece de la lista y pierde acceso al warehouse.
3. **Given** un Contribuidor intenta retirar a un miembro mediante una petición directa, **When** se evalúa la acción, **Then** se rechaza sin modificar membresías.

---

### User Story 2 - Evitar eliminaciones accidentales o inválidas (Priority: P2)

Como Administrador, quiero distinguir claramente a quién voy a retirar y confirmar la decisión para evitar pérdidas de acceso accidentales.

**Why this priority**: La retirada tiene efecto inmediato sobre otra persona y necesita una salvaguarda comprensible.

**Independent Test**: Abrir la acción sobre un miembro, cancelar la confirmación y verificar que nada cambia; repetir y confirmar para comprobar un único resultado y una notificación clara.

**Acceptance Scenarios**:

1. **Given** un Administrador inicia la eliminación de otro miembro, **When** cancela la confirmación, **Then** el miembro conserva su acceso y permanece en la lista.
2. **Given** que el miembro ya no pertenece al warehouse al confirmar, **When** se procesa la acción, **Then** se informa del fallo y no se altera ninguna otra membresía.
3. **Given** un Administrador visualiza su propia fila, **When** consulta las acciones disponibles, **Then** no puede eliminar su propia membresía mediante esta feature.

### Edge Cases

- El miembro objetivo puede tener rol Administrador o Contribuidor; el rol no cambia la posibilidad de retirarlo.
- Dos Administradores pueden intentar retirar al mismo miembro; solo una petición elimina la membresía y la otra recibe un resultado de miembro inexistente.
- Una sesión ya iniciada del miembro retirado pierde acceso en la siguiente operación autorizada sobre ese warehouse.
- Si el warehouse retirado era el predeterminado del miembro, la preferencia deja de apuntar a él y se resolverá mediante las reglas existentes de selección predeterminada.
- La retirada no borra la cuenta, las aportaciones históricas ni el contenido compartido del warehouse.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST permitir que un Administrador retire a otro miembro del warehouse desde la lista de miembros.
- **FR-002**: La retirada MUST admitir como objetivo tanto a un Administrador como a un Contribuidor, sin depender de quién creó el warehouse.
- **FR-003**: El sistema MUST impedir que un Contribuidor retire miembros, aunque intente ejecutar la acción fuera de la interfaz.
- **FR-004**: Esta feature MUST impedir que el Administrador elimine su propia membresía.
- **FR-005**: La interfaz MUST identificar al miembro objetivo y solicitar confirmación antes de ejecutar la retirada.
- **FR-006**: Al confirmar con éxito, el miembro MUST desaparecer de la lista sin requerir recargar manualmente la página y la interfaz MUST comunicar el resultado.
- **FR-007**: Una membresía retirada MUST dejar de conceder acceso al warehouse desde la siguiente operación autorizada.
- **FR-008**: Si el warehouse era la preferencia predeterminada del miembro retirado, el sistema MUST invalidar esa referencia sin afectar sus demás membresías.
- **FR-009**: La retirada MUST conservar la cuenta del usuario, el contenido compartido y el historial previo del warehouse.
- **FR-010**: El sistema MUST responder como miembro inexistente cuando el objetivo no pertenece al warehouse y MUST evitar cambios parciales.
- **FR-011**: Cada retirada completada MUST quedar registrada en la actividad del warehouse con el actor y el miembro objetivo.
- **FR-012**: El control de eliminación MUST ser accesible por teclado, tener un nombre comprensible y permanecer utilizable en móvil y escritorio.

### Key Entities

- **Membresía**: Relación entre una cuenta y un warehouse, con rol Administrador o Contribuidor; su eliminación revoca el acceso sin eliminar ninguna de las dos entidades relacionadas.
- **Preferencia de warehouse predeterminado**: Referencia opcional de la cuenta retirada que debe dejar de apuntar a un warehouse inaccesible.
- **Evento de actividad**: Registro histórico de la retirada que identifica al Administrador actor y a la membresía objetivo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un Administrador completa la retirada confirmada de otro miembro en un máximo de dos acciones desde su fila.
- **SC-002**: El 100 % de las retiradas exitosas de Administradores y Contribuidores elimina inmediatamente al objetivo de la lista y revoca su acceso posterior.
- **SC-003**: El 100 % de los intentos de Contribuidores y de autoeliminación se rechaza sin cambios en las membresías.
- **SC-004**: El 100 % de las preferencias predeterminadas afectadas deja de apuntar al warehouse retirado.
- **SC-005**: Todas las retiradas exitosas generan un único evento de actividad atribuible al Administrador actor.

## Assumptions

- «Eliminar a un miembro» significa retirar su membresía y acceso, no eliminar su cuenta ni sus datos históricos.
- «Sea el rol que sea» se refiere al rol del otro miembro objetivo; la autoeliminación o abandono voluntario queda fuera de alcance.
- No hace falta proteger al último Administrador en este flujo porque el actor Administrador no puede retirarse a sí mismo y, por tanto, siempre permanece al menos uno.
- La confirmación usa los patrones visuales y de notificación existentes de la aplicación.
