# Implementation Plan: Navegación por warehouses y perfil de usuario

**Branch**: `002-warehouse-navigation-profile` | **Date**: 2026-08-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/changes/008-warehouse-navigation-profile/spec.md`

## Summary

Integrar la selección y gestión de warehouses en el shell autenticado, persistir un warehouse predeterminado por usuario y resolver la entrada a la aplicación sin bucles. El backend ampliará el perfil y los resúmenes autorizados, y hará cumplir la creación solo para cuentas sin membresías o con alguna administración. El frontend añadirá rutas de Perfil/Warehouses independientes de la selección activa, moverá las funciones personales desde Settings y compactará las acciones móviles con `pan-y` y cancelación por movimiento.

## Technical Context

**Language/Version**: Python 3.11+; TypeScript 5.8; Angular 20
**Primary Dependencies**: FastAPI, SQLAlchemy 2.x, Alembic, Pydantic; Angular Material, Angular Service Worker, RxJS
**Storage**: PostgreSQL production / SQLite development; `users.default_warehouse_id` nullable plus existing localStorage active selection
**Testing**: pytest + FastAPI TestClient; Vitest Angular TestBed; Angular production build; targeted manual touch validation
**Target Platform**: Containerized Linux web API and responsive PWA in current evergreen desktop/mobile browsers
**Project Type**: Web application with backend API and Angular frontend
**Performance Goals**: Integrated warehouse overview completes in one client load with bounded aggregate queries; app entry resolves with no redirect loops; touch scrolling remains native and responsive
**Constraints**: Per-warehouse authorization, no authenticated API caching in service worker, 320px minimum viewport, email read-only, existing roles only, online-first behavior
**Scale/Scope**: Domestic/shared inventory scale; one new nullable field, three account operations, one overview resource, two integrated pages and one shared card interaction redesign

## Constitution Check

*GATE: Passed before research and re-checked after design against constitution v1.1.0.*

| Principle | Gate | Result |
|-----------|------|--------|
| I. Code / contracts | Active app contract is the baseline and will be updated before code | PASS |
| II. Manifest-driven | `008-warehouse-navigation-profile` is active with context pack | PASS |
| III. Contract before impl | Contract sync is the first implementation-gate task | PASS |
| IV. Incremental changes | All artifacts live under `specs/changes/008-warehouse-navigation-profile/` | PASS |
| V. Tests | Backend authorization/migration/API and frontend guard/component tests are planned, followed by full suites/build | PASS |
| VI. Security | Membership, role-specific disclosure, locked creation eligibility and existing destructive confirmation are covered | PASS |
| VII. Simplicity | Existing services/components are extended; no global role, analytics subsystem or new state library | PASS |

**Post-design re-check**: PASS. Research and contracts add no constitutional violations.

## Project Structure

### Documentation (this feature)

```text
specs/changes/008-warehouse-navigation-profile/
├── spec.md
├── context-pack.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── api.md
│   └── ui.md
├── checklists/
│   ├── requirements.md
│   └── product.md
└── tasks.md
```

### Source Code (repository root)

```text
backend/
├── alembic/versions/20260820_0014_user_default_warehouse.py
├── app/
│   ├── models/user.py
│   ├── schemas/auth.py
│   ├── schemas/warehouse.py
│   └── api/v1/endpoints/
│       ├── auth.py
│       └── warehouses.py
└── tests/
    ├── test_auth_warehouses.py
    └── test_warehouse_navigation_profile.py

frontend/src/
├── styles.css
└── app/
    ├── routes.ts
    ├── auth/login.component.ts
    ├── core/
    │   ├── auth.guard.ts
    │   └── warehouse.guard.ts
    ├── invites/accept-invite.component.ts
    ├── items/item-card.component.ts
    ├── profile/profile.component.ts
    ├── services/
    │   ├── auth.service.ts
    │   └── warehouse.service.ts
    ├── settings/settings.component.ts
    ├── shell/shell.component.ts
    └── warehouses/warehouses.component.ts
