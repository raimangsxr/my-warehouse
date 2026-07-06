---
description: "Task list for permanent warehouse deletion (002-delete-warehouse)"
---

# Tasks: Eliminar almacén (warehouse)

**Input**: Design documents from `specs/changes/002-delete-warehouse/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/delete-warehouse-api.md, quickstart.md

**Tests**: Required per constitution Principle V — 9 integration tests in `backend/tests/test_delete_warehouse.py`

**Organization**: Tasks grouped by user story. **Phase 2 (contract) BLOCKS all implementation** per constitution Principle III. **All backend tests written before service/endpoint** (TDD).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Maps to user story from spec.md (US1–US4)
- Include exact file paths in descriptions

## Naming

| Concepto | Valor |
|----------|-------|
| SDD change | `002-delete-warehouse` |
| Git branch | `001-delete-warehouse` |

## Path Conventions

- **Backend**: `backend/app/`, `backend/tests/`
- **Frontend**: `frontend/src/app/`
- **SDD**: `specs/contracts/app/contract.md`, `specs/manifest.yml`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm dev environment before any code changes

- [x] T001 [P] Verify backend dependencies with `uv sync` in `backend/` per `specs/changes/002-delete-warehouse/quickstart.md`
- [x] T002 [P] Verify frontend dependencies with `npm install` in `frontend/` per `specs/changes/002-delete-warehouse/quickstart.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Update active contract **before any implementation code** (constitution Principle III)

**⚠️ CRITICAL**: No Phase 3+ work until T003 is complete

- [x] T003 Update `specs/contracts/app/contract.md` with DELETE warehouse flow: creator-only from `/warehouses`, `DELETE /api/v1/warehouses/{warehouse_id}` + `confirm_name`, English API `detail` / Spanish UI policy, 403/400/409/500 responses, media cleanup, client sync purge, offline-only-online, warehouse guard for co-members, feature matrix entry — consolidate from `specs/changes/002-delete-warehouse/contracts/delete-warehouse-api.md` and `specs/changes/002-delete-warehouse/data-model.md`

**Checkpoint**: Contract updated — backend and frontend implementation may begin

---

## Phase 3: User Story 1 — Eliminar un almacén que ya no necesito (Priority: P1) 🎯 MVP

**Goal**: Creador puede eliminar permanentemente un warehouse con todo su inventario y media; el almacén deja de existir para todos los miembros

**Independent Test**: Crear warehouse con cajas, artículos y fotos → eliminar con confirmación → no aparece en lista ni es accesible; media ausente; otros warehouses del usuario intactos

### Tests (ALL before implementation — T004–T011)

> **NOTE: Write T004–T011 FIRST; they MUST FAIL before T012–T014**

- [x] T004 [P] [US1] Add `test_creator_can_delete_warehouse` in `backend/tests/test_delete_warehouse.py` (200, not listed, media absent, **other user warehouses still listed** — FR-009)
- [x] T005 [P] [US1] Add `test_delete_removes_all_related_data` in `backend/tests/test_delete_warehouse.py` (sync tables, settings, boxes, items removed)
- [x] T006 [P] [US1] Add `test_delete_rollback_on_media_failure` in `backend/tests/test_delete_warehouse.py` (mock `shutil.rmtree` failure → 500, warehouse still exists — FR-008)
- [x] T007 [P] [US1] Add `test_delete_idempotent_404` in `backend/tests/test_delete_warehouse.py` (second DELETE after success → 404)
- [x] T008 [P] [US2] Add `test_wrong_confirm_name` in `backend/tests/test_delete_warehouse.py` (400 when `confirm_name` mismatch)
- [x] T009 [P] [US4] Add `test_non_creator_forbidden` in `backend/tests/test_delete_warehouse.py` (403 for member who is not `created_by`)
- [x] T010 [P] [US4] Add `test_co_member_loses_access` in `backend/tests/test_delete_warehouse.py` (second user cannot list/access after creator deletes)
- [x] T011 [P] [US4] Add `test_blocked_while_batch_processing` in `backend/tests/test_delete_warehouse.py` (409 when intake batch `status=processing`)

### Implementation for User Story 1

- [x] T012 [US1] Create `assert_can_delete_warehouse` and `delete_warehouse` in `backend/app/services/warehouse_delete.py` (processing check, explicit deletes per `specs/changes/002-delete-warehouse/research.md` R2, media `rmtree` before commit, rollback on media failure, `logger.info` audit per R7)
- [x] T013 [US1] Add `WarehouseDeleteRequest` schema with `confirm_name` field in `backend/app/schemas/warehouse.py`
- [x] T014 [US1] Add `DELETE /{warehouse_id}` endpoint calling `warehouse_delete` in `backend/app/api/v1/endpoints/warehouses.py` (membership + `created_by` check, English `detail` per research R10, no internal paths)

**Checkpoint**: All 9 backend tests pass: `cd backend && uv run pytest tests/test_delete_warehouse.py -q`

---

## Phase 4: User Story 2 — Confirmación explícita antes de borrar (Priority: P1)

**Goal**: Flujo UI con advertencia irreversible y confirmación por nombre exacto; acción solo visible para el creador en `/warehouses`; bloqueada sin red

**Independent Test**: Intentar eliminar sin nombre exacto → bloqueado; con nombre exacto → procede; no-creador no ve botón; offline → botón deshabilitado

### Implementation for User Story 2

