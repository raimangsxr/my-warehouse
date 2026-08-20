# Tasks: Roles de usuario por warehouse

**Input**: `specs/changes/007-warehouse-user-roles/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/http-api.md`

## Phase 1: Setup (contract gate)

**Purpose**: Actualizar la verdad contractual antes de cualquier cambio de producto.

- [x] T001 Actualizar roles, matriz de permisos, migración, invitaciones, gestión posterior y regla del último Administrador en `specs/contracts/app/contract.md`
- [x] T002 Verificar que `specs/manifest.yml`, `specs/changes/007-warehouse-user-roles/context-pack.md` y `specs/changes/007-warehouse-user-roles/contracts/http-api.md` están sincronizados con el contrato activo

**Checkpoint**: G1–G4 satisfechos; puede comenzar código de producto.

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: Persistencia, tipos y autorización compartidos por todas las historias.

- [x] T003 Añadir constantes/tipo de rol y columna no nula con default seguro a `backend/app/models/membership.py`
- [x] T004 [P] Añadir rol persistido con default Contribuidor a `backend/app/models/warehouse_invite.py`
- [x] T005 Crear migración Alembic con backfill creador→Administrador/resto→Contribuidor e invitaciones pendientes→Contribuidor en `backend/alembic/versions/20260820_0013_warehouse_roles.py`
- [x] T006 [P] Añadir schemas tipados de rol y ampliar respuestas/requests de warehouse, invitación y miembro en `backend/app/schemas/warehouse.py`
- [x] T007 Añadir autorización reutilizable de Administrador por membresía en `backend/app/api/deps.py`
- [x] T008 [P] Añadir cobertura del upgrade/downgrade y backfill de roles en `backend/tests/test_warehouse_roles_migration.py`
- [x] T009 Ejecutar tests fundacionales de modelo/migración desde `backend/tests/test_warehouse_roles_migration.py`

**Checkpoint**: Toda membresía e invitación tiene un rol válido y el backend puede exigir Administrador.

---

## Phase 3: User Story 1 — Administrar con control total (P1)

**Goal**: El Administrador conserva control completo y el rol cambia correctamente con el warehouse seleccionado.

**Independent Test**: Creador y Administrador invitado pueden usar operaciones administrativas, incluida eliminación; su rol se expone por warehouse.

- [x] T010 [P] [US1] Crear tests API de creación/listado/detalle con rol Administrador y eliminación por Administrador no creador en `backend/tests/test_warehouse_roles.py`
- [x] T011 [P] [US1] Crear tests frontend del estado de rol seleccionado y cambio entre warehouses en `frontend/src/app/services/warehouse.service.spec.ts`
- [x] T012 [US1] Propagar el rol en creación, listado y detalle de warehouses en `backend/app/api/v1/endpoints/warehouses.py`
- [x] T013 [US1] Autorizar eliminación por rol Administrador en vez de `created_by` en `backend/app/services/warehouse_delete.py` y `backend/app/api/v1/endpoints/warehouses.py`
- [x] T014 [US1] Ampliar contratos TypeScript y estado reactivo del rol seleccionado en `frontend/src/app/services/warehouse.service.ts`
- [x] T015 [US1] Adaptar tarjetas y diálogo de warehouse para mostrar rol y permitir borrado a cualquier Administrador en `frontend/src/app/warehouses/warehouses.component.ts` y `frontend/src/app/warehouses/warehouse-delete-dialog.component.ts`
- [x] T016 [US1] Ejecutar tests de US1 en `backend/tests/test_warehouse_roles.py`, `frontend/src/app/services/warehouse.service.spec.ts` y `frontend/src/app/warehouses/warehouses.component.spec.ts`

**Checkpoint**: El Administrador mantiene las capacidades actuales sin depender de ser creador.

---

## Phase 4: User Story 2 — Colaborar sin administración (P1)

**Goal**: El Contribuidor gestiona contenido operativo y no puede acceder a ninguna capacidad administrativa.

**Independent Test**: Un Contribuidor completa flujos de cajas/artículos/lotes y recibe `403` para Settings, sync, transfer, invitaciones, miembros y eliminación; la UI no ofrece esas rutas.

- [x] T017 [P] [US2] Añadir matriz de tests backend para permitir inventario/lotes y denegar todos los endpoints administrativos a Contribuidor en `backend/tests/test_warehouse_roles.py`
- [x] T018 [P] [US2] Crear tests del guard de Administrador y redirección al cambiar/degradar rol en `frontend/src/app/core/warehouse-admin.guard.spec.ts`
- [x] T019 [P] [US2] Ampliar tests de shell para navegación Settings/Miembros/PWA sensible al rol en `frontend/src/app/shell/shell.component.spec.ts`
- [x] T020 [US2] Aplicar autorización Administrador a todos los endpoints de Settings/SMTP/LLM en `backend/app/api/v1/endpoints/settings.py`
- [x] T021 [US2] Aplicar autorización Administrador a sync push/pull/resolve en `backend/app/api/v1/endpoints/sync.py`
- [x] T022 [US2] Aplicar autorización Administrador a export/import en `backend/app/api/v1/endpoints/transfer.py`
- [x] T023 [US2] Crear guard de ruta Administrador y proteger Settings/Miembros en `frontend/src/app/core/warehouse-admin.guard.ts` y `frontend/src/app/routes.ts`
- [x] T024 [US2] Ocultar Settings, miembros y acciones PWA a Contribuidores en `frontend/src/app/shell/shell.component.ts`
- [x] T025 [US2] Ejecutar tests de matriz backend, guard, rutas y shell de US2 en `backend/tests/test_warehouse_roles.py` y `frontend/src/app/**/*.spec.ts`

