# UX Requirements Checklist: Mostrar caja en la lista de lotes

**Purpose**: Validar que los requisitos de identificación lote-caja sean claros, completos y revisables antes de implementar.
**Created**: 2026-08-24
**Feature**: [spec.md](../spec.md)

**Note**: Checklist estándar para revisión de PR, centrado en contenido, fallback y presentación responsive.

## Requirement Completeness

- [x] CHK001 ¿Está especificado qué caja debe mostrarse para cada lote? [Completeness, Spec §FR-001–FR-002]
- [x] CHK002 ¿Está documentado el comportamiento tanto para lotes con nombre personalizado como sin él? [Completeness, Spec §FR-003]
- [x] CHK003 ¿Está delimitado que la mejora afecta al listado y no al detalle, selector o navegación? [Scope, Spec §Assumptions]

## Requirement Clarity

- [x] CHK004 ¿La expresión “junto al nombre” identifica de forma inequívoca que lote y caja pertenecen a la misma cabecera de fila? [Clarity, Spec §User Story 1]
- [x] CHK005 ¿Se distingue claramente el nombre visible del lote del nombre de la caja destino? [Clarity, Spec §Key Entities]
- [x] CHK006 ¿Está claro que se muestra el nombre de la caja y no la ruta jerárquica completa? [Clarity, Spec §Assumptions]

## Scenario and Edge-Case Coverage

- [x] CHK007 ¿El escenario principal cubre lotes vinculados a cajas distintas? [Coverage, Spec §Acceptance Scenarios]
- [x] CHK008 ¿Está definido un fallback que evita información engañosa cuando falta el nombre de caja? [Edge Case, Spec §FR-004]
- [x] CHK009 ¿Están contemplados nombres largos y pantallas estrechas sin perder las acciones existentes? [Non-Functional, Spec §Edge Cases, §FR-005–FR-006]

## Acceptance Criteria Quality

- [x] CHK010 ¿Puede medirse objetivamente que todos los lotes con nombre de caja disponible lo muestran desde el listado? [Measurability, Spec §SC-001]
- [x] CHK011 ¿Puede comprobarse la reducción a cero de navegaciones necesarias para identificar la caja? [Measurability, Spec §SC-002]
- [x] CHK012 ¿La conservación de todas las acciones existentes está expresada como criterio verificable? [Consistency, Spec §SC-003]

## Dependencies & Assumptions

- [x] CHK013 ¿Está documentada y respaldada por el contexto la disponibilidad previa del nombre de caja en los datos del lote? [Assumption, Context Pack §Current code behavior]
- [x] CHK014 ¿Está explícitamente excluida cualquier modificación de persistencia o API? [Dependency, Context Pack §Out of scope]

## Notes

- Todos los puntos pasan la revisión de requisitos; no se identifican huecos bloqueantes para planificación.
