# my-warehouse Agent Instructions

Governed by `.specify/memory/constitution.md` (v1.1.0). This file is the runtime shortcut for agents.

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

See `specs/README.md` for the full precedence table, `.specify/memory/constitution.md` for governance principles, and `.specify/memory/agent-gates.md` for the SDD gate checklist.

## Mandatory Spec Kit flow (no exceptions)

For any task that changes **user-visible behavior**, **API**, **data**, **security**, **sync/offline**, **Docker/CI/release**, or **deployment**:

```
manifest.yml → speckit-specify → clarify → checklist → plan → tasks → analyze → implement
```

### Hard STOP — do not write product/ops code until:

| Gate | Requirement |
|------|-------------|
| G1 | `specs/manifest.yml` has `active.change` pointing to `specs/changes/NNN-<slug>/` |
| G2 | `context-pack.md` and `spec.md` exist for that change |
| G3 | `plan.md` and `tasks.md` exist (Phase 0 contract tasks at minimum) |
| G4 | Affected `specs/contracts/**/contract.md` updated **before** implementation tasks |
| G5 | User did not explicitly waive SDD for a docs-only or emergency hotfix (must document in change) |

If G1–G4 are not met: **stop**, run `/speckit-specify` (or create change retroactively), then proceed.

### Allowed without full change (narrow exceptions)

- Bugfix that restores documented contract behavior (no contract change) — still run tests.
- Pure Q&A / code reading — no SDD artifacts.
- Typo/formatting in docs unrelated to behavior.
- Emergency production hotfix **only** if user explicitly requests skip; must open retroactive change + contract sync immediately after.

## Active SDD work

- Active contracts: `specs/contracts/app/contract.md`, `specs/contracts/ops-platform/contract.md`
- No active change (last completed: `specs/archive/004-app-version-warehouses-footer/`)

## Suggested flow

`specify -> clarify -> checklist -> plan -> tasks -> analyze -> implement`

Skills: `.cursor/skills/speckit-*/SKILL.md` — read and follow the relevant skill **before** each phase.