**Checkpoint**: La separación Administrador/Contribuidor se aplica tanto en API como en UI.

---

## Phase 5: User Story 3 — Asignar y mantener roles (P1)

**Goal**: Los Administradores asignan rol al invitar y lo cambian después desde un módulo exclusivo, sin dejar cero administradores.

**Independent Test**: Invitaciones de ambos roles se aceptan con el rol fijado; un Admin lista/promueve/degrada miembros y la degradación del último Admin falla con `409`.

- [x] T026 [P] [US3] Añadir tests API de invitación con default/rol explícito, aceptación, listado de miembros, cambio de rol, auto-cambio no autorizado y último Administrador en `backend/tests/test_warehouse_roles.py`
- [x] T027 [P] [US3] Añadir tests del servicio de miembros e invitación con rol en `frontend/src/app/services/warehouse.service.spec.ts`
- [x] T028 [P] [US3] Crear tests de interfaz para matriz fija, cambio de rol y error del último Administrador en `frontend/src/app/members/members.component.spec.ts`
- [x] T029 [US3] Persistir y devolver el rol elegido al crear/aceptar invitaciones y exigir Administrador en `backend/app/api/v1/endpoints/warehouses.py`
- [x] T030 [US3] Ampliar listado de miembros con identidad/rol y añadir PATCH transaccional con protección del último Administrador en `backend/app/api/v1/endpoints/warehouses.py`
- [x] T031 [US3] Registrar cambios de rol en la actividad del warehouse usando el patrón existente en `backend/app/api/v1/endpoints/warehouses.py`
- [x] T032 [US3] Añadir métodos TypeScript para listar miembros y cambiar roles e incluir rol en invitaciones en `frontend/src/app/services/warehouse.service.ts`
- [x] T033 [US3] Añadir selector de rol con Contribuidor por defecto al formulario de invitación en `frontend/src/app/warehouses/warehouses.component.ts`
- [x] T034 [US3] Implementar módulo Administrador de miembros, roles y matriz fija en `frontend/src/app/members/members.component.ts`
- [x] T035 [US3] Añadir ruta y navegación al módulo de miembros en `frontend/src/app/routes.ts` y `frontend/src/app/shell/shell.component.ts`
- [x] T036 [US3] Ejecutar tests backend/frontend de invitación, aceptación, miembros y último Administrador de US3

**Checkpoint**: El ciclo completo de asignación y mantenimiento de roles funciona de forma segura.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T037 [P] Actualizar fixtures y expectativas existentes afectadas por el nuevo campo `role` en `backend/tests/` y `frontend/src/app/**/*.spec.ts`
- [x] T038 [P] Revisar copy español, accesibilidad de selects/tablas y responsive del módulo en `frontend/src/app/members/members.component.ts` y `frontend/src/app/warehouses/warehouses.component.ts`
- [x] T039 Ejecutar `cd backend && uv run ruff check app tests` y corregir incidencias de la feature
- [x] T040 Ejecutar suite completa `cd backend && uv run pytest`
- [x] T041 Ejecutar suite completa `cd frontend && npm test -- --watch=false`
- [x] T042 Ejecutar build de producción `cd frontend && npm run build`
- [x] T043 Validar manualmente los escenarios de `specs/changes/007-warehouse-user-roles/quickstart.md`
- [x] T044 Sincronizar comportamiento final y evidencias en `specs/contracts/app/contract.md`, `specs/changes/007-warehouse-user-roles/tasks.md` y `specs/manifest.yml`

---

## Dependencies & Execution Order

- Phase 1 bloquea toda implementación.
- Phase 2 bloquea US1, US2 y US3.
- US1 entrega identidad de rol y estado seleccionado; US2 depende de ese estado para UI y autorización.
- US3 depende de persistencia/autorización fundacional, pero sus tests y UI pueden prepararse en paralelo tras US1.
- Polish requiere US1–US3 completas.

```text
Contract gate → Foundation → US1 → US2
                          └──────→ US3
US2 + US3 → Full validation
```

## Parallel Opportunities

- T004, T006 y T008 pueden avanzar en paralelo tras T003 cuando no editen los mismos ficheros.
- En US1, T010 y T011 pueden escribirse en paralelo.
- En US2, T017, T018 y T019 son independientes.
- En US3, T026, T027 y T028 son independientes; tras API estable, UI de invitación y miembros puede dividirse por componente.
- T037 y T038 pueden hacerse en paralelo antes de validación completa.

## Implementation Strategy

1. Completar primero el gate contractual y la persistencia/autorización compartida.
2. Entregar US1 como primer incremento: roles visibles y Administración equivalente al comportamiento actual.
3. Añadir las denegaciones exhaustivas de US2 sin tocar permisos operativos.
4. Completar US3 con invitación, módulo posterior y protección del último Administrador.
5. Ejecutar validación estrecha tras cada historia y suites completas al final.

## Format Validation

Las 44 tareas usan checkbox, ID secuencial, marcador `[P]` solo cuando procede, etiqueta `[USn]` en fases de historia y rutas concretas.
