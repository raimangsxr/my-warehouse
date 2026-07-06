# my-warehouse Agent Instructions

Governed by `.specify/memory/constitution.md` (v1.0.0). This file is the runtime shortcut for agents.

## SDD policy

1. Start every SDD task from `specs/manifest.yml`.
2. Do not scan all specs by default.
3. **Code wins on conflict:** if docs disagree with `backend/` or `frontend/`, treat the code as current behavior and update the contract.
4. Treat `specs/contracts/**/contract.md` as the source of truth for **documented** behavior (must stay aligned with code).
5. Treat `specs/changes/**` as incremental records.
6. Read `context-pack.md` for the active change before planning or implementation.
7. Do not read `specs/archive/**` unless explicitly justified.
8. **Do not use root `specs.md`** — it is deprecated historical archive only.
9. If behavior changes intentionally, update the affected active contract **before** implementation.
10. Keep `specs/manifest.yml` synchronized with new contracts, moved paths, and change status.
11. Run narrow tests first, then broader validation.

See `specs/README.md` for the full precedence table and `.specify/memory/constitution.md` for governance principles.

## Active SDD work

- Active contract: `specs/contracts/app/contract.md`
- No active change (last completed: `specs/archive/002-delete-warehouse/`)

## Suggested flow

`specify -> clarify -> checklist -> plan -> tasks -> analyze -> implement`
