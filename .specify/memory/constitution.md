<!--
Sync Impact Report
- Version change: 1.0.0 (Kiosk Screen, erroneous) → 1.0.0 (my-warehouse, ratified)
- Modified principles: Full replacement — previous file was from another project template
- Added sections: Code precedence, deprecated specs.md, validation commands, my-warehouse stack
- Removed sections: Kiosk safety, mandatory docs/adr/, change-spec fields not used in manifest
- Templates: plan-template.md ✅ | tasks-template.md ✅ | AGENTS.md ✅ | specs/README.md ✅
- Deferred: docs/adr/ directory (use research.md per change until ADR folder is introduced)
-->

# my-warehouse Constitution

## Core Principles

### I. Code Precedence, Contracts Document

When documentation disagrees with `backend/` or `frontend/`, **the code defines current behavior** until an intentional change is specified and implemented. Active contracts under `specs/contracts/**/contract.md` MUST describe agreed, testable behavior and MUST stay aligned with the code after each accepted change. Root `specs.md` is deprecated historical archive and MUST NOT be used for planning or implementation.

### II. Manifest-Driven Context

Every SDD task MUST start from `specs/manifest.yml`. Agents MUST NOT scan all specs, archives, or changes by default. Read only the active contract, active change (`specs/changes/**` or `specs/archive/**` when explicitly justified), and its `context-pack.md` unless the task requires broader scope.

### III. Contract Before Implementation

If a change alters user-visible behavior, API behavior, data persistence, security, media storage, sync/offline behavior, or deployment assumptions, the affected active contract MUST be updated **before** implementation begins. `specs/manifest.yml` MUST stay synchronized with contract paths and change status.

### IV. Incremental Changes

Feature work lives under `specs/changes/NNN-<slug>/` (spec, plan, tasks, research, contracts, context-pack). Completed changes move to `specs/archive/`. Change artifacts describe intent and delivery record; durable product behavior lives in active contracts.

### V. Tests and Validation

Every changed behavior MUST have automated tests or an explicit manual validation step with rationale in the change tasks. Prefer backend pytest for API and data rules; run narrow tests first, then full `uv run pytest` and `npm run build`. New endpoints and destructive operations (e.g., warehouse deletion) MUST include integration tests.

### VI. Security and Multi-Tenancy

Secrets (SMTP, LLM API keys) MUST remain encrypted in the backend only. All warehouse-scoped operations MUST enforce membership. User-facing errors MUST NOT expose internal paths, stack traces, or secrets. Destructive actions MUST require explicit confirmation aligned with the feature spec.

### VII. Simplicity and Minimal Scope

Implement the smallest correct diff. Avoid drive-by refactors, speculative abstractions, and scope creep. Match existing conventions in surrounding code. Research and plan artifacts (`research.md`, `data-model.md`) support the active change; avoid duplicating long-lived truth outside active contracts without justification.

## Additional Constraints

- **Stack:** Backend — FastAPI, SQLAlchemy 2.x, Alembic, PostgreSQL (prod) / SQLite (dev). Frontend — Angular 20, Angular Material, TypeScript, PWA service worker.
- **Structure:** `backend/app/`, `frontend/src/app/`, `specs/`, `deploy/k8s/`.
- **Language:** User-facing UI copy in Spanish unless a feature spec states otherwise.
- **Media:** Item and intake photos under backend `media_root`; never cache authenticated API responses in the service worker.
- **Validation defaults:** `cd backend && uv run pytest` and `cd frontend && npm run build`.

## Development Workflow

1. Read `specs/manifest.yml` and active `context-pack.md`.
2. Read affected `specs/contracts/**/contract.md`.
3. Create or update change under `specs/changes/NNN-<slug>/` via Spec Kit (`speckit-specify` → clarify → plan → tasks).
4. Update active contract before implementation when behavior changes.
5. Implement on a feature branch; keep code and contract aligned.
6. Run narrow tests, then full validation.
7. On change completion: update contract if needed, move change to `specs/archive/`, update `manifest.yml`.

Suggested Spec Kit sequence: `specify → clarify → checklist → plan → tasks → analyze → implement`.

## Governance

This constitution is the governing document for SDD process and quality gates in my-warehouse. `AGENTS.md` and `specs/README.md` provide agent/runtime shortcuts and MUST remain consistent with this file.

**Amendments:** Update this file with a version bump (semver), set `Last Amended` to the change date, and sync affected templates (`plan-template.md`, `tasks-template.md`) and `AGENTS.md` when workflow rules change.

**Compliance:** Implementation plans MUST include a Constitution Check section referencing principles I–VII. Violations MUST be justified in Complexity Tracking or resolved before implementation.

**Version**: 1.0.0 | **Ratified**: 2026-07-06 | **Last Amended**: 2026-07-06