- [x] T015 [US2] Add `delete(warehouseId: string, confirmName: string)` method in `frontend/src/app/services/warehouse.service.ts` calling `DELETE /api/v1/warehouses/{id}`
- [x] T016 [US2] Add delete button visible only when `warehouse.created_by === currentUser.id` (via `auth/me`) in `frontend/src/app/warehouses/warehouses.component.ts` — no delete in `/app/*` or settings (FR-001b, FR-001c)
- [x] T017 [US2] Add `MatDialog` confirmation with irreversible warning, exact-name input, disabled confirm until match, **disable delete when offline** (`navigator.onLine` or `SyncService` online flag) with Spanish message, Spanish UI copy and Spanish snackbars mapping API errors in `frontend/src/app/warehouses/warehouses.component.ts`

**Checkpoint**: Full confirmation flow works end-to-end from `/warehouses` for creator only; offline guard active

---

## Phase 5: User Story 3 — Comportamiento estable tras la eliminación (Priority: P2)

**Goal**: Tras borrar, el cliente queda coherente: sin selección del warehouse eliminado, sin cola offline obsoleta, co-miembros redirigidos si el warehouse ya no existe

**Independent Test**: Eliminar warehouse activo → limpia selección, lista actualizada; co-miembro en `/app/*` tras delete ajeno → snackbar español y redirect `/warehouses`

### Implementation for User Story 3

- [x] T018 [US3] Add `purgeWarehouse(warehouseId: string)` in `frontend/src/app/services/sync.service.ts` and `clearSelectedWarehouseId()` in `frontend/src/app/services/warehouse.service.ts` per `specs/changes/002-delete-warehouse/research.md` R8
- [x] T019 [US3] On successful delete: clear `mw_selected_warehouse_id` if it matches, call `purgeWarehouse()`, show Spanish success snackbar, refresh warehouse list in `frontend/src/app/warehouses/warehouses.component.ts`
- [x] T020 [US3] Create `warehouseSelectedGuard` in `frontend/src/app/core/warehouse.guard.ts` and register on `/app` routes in `frontend/src/app/routes.ts` — validate selection against `warehouseService.list()`; if missing → clear selection, Spanish snackbar «Este almacén ya no está disponible», redirect `/warehouses` (research R11, US3 co-member scenario)

**Checkpoint**: Deleting active warehouse or co-member navigation leaves users on valid `/warehouses` state

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Full validation, manual smoke, SDD closure

- [x] T021 Run narrow backend tests: `cd backend && uv run pytest tests/test_delete_warehouse.py -q`
- [x] T022 Run full backend suite: `cd backend && uv run pytest -q`
- [x] T023 Run frontend build: `cd frontend && npm run build`
- [x] T024 [P] Execute manual smoke test steps 1–7 in `specs/changes/002-delete-warehouse/quickstart.md` (incl. optional <30s timing observation — not a CI gate)
- [x] T025 Verify `specs/contracts/app/contract.md` reflects implemented behavior (reconcile if drift)
- [x] T026 Move `specs/changes/002-delete-warehouse/` to `specs/archive/002-delete-warehouse/` and set `status: completed` in `specs/manifest.yml`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS all user story phases**
- **User Stories (Phase 3–5)**: All depend on Phase 2 (T003 contract) completion
- **Polish (Phase 6)**: Depends on Phases 3–5 complete

### User Story Dependencies

- **User Story 1 (P1)**: After T003 — backend MVP; tests T004–T011 before T012–T014
- **User Story 2 (P1)**: After T014 (endpoint exists) — frontend confirmation
- **User Story 3 (P2)**: After T017 (delete flow in UI) — client cleanup + guard
- **User Story 4 (P2)**: Covered by tests T009–T011 in Phase 3 (before implementation)

### Within Phase 3 (TDD)

1. T004–T011 all tests (parallel where marked [P])
2. T012 → T013 → T014 implementation
3. Run full test file

### Parallel Opportunities

- T001 and T002 (setup) in parallel
- T004–T011 (all backend tests) in parallel after T003
- T015–T017 (US2 frontend) can start after T014 while polishing tests if needed
- T024 (manual smoke) parallel with T022–T023 once builds pass

---

## Parallel Example: Phase 3 Tests

```bash
# After T003 (contract), launch all backend tests together:
T004 test_creator_can_delete_warehouse
T005 test_delete_removes_all_related_data
T006 test_delete_rollback_on_media_failure
T007 test_delete_idempotent_404
T008 test_wrong_confirm_name
T009 test_non_creator_forbidden
T010 test_co_member_loses_access
T011 test_blocked_while_batch_processing

# Then sequentially: T012 → T013 → T014
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T002)
2. Complete Phase 2: Foundational contract (T003) — **mandatory gate**
3. Complete Phase 3: Tests T004–T011, then T012–T014
4. **STOP and VALIDATE**: `uv run pytest tests/test_delete_warehouse.py -q`
5. API-only MVP demo before UI

### Incremental Delivery

1. Setup + Contract (T001–T003) → gate cleared
2. US1 backend (T004–T014) → all 9 tests green → validate
3. US2 confirmation UI (T015–T017) → full creator flow → validate
4. US3 client state + guard (T018–T020) → stable post-delete UX → validate
5. Polish + SDD closure (T021–T026)

---

## Notes

- Branch `001-delete-warehouse` ≠ change folder `002-delete-warehouse` (see context-pack.md)
- API `detail` English; UI/snackbars Spanish (research R10)
- No Alembic migration in v1
- `[P]` tasks = different files, no incomplete dependencies
- Do not start T012 until T003 is complete and T004–T011 are written
