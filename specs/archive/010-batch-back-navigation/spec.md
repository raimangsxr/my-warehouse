# Feature Specification: Navegación padre en lotes

**Feature Branch**: `004-batch-back-navigation`

**Created**: 2026-08-24

**Status**: Completed

**Input**: User description: "Mantener la navegabilidad en todo momento permitiendo ir atrás o a la vista padre."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Volver desde cualquier vista de lotes (Priority: P1)

Como usuario del warehouse, quiero una acción de retorno visible en la lista y el detalle de lotes para salir del flujo sin depender del menú global ni del botón del navegador.

**Why this priority**: Evita callejones de navegación y mantiene claro el nivel padre de cada pantalla.

**Independent Test**: Abrir cada vista de lotes directamente y comprobar que el control visible conduce a su padre lógico.

**Acceptance Scenarios**:

1. **Given** un usuario en el detalle de un lote, **When** activa «Volver a lotes», **Then** regresa al listado de lotes.
2. **Given** un usuario en el listado abierto desde una caja, **When** activa «Volver a la caja», **Then** regresa al detalle de esa caja.
3. **Given** un usuario en el listado sin contexto de caja, **When** activa «Volver a Inicio», **Then** regresa a la vista Inicio del warehouse.

### Edge Cases

- La navegación funciona aunque la pantalla se haya abierto mediante URL directa y no exista historial previo.
- Un `boxId` ausente no genera una ruta de caja incompleta.
- Los controles permanecen visibles y operables en escritorio y móvil sin desplazar las acciones principales fuera de la cabecera.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El detalle de lote MUST ofrecer una acción visible y etiquetada para volver al listado de lotes.
- **FR-002**: El listado de lotes MUST ofrecer una acción visible hacia su vista padre.
- **FR-003**: Cuando el listado tenga contexto de caja, la vista padre MUST ser el detalle de esa caja.
- **FR-004**: Cuando el listado no tenga contexto de caja, la vista padre MUST ser Inicio.
- **FR-005**: La navegación MUST usar destinos deterministas y funcionar sin historial del navegador.
- **FR-006**: Los controles MUST tener nombre accesible y conservar la operabilidad responsive de las cabeceras.
- **FR-007**: Las acciones, datos y contexto de creación existentes MUST conservar su comportamiento.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100 % de las vistas del flujo de lotes ofrece una salida visible a su padre lógico.
- **SC-002**: El usuario vuelve desde el detalle al listado y desde el listado a su padre con una sola acción.
- **SC-003**: El 100 % de los destinos de retorno funciona al acceder directamente por URL.
- **SC-004**: Todos los controles de retorno tienen etiqueta visible o accesible y son operables en los anchos móvil y escritorio cubiertos.

## Assumptions

- «En todo momento» se acota al flujo de lista y detalle de lotes que motiva esta conversación.
- Inicio (`/app/home`) es el padre lógico del listado general de lotes.
- Si el listado se abre con `boxId`, el detalle de esa caja es el padre lógico.
- Se prioriza la navegación padre determinista frente a depender del historial, que puede salir de la aplicación.