```

**Structure Decision**: Preserve the existing FastAPI/Angular split and standalone Angular components. Extend the existing auth and warehouse services instead of adding another global state layer. Add focused backend/frontend test files where existing suites would become too broad.

## Technical Design

### Persistence and account profile

- Add nullable `users.default_warehouse_id` referencing `warehouses.id` with `ON DELETE SET NULL` and an index. The migration does not backfill; first app entry resolves a valid membership.
- Add `default_warehouse_id` to `/auth/me`, `PATCH /auth/me` for `display_name`, and `PUT /auth/me/default-warehouse` for explicit preference updates.
- The default update locks/loads the user and validates membership before assignment. Warehouse deletion explicitly clears the preference as a portable safeguard in addition to database referential behavior.

### Creation authorization

- Lock the current user row before evaluating memberships to serialize concurrent create attempts for that account.
- Permit creation when membership count is zero or at least one membership has role Administrator; otherwise return 403 before creating any warehouse data.
- On first creation, set the new warehouse as default. Later creations do not change an existing default.

### Warehouse overview

- Keep `GET /warehouses` as the membership list used by guards, adding `membership_created_at` for deterministic fallback.
- Add `GET /warehouses/overview` before the dynamic `/{warehouse_id}` route. It returns all accessible warehouses with aggregate counts and privacy-filtered members.
- Counts include active boxes/items, total current stock for active items and batches in non-terminal states. Members see display name and role; email is populated only when the requesting membership for that warehouse is Administrator.
- Use grouped aggregate subqueries plus a single membership/user query, avoiding one request per card and cross-tenant disclosure.

### Frontend navigation and state

- Make `/app` require authentication only. Put `/app/warehouses` and `/app/profile` directly under the shell; protect operational child routes individually with the selected-warehouse guard.
- Add an entry guard/component for `/app` that loads profile + memberships, validates the persisted default, chooses the oldest membership when necessary, persists the repaired default, selects it locally and routes to Home. If none exist, route to `/app/warehouses`.
- Preserve explicit invite redirects. Invite acceptance selects and opens the invited warehouse; it sets default only when no valid default existed.
- Convert selected warehouse id to reactive service state so header role/name and admin navigation refresh immediately after switching.

### Profile and role-aware PWA status

- Cache the authenticated user in `AuthService` as reactive state, load it in shell/profile, and update it after profile mutation.
- Header exposes user name/email with Perfil and Cerrar sesión; the active warehouse affordance links to the integrated warehouse view.
- Profile contains display-name editing, read-only email, existing password change and PWA controls.
- PWA summary always exposes installation, current version, detected version and last check. Full existing diagnostic fields/hints appear only when the selected membership is Administrator.
- Settings retains only warehouse administration: SMTP, LLM, sync, conflicts and transfer.

### Scroll-safe compact mobile actions

- Desktop preserves current quick actions. Mobile keeps stock and favorite visible and moves edit/reprocess/delete into a Material menu.
- Explicit `touch-action: pan-y` applies to mobile action surfaces and nested touch targets.
- A small reusable pointer-intent handler records pointer-down coordinates and suppresses a subsequent action when movement reaches 12px; it never calls `preventDefault` for vertical movement and does not interfere with keyboard-generated clicks.
- Tests cover moved gestures, valid taps, single emissions, role-hidden reprocess action and accessible names. Manual validation covers real browser scrolling because simulated unit events do not prove compositor scrolling.

## Delivery and Validation Strategy

1. Update the active app contract.
2. Add failing backend tests for migration, profile/default behavior, creation authorization and overview privacy/counts.
3. Implement backend persistence and APIs; run narrow pytest files.
4. Add failing frontend tests for routing/default resolution, integrated pages/profile and item-card gestures.
5. Implement frontend navigation/pages and mobile interaction; run narrow Vitest files.
6. Run full backend pytest, full frontend test suite and production build.
7. Perform 320px and real/coarse-pointer manual checks from `quickstart.md`.
8. Archive the completed change and clear manifest active pointers only after all tasks pass.

## Complexity Tracking

No constitutional violations or additional architectural layers are required.
