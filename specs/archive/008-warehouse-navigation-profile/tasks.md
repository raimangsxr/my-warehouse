# Tasks: Navegación por warehouses y perfil de usuario

**Input**: Design documents from `specs/changes/008-warehouse-navigation-profile/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Required by the constitution for changed API, data, authorization, navigation and interaction behavior. Add narrow failing tests before each implementation slice.

## Phase 1: Contract Gate

**Purpose**: Align durable documented behavior before any product code changes.

- [x] T001 Update warehouse navigation, creation permissions, profile/PWA ownership, summaries, routes, client state and mobile item actions in `specs/contracts/app/contract.md`
- [x] T002 Validate `specs/manifest.yml`, `specs/changes/008-warehouse-navigation-profile/context-pack.md`, and `specs/contracts/app/contract.md` are mutually consistent

**Checkpoint**: Contract gate G4 passed; product code may begin only after tasks/analyze gates also pass.

---

## Phase 2: Foundational Data and Shared State

**Purpose**: Add the account preference and reactive client foundations used by multiple stories.

- [x] T003 [P] Add failing migration coverage for nullable default warehouse, referential cleanup and downgrade in `backend/tests/test_warehouse_navigation_profile.py`
- [x] T004 Add Alembic revision for `users.default_warehouse_id` in `backend/alembic/versions/20260820_0014_user_default_warehouse.py`
- [x] T005 Add default warehouse persistence to the User model in `backend/app/models/user.py`
- [x] T006 [P] Extend account and warehouse schemas for default id, profile update, membership timestamp and overview shapes in `backend/app/schemas/auth.py` and `backend/app/schemas/warehouse.py`
- [x] T007 [P] Add reactive authenticated-user state and profile/default methods in `frontend/src/app/services/auth.service.ts` and tests in `frontend/src/app/services/auth.service.spec.ts`
- [x] T008 Add reactive selected warehouse id/name/role, overview loading and deterministic fallback helpers in `frontend/src/app/services/warehouse.service.ts` and tests in `frontend/src/app/services/warehouse.service.spec.ts`

**Checkpoint**: Persistence/schema/client state foundation ready.

---

## Phase 3: User Story 1 — Entrada directa al predeterminado (Priority: P1) 🎯 MVP

**Goal**: Resolve a valid account default after authentication and enter Home without visiting the list.

**Independent Test**: Mark a default, sign out/in and land in its Home; stale defaults recover; zero-membership users reach integrated Warehouses.

- [x] T009 [P] [US1] Add failing backend tests for reading and updating valid/invalid default warehouses in `backend/tests/test_warehouse_navigation_profile.py`
- [x] T010 [P] [US1] Add failing frontend guard/route tests for valid, missing and stale defaults in `frontend/src/app/core/warehouse.guard.spec.ts` and `frontend/src/app/routes.spec.ts`
- [x] T011 [US1] Implement account default-warehouse read/update API in `backend/app/api/v1/endpoints/auth.py`
- [x] T012 [US1] Expose membership creation time from warehouse listing in `backend/app/api/v1/endpoints/warehouses.py`
- [x] T013 [US1] Refactor shell/operational route guards and add startup resolution in `frontend/src/app/routes.ts` and `frontend/src/app/core/warehouse.guard.ts`
- [x] T014 [US1] Route login, guest entry and authentication fallbacks through `/app` in `frontend/src/app/auth/login.component.ts`, `frontend/src/app/core/auth.guard.ts`, and `frontend/src/app/core/auth.interceptor.ts`
- [x] T015 [US1] Preserve invite opening while setting default only when absent in `frontend/src/app/invites/accept-invite.component.ts` and its spec
- [x] T016 [US1] Run narrow default/navigation tests from `backend/tests/test_warehouse_navigation_profile.py` and relevant frontend guard/auth specs

**Checkpoint**: Direct entry and zero/stale fallback work independently.

---

## Phase 4: User Story 2 — Cambiar y comprender warehouses (Priority: P1)

**Goal**: Integrate Warehouses into the shell with useful, privacy-aware summaries and separate open/default actions.

**Independent Test**: A contributor with two memberships opens the integrated page, sees correct metrics/member identities, switches active warehouse and marks a different default.

- [x] T017 [P] [US2] Add failing overview aggregation and per-role email privacy tests in `backend/tests/test_warehouse_navigation_profile.py`
- [x] T018 [P] [US2] Add failing integrated warehouse card, default/open and responsive-state tests in `frontend/src/app/warehouses/warehouses.component.spec.ts`
- [x] T019 [US2] Implement grouped accessible warehouse overview queries and privacy shaping in `backend/app/api/v1/endpoints/warehouses.py`
- [x] T020 [US2] Move warehouse route into the shell and retain a legacy redirect in `frontend/src/app/routes.ts`
- [x] T021 [US2] Redesign summary cards, active/default badges, member context and separate actions in `frontend/src/app/warehouses/warehouses.component.ts`
- [x] T022 [US2] Make shell warehouse name/role and switching navigation reactive in `frontend/src/app/shell/shell.component.ts` and `frontend/src/styles.css`
- [x] T023 [US2] Update warehouse deletion client flow to clear/reactively recover active/default state in `frontend/src/app/warehouses/warehouses.component.ts` and backend deletion handling in `backend/app/api/v1/endpoints/warehouses.py`
- [x] T024 [US2] Run narrow overview, warehouse component and shell tests

**Checkpoint**: Integrated switching and summaries work for both roles.

---

## Phase 5: User Story 3 — Creación autorizada (Priority: P1)

**Goal**: Permit first-warehouse bootstrap and administrator expansion while denying contributor-only accounts at the API boundary.

**Independent Test**: Zero-membership and administrator users create successfully; contributor-only user receives 403 and no partial records.

- [x] T025 [P] [US3] Add failing authorization, first-default and no-partial-write tests in `backend/tests/test_warehouse_navigation_profile.py`
- [x] T026 [P] [US3] Add failing creation-visibility tests for zero/admin/contributor-only states in `frontend/src/app/warehouses/warehouses.component.spec.ts`
- [x] T027 [US3] Implement serialized membership-based creation eligibility and first-default assignment in `backend/app/api/v1/endpoints/warehouses.py`
- [x] T028 [US3] Restrict creation/invitation/deletion UI per confirmed rules in `frontend/src/app/warehouses/warehouses.component.ts`
- [x] T029 [US3] Run narrow backend creation authorization and frontend visibility tests

**Checkpoint**: Contributor-only expansion is blocked independently of the UI.

---

## Phase 6: User Story 4 — Perfil de usuario (Priority: P2)

**Goal**: Let every authenticated user edit display name and change password from a profile opened through the header.

**Independent Test**: A contributor updates display name, sees read-only email and changes password without access to Settings.

- [x] T030 [P] [US4] Add failing profile mutation/normalization tests in `backend/tests/test_warehouse_navigation_profile.py`
- [x] T031 [P] [US4] Add failing profile form/password/header menu tests in `frontend/src/app/profile/profile.component.spec.ts` and `frontend/src/app/shell/shell.component.spec.ts`
- [x] T032 [US4] Implement display-name profile mutation in `backend/app/api/v1/endpoints/auth.py`
- [x] T033 [US4] Create integrated profile account/security page in `frontend/src/app/profile/profile.component.ts`
- [x] T034 [US4] Add user identity/Profile/logout menus to desktop and mobile header in `frontend/src/app/shell/shell.component.ts`
- [x] T035 [US4] Remove personal password controls and account copy from `frontend/src/app/settings/settings.component.ts` while retaining warehouse administration
- [x] T036 [US4] Run narrow backend profile, frontend profile, Settings and shell tests

**Checkpoint**: Account management no longer depends on warehouse administration.

---

## Phase 7: User Story 5 — Actualizaciones con detalle por rol (Priority: P2)

**Goal**: Give all users understandable update controls and administrators of the active warehouse full diagnostics.

**Independent Test**: Contributor/no-selection shows exactly four status fields; selected Administrator sees all existing diagnostics and both can check/apply when supported.

- [x] T037 [P] [US5] Add failing role-aware PWA presentation and action tests in `frontend/src/app/profile/profile.component.spec.ts`
- [x] T038 [US5] Move install/check/apply controls and simplified/full PWA states into `frontend/src/app/profile/profile.component.ts`
- [x] T039 [US5] Remove duplicate PWA sections/actions from `frontend/src/app/settings/settings.component.ts` and `frontend/src/app/shell/shell.component.ts`
- [x] T040 [US5] Run narrow profile, PWA service, Settings and shell tests

**Checkpoint**: Updates are available to all with appropriately scoped detail.

---

## Phase 8: User Story 6 — Scroll móvil seguro (Priority: P2)

**Goal**: Preserve native vertical scroll from every item action and compact secondary mobile operations.

**Independent Test**: Pointer movement ≥12px over every action scrolls/cancels; taps and keyboard activation execute once; desktop remains direct.

- [x] T041 [P] [US6] Add failing pointer-intent, compact-menu, role visibility, accessibility and exactly-once tests in `frontend/src/app/items/item-card.component.spec.ts`
- [x] T042 [US6] Implement pointer-intent tracking and mobile/desktop action variants in `frontend/src/app/items/item-card.component.ts`
- [x] T043 [US6] Apply vertical pan semantics to mobile actions and remove conflicting generic touch behavior in `frontend/src/styles.css` and `frontend/src/app/items/item-card.component.ts`
- [x] T044 [US6] Validate shared-card behavior in Home and box detail through `frontend/src/app/home/home.component.spec.ts` and `frontend/src/app/boxes/box-detail.component.spec.ts`
- [x] T045 [US6] Run narrow item-card, Home and box-detail tests and complete manual coarse-pointer checks from `specs/changes/008-warehouse-navigation-profile/quickstart.md`

**Checkpoint**: Mobile scroll and all item capabilities coexist without accidental actions.

---

## Phase 9: Cross-Cutting Validation and Completion

- [x] T046 Reconcile all changed behavior and validation counts in `specs/contracts/app/contract.md` and `specs/changes/008-warehouse-navigation-profile/context-pack.md`
- [x] T047 Run full backend suite with `cd backend && uv run pytest`
- [x] T048 Run full frontend suite with `cd frontend && npm run test -- --configuration=ci`
- [x] T049 Run production frontend build with `cd frontend && npm run build`
- [x] T050 Validate migration upgrade/downgrade and 320px/no-horizontal-scroll scenarios from `specs/changes/008-warehouse-navigation-profile/quickstart.md`
- [x] T051 Move the completed change to `specs/archive/008-warehouse-navigation-profile/`, update `.specify/feature.json`, and clear active pointers/status in `specs/manifest.yml`
- [x] T052 Review `git diff`, confirm no unrelated changes, and prepare the final commit/PR handoff

---

## Dependencies & Execution Order

- Phase 1 contract gate blocks every product code task.
- Phase 2 foundations block US1, US2 and US4; its backend/frontend tasks can proceed in parallel by file ownership.
- US1 establishes entry and reactive selection used by the integrated US2 view.
- US2 overview data enables the final creation/invitation presentation in US3.
- US3 backend authorization is independently testable once foundational model work exists.
- US4 establishes Profile; US5 then moves PWA behavior into it.
- US6 shares only shell CSS conventions and can be implemented after foundations, but is sequenced last to isolate interaction regressions.
- Completion requires every narrow checkpoint and all full validation gates.

### Parallel Opportunities

- Backend migration tests/schema and frontend auth state tests in Phase 2 touch separate projects.
- Within each story, backend contract tests and frontend component tests can be authored in parallel before implementation.
- US3 backend authorization and US4 backend profile mutation touch the same endpoint modules and therefore should remain sequential in a single-agent execution.
- Documentation reconciliation and test execution can overlap only when no files are being mutated; final archive remains last.

## Implementation Strategy

1. Complete contract and foundations.
2. Deliver US1 as the navigation MVP and validate all membership states.
3. Add integrated overview/switching (US2) and close creation permissions (US3).
4. Add Profile and role-aware PWA ownership (US4–US5).
5. Finish with isolated shared-card interaction work (US6).
6. Run all gates, reconcile contract, archive and hand off for commit/PR.

## Format Validation

- Total tasks: 52.
- Story tasks: US1 8, US2 8, US3 5, US4 7, US5 4, US6 5.
- All user-story tasks include `[US#]`; setup/foundation/completion tasks intentionally do not.
- `[P]` is used only for work in independent files or projects.
- Every task names an exact repository file or executable validation path.
