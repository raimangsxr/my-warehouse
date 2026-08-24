# Feature Specification: Mostrar caja en la lista de lotes

**Feature Branch**: `003-show-box-in-batch-list`

**Created**: 2026-08-24

**Status**: Completed

**Input**: User description: "Cuando el usuario está en la vista de lista de lotes, al lado del nombre del lote, indicar de qué caja es."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Identificar la caja de un lote desde el listado (Priority: P1)

Como usuario del warehouse, quiero ver la caja destino junto al nombre de cada lote para distinguirlo sin abrir su detalle.

**Why this priority**: Resuelve directamente la falta de contexto en el listado y evita navegación innecesaria.

**Independent Test**: Se puede cargar un listado con lotes asociados a distintas cajas y comprobar que cada fila muestra el nombre del lote y el de su caja correspondiente antes de abrirla.

**Acceptance Scenarios**:

1. **Given** un lote con nombre y caja destino disponibles, **When** el usuario abre la lista de lotes, **Then** ve el nombre de la caja junto al nombre del lote en la misma cabecera de fila.
2. **Given** un lote sin nombre personalizado, **When** el usuario abre la lista, **Then** ve el nombre generado del lote y el nombre de su caja juntos.
3. **Given** varios lotes asociados a cajas distintas, **When** el usuario revisa el listado, **Then** puede relacionar cada lote con su caja sin entrar en el detalle.

### Edge Cases

- Si el nombre de la caja no está disponible en una respuesta antigua o incompleta, la fila sigue mostrando el lote sin un texto de caja engañoso.
- Los nombres largos de lote o caja no deben ocultar las acciones de abrir y eliminar ni desbordar la fila en pantallas estrechas.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La lista de lotes MUST mostrar el nombre de la caja destino junto al nombre visible de cada lote cuando dicho nombre esté disponible.
- **FR-002**: La asociación mostrada MUST corresponder a la caja destino del lote de esa misma fila.
- **FR-003**: Los lotes sin nombre personalizado MUST conservar su identificador visible generado y mostrar igualmente la caja destino cuando esté disponible.
- **FR-004**: La ausencia del nombre de caja MUST NOT impedir que el lote y sus acciones se muestren y funcionen.
- **FR-005**: La presentación MUST seguir siendo legible y operable tanto en escritorio como en pantallas móviles compatibles.
- **FR-006**: Las acciones y datos existentes de cada lote MUST conservar su comportamiento actual.

### Key Entities

- **Lote de captura**: Agrupa fotos y borradores y tiene un nombre visible, un estado y una caja destino.
- **Caja destino**: Caja del warehouse a la que se guardarán los artículos confirmados del lote; aporta el nombre que contextualiza el lote.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En el 100 % de los lotes cuya caja destino tenga nombre disponible, la caja se identifica desde el listado sin abrir el detalle.
- **SC-002**: Un usuario puede determinar la caja de cualquier lote visible con una sola lectura de su fila y cero navegaciones adicionales.
- **SC-003**: El 100 % de las acciones actuales del listado continúa disponible después del cambio.
- **SC-004**: La identificación conjunta de lote y caja es legible en los anchos de pantalla de escritorio y móvil cubiertos por la aplicación.

## Assumptions

- La caja relevante es la caja destino ya asociada al lote, no su jerarquía completa.
- El nombre de la caja ya forma parte de los datos disponibles para cada lote; no se introduce ni modifica persistencia.
- La mejora afecta al listado `/app/batches`, no a la vista de detalle ni al selector de creación.
- Se usa el nombre actual de la caja y no se convierte en un enlace independiente.
