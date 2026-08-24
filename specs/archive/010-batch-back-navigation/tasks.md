# Tasks: Navegación padre en lotes

## Phase 0: Contract Gate

- [x] T001 Documentar los destinos padre del listado y detalle en `specs/contracts/app/contract.md`

## Phase 1: User Story 1 - Volver desde cualquier vista de lotes (P1) 🎯 MVP

**Independent Test**: Comprobar retorno del detalle al listado, del listado con `boxId` a la caja y del listado sin contexto a Inicio.

- [x] T002 [P] [US1] Añadir pruebas de retorno del listado en `frontend/src/app/items/intake-batches.component.spec.ts`
- [x] T003 [P] [US1] Añadir prueba de retorno del detalle en `frontend/src/app/items/item-intake-batch.component.spec.ts`
- [x] T004 [US1] Implementar destino y control padre del listado en `frontend/src/app/items/intake-batches.component.ts`
- [x] T005 [US1] Implementar «Volver a lotes» en `frontend/src/app/items/item-intake-batch.component.ts`
- [x] T006 [US1] Ejecutar los specs enfocados de ambos componentes según `specs/changes/010-batch-back-navigation/quickstart.md`

## Phase 2: Validation & Completion

- [x] T007 Ejecutar la suite completa frontend desde `frontend/package.json`
- [x] T008 Ejecutar el build de producción desde `frontend/package.json`
- [x] T009 Registrar resultados, completar tareas y archivar en `specs/archive/010-batch-back-navigation/` actualizando `specs/manifest.yml`

## Dependencies

- T001 bloquea todo cambio de producto.
- T002 y T003 pueden escribirse en paralelo y preceden T004/T005.
- T006 depende de T004 y T005; T007–T008 dependen de T006; T009 cierra el cambio.

## Format Validation

- 9 tareas totales, 5 trazadas a US1 y 2 oportunidades paralelas.
- Todas incluyen checkbox, ID, etiqueta cuando corresponde y ruta concreta.

## Validation Results

- Specs enfocados: 2 archivos, 16 tests aprobados.
- Suite frontend: 42 archivos, 218 tests aprobados.
- Build de producción: completado correctamente.
