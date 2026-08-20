# Context Pack: Warehouse navigation, profile, summaries and mobile actions

**Change:** `008-warehouse-navigation-profile`
**Created:** 2026-08-20
**Contract:** `specs/contracts/app/contract.md`

## Confirmed product decisions

- Mobile item cards use the compact menu option: stock and favorite stay visible; edit, reprocess and delete move into a more-actions menu, with vertical scrolling preserved from controls.
- A user with zero memberships may create the first warehouse. Once memberships exist, creating another requires Administrator role in at least one existing warehouse.
- Profile allows editing display name; email is visible and read-only.
- Warehouse list is part of the authenticated app shell.
- Default warehouse is explicit and distinct from the currently opened warehouse.
- Normal users receive four PWA status fields; an Administrator of the active warehouse receives full diagnostics.

## Baseline implementation context

- `frontend/src/app/routes.ts` keeps `/warehouses` outside `ShellComponent`; the `/app` parent requires a selected warehouse.
- `WarehouseService` stores only the selected warehouse id in `localStorage`; users have no persisted default warehouse.
- Login without an explicit redirect navigates to `/warehouses`.
- Warehouse cards currently show name, id and role, and also host creation and invitation forms.
- Backend `POST /warehouses` currently permits every authenticated user to create a warehouse.
- Invitation, settings, member management and deletion already require Administrator role for the target warehouse.
- User data consists of email and optional display name. `/auth/me` is read-only; password change already exists.
- Password and PWA controls currently live in administrator-only Settings.
- `PwaService` already tracks installation, versions, last check, update errors and service-worker capability.
- Shared `ItemCardComponent` is used by Home and box detail. On mobile it exposes stock plus four quick actions across the card.
- Global button styling currently applies `touch-action: manipulation`; item actions have no explicit touch/pointer movement handling.

## Implementation outcome

- `/app` resolves the persisted default warehouse and only falls back to the oldest accessible membership when the default is absent or stale.
- Warehouse and profile views now live inside the authenticated shell and do not require an active warehouse.
- Warehouse creation is enforced at the API boundary: zero memberships may create the first warehouse; otherwise at least one Administrator membership is required.
- Warehouse cards expose active-content counts, stock, open batches and privacy-aware member context, with independent Open and Mark as default actions.
- Profile owns display-name editing, read-only email, password changes and role-aware PWA information.
- Mobile item cards retain stock and favorite actions and place edit, reprocess and delete in a compact menu, with vertical pan semantics and pointer-intent cancellation.
- Validation completed with 74 backend tests, 214 frontend tests, Ruff checks and a production Angular build.
- Browser validation at a 320×700 viewport confirmed a 320 px scroll container with no horizontal overflow, `pan-y` on mobile action surfaces, a 420 px scroll initiated over the action area, and the expected compact menu actions.

## Scope boundaries

### In scope

- Account-level default warehouse persistence and resolution.
- Integrated warehouse and profile routes that work without an active warehouse.
- Backend enforcement of warehouse creation eligibility.
- Per-warehouse operational summaries and privacy-aware member visibility.
- Header identity/menu and warehouse switching affordance.
- Moving personal password/profile and PWA status out of Settings.
- Compact, scroll-safe mobile item actions across shared item cards.
- Contract, migration, backend/frontend tests and build validation.

### Out of scope

- Editable email, avatars, account deletion or global platform-admin roles.
- Custom roles or permissions beyond Administrator and Contributor.
- Historical analytics dashboards or charts.
- Member removal/leave flows.
- A full offline-first redesign.
- Swipe actions or a bottom-sheet action model.

## Risk areas and required evidence

- Authorization must be tested directly at the API boundary, especially contributor-only creation attempts and member detail visibility.
- Migration must preserve all users and choose no default until resolution establishes a valid membership.
- Guards must not create redirect loops for users without warehouses or with stale selections.
- Switching active warehouse must refresh role-sensitive navigation without requiring a full logout.
- Aggregations must exclude soft-deleted content and terminal/deleted batches consistently.
- Touch handling must not break keyboard activation, router links, menus or duplicate action emissions.
- PWA feature detection must continue working when service workers or install prompts are unavailable.

## Likely affected areas

- Active application contract and manifest.
- User schema/model and database migration.
- Auth profile/default endpoints and warehouse listing/summary/create authorization.
- Angular routes, guards, shell/header, warehouse service/view, profile view and Settings.
- Shared item-card markup/styles/interaction behavior and its consumers.
- Backend and frontend automated test suites.
