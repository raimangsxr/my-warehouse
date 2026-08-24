# Tasks: Eliminar miembro del warehouse

**Input**: Design documents from `specs/changes/011-remove-warehouse-member/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/http-api.md`, `quickstart.md`

**Tests**: Obligatorios por tratarse de una nueva operación destructiva, una mutación de datos y una regla de autorización.

## Phase 1: Contract Gate

**Purpose**: Actualizar la verdad durable antes de cualquier cambio de producto.

- [x] T001 Actualizar retirada de miembros, autorización, autoeliminación, preferencia predeterminada, actividad y matriz de permisos en `specs/contracts/app/contract.md`
- [x] T002 Verificar que `specs/manifest.yml`, `specs/changes/011-remove-warehouse-member/context-pack.md` y `specs/changes/011-remove-warehouse-member/contracts/http-api.md` estén sincronizados

**Checkpoint**: G1–G4 satisfechas; puede comenzar implementación.

---

## Phase 2: User Story 1 — Retirar el acceso de otro miembro (Priority: P1) 🎯 MVP

**Goal**: Un Administrador retira a otro miembro, Administrador o Contribuidor, y su acceso y predeterminado se actualizan atómicamente.

**Independent Test**: Crear un warehouse con dos objetivos de distinto rol, retirarlos desde una cuenta Administrador y comprobar lista, acceso, preferencia y actividad.

### Tests for User Story 1

- [x] T003 [P] [US1] Añadir pruebas API para retirar Contribuidor y Administrador, revocar acceso, limpiar predeterminado y registrar actividad en `backend/tests/test_warehouse_roles.py`
- [x] T004 [P] [US1] Añadir prueba del método DELETE de miembros en `frontend/src/app/services/warehouse.service.spec.ts`

### Implementation for User Story 1

- [x] T005 [US1] Implementar `DELETE /warehouses/{warehouse_id}/members/{user_id}` transaccional con autorización, bloqueo, limpieza de predeterminado y actividad en `backend/app/api/v1/endpoints/warehouses.py`
- [x] T006 [P] [US1] Añadir `removeMember` al cliente HTTP en `frontend/src/app/services/warehouse.service.ts`
- [x] T007 [US1] Añadir acción de retirada por fila, estado durante la petición y actualización inmediata de lista en `frontend/src/app/members/members.component.ts`
- [x] T008 [US1] Ejecutar las pruebas estrechas de API, servicio y componente definidas en `specs/changes/011-remove-warehouse-member/quickstart.md`

**Checkpoint**: La retirada de ambos roles funciona de extremo a extremo y puede demostrarse independientemente.

---

## Phase 3: User Story 2 — Evitar eliminaciones accidentales o inválidas (Priority: P2)

**Goal**: La retirada identifica al objetivo, exige confirmación, excluye la fila propia y comunica fallos sin cambios parciales.

**Independent Test**: Cancelar una retirada, intentar autoeliminación y objetivo inexistente, y comprobar que solo una confirmación válida modifica la lista.

### Tests for User Story 2

- [x] T009 [P] [US2] Añadir pruebas API de Contribuidor denegado, autoeliminación, miembro inexistente y ausencia de cambios parciales en `backend/tests/test_warehouse_roles.py`
- [x] T010 [P] [US2] Añadir pruebas de componente para confirmación, cancelación, fila propia, errores, accesibilidad y ambos roles objetivo en `frontend/src/app/members/members.component.spec.ts`

### Implementation for User Story 2

- [x] T011 [US2] Completar confirmación con identidad, ocultación de autoeliminación, etiquetas accesibles y mensajes de error españoles en `frontend/src/app/members/members.component.ts`
- [x] T012 [US2] Ejecutar nuevamente las pruebas estrechas de `backend/tests/test_warehouse_roles.py`, `frontend/src/app/services/warehouse.service.spec.ts` y `frontend/src/app/members/members.component.spec.ts`

**Checkpoint**: Flujos principal, alternativo y de error son consistentes y comprobables.

---

## Phase 4: Polish & Cross-Cutting Validation

- [x] T013 Ejecutar suite backend completa con `cd backend && uv run pytest`
- [x] T014 Ejecutar suite frontend completa con `cd frontend && npm test -- --watch=false`
- [x] T015 Ejecutar build de producción con `cd frontend && npm run build`
- [x] T016 Revisar el diff final, sincronizar estado de tareas y archivar el cambio en `specs/archive/011-remove-warehouse-member/` actualizando `specs/manifest.yml` y `.cursor/rules/specify-rules.mdc`

---

## Dependencies & Execution Order

- Phase 1 bloquea toda implementación.
- US1 comienza tras el gate contractual; T003 y T004 pueden prepararse en paralelo, T005/T006 implementan sus contratos y T007 integra el frontend.
- US2 depende del flujo base de US1; T009 y T010 pueden escribirse en paralelo antes de T011.
- La validación amplia y el archivado dependen de ambas historias completas.

## Parallel Opportunities

- T003 y T004 afectan suites distintas.
- T005 y T006 afectan backend y frontend separados después de sus pruebas.
- T009 y T010 cubren backend y componente en archivos distintos.

## Implementation Strategy

1. Completar T001–T002 para abrir el gate constitucional.
2. Entregar T003–T008 como MVP funcional de retirada de cualquier otro rol.
3. Completar T009–T012 para cerrar salvaguardas y UX destructiva.
4. Ejecutar T013–T016 y archivar solo con todas las validaciones verdes.

## Format Validation

- Las 16 tareas incluyen checkbox, ID secuencial, ruta o comando concreto y etiqueta de historia solo dentro de fases de historia.
