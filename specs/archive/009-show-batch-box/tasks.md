# Tasks: Mostrar caja en la lista de lotes

**Input**: Design documents from `specs/changes/009-show-batch-box/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/ui.md`

**Tests**: La Constitución exige prueba automatizada para el comportamiento visible modificado.

**Organization**: Una única historia P1 entrega el valor completo y es comprobable de forma independiente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo con tareas sobre otros archivos sin dependencias pendientes.
- **[US1]**: Identificar la caja de un lote desde el listado.

## Phase 0: Contract Gate (Blocking)

**Purpose**: Alinear el contrato duradero antes de cualquier cambio de producto.

- [x] T001 Actualizar el comportamiento de `/app/batches` y el fallback de caja en `specs/contracts/app/contract.md`

**Checkpoint**: El contrato activo describe la mejora antes de editar `frontend/`.

---

## Phase 1: User Story 1 - Identificar la caja de un lote desde el listado (Priority: P1) 🎯 MVP

**Goal**: Mostrar la caja destino junto al nombre de cada lote sin abrir su detalle.

**Independent Test**: Cargar una respuesta con lote y `target_box_name`, comprobar ambos textos en la cabecera; cargar un lote sin nombre de caja y comprobar que el título y las acciones siguen presentes sin etiqueta engañosa.

### Tests for User Story 1

> Escribir la prueba primero y observar que falla antes de implementar.

- [x] T002 [US1] Añadir escenarios de nombre de caja presente y nulo en `frontend/src/app/items/intake-batches.component.spec.ts`

### Implementation for User Story 1

- [x] T003 [US1] Mostrar y estilizar la etiqueta condicional `Caja: {target_box_name}` junto al título en `frontend/src/app/items/intake-batches.component.ts`
- [x] T004 [US1] Ejecutar el test enfocado de `frontend/src/app/items/intake-batches.component.spec.ts` según `specs/changes/009-show-batch-box/quickstart.md`

**Checkpoint**: La historia P1 queda funcional y probada de forma independiente.

---

## Phase 2: Validation & Completion

**Purpose**: Detectar regresiones y cerrar el registro SDD.

- [x] T005 Ejecutar la suite completa frontend desde `frontend/package.json`
- [x] T006 Ejecutar el build de producción frontend desde `frontend/package.json`
- [x] T007 Registrar resultados, marcar tareas completadas y archivar el cambio actualizando `specs/manifest.yml` y `specs/archive/009-show-batch-box/`

---

## Dependencies & Execution Order

- T001 bloquea T002–T007 por la regla contract-before-implementation.
- T002 precede T003 para observar la regresión en rojo.
- T003 precede T004; T004 precede la validación amplia T005–T006.
- T007 depende de que T005 y T006 terminen correctamente.

## Parallel Opportunities

No se marcan tareas paralelas: el cambio es pequeño y el orden contrato → prueba → implementación → validación reduce el riesgo de inconsistencias.

## Implementation Strategy

1. Completar el gate contractual T001.
2. Implementar únicamente US1 mediante T002–T004.
3. Ejecutar validación amplia T005–T006.
4. Cerrar y archivar el cambio con T007.

## Format Validation

- 7 tareas totales; 3 tareas trazadas a US1.
- Todas usan checkbox, ID secuencial y ruta concreta.
- El alcance MVP es la única historia US1.

## Validation Results

- Test enfocado: 1 archivo, 7 tests aprobados.
- Suite frontend: 42 archivos, 215 tests aprobados.
- Build de producción: completado correctamente; salida en `frontend/dist/my-warehouse`.
- Runtime de validación: Node 24.18.0 de NVM, usado porque el Node 25.6.1 de Homebrew referencia una versión ausente de `libsimdjson`.
