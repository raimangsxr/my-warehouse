# Implementation Plan: Entrega SMTP e invitaciones fiables

**Branch**: `codex/006-smtp-invite-delivery` | **Date**: 2026-08-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/changes/006-smtp-invite-delivery/spec.md`

## Summary

Implementar un servicio SMTP pequeño y reutilizable con la biblioteca estándar, usarlo tanto en el endpoint de prueba como después de persistir una invitación, y devolver un estado explícito de entrega sin sacrificar el enlace manual. Corregir la aceptación en PostgreSQL normalizando fechas UTC y conservar el destino de invitación también al pasar entre login y registro.

## Technical Context

**Language/Version**: Python >=3.11; TypeScript 5.8 / Angular 20

**Primary Dependencies**: FastAPI, SQLAlchemy 2.x, Python `smtplib`/`email`; Angular Router, RxJS

**Storage**: Existing PostgreSQL/SQLite tables `smtp_settings` and `warehouse_invites`; no migration

**Testing**: pytest with mocked SMTP transport; Vitest with Angular HTTP/router test utilities

**Target Platform**: Linux container backend and evergreen PWA browsers

**Project Type**: Web application with REST backend and Angular frontend

**Performance Goals**: SMTP calls fail within a 10-second connection/operation timeout; no background queue in this change

**Constraints**: Invite persistence must survive mail failure; secrets remain encrypted and are never returned/logged; support `starttls`, `ssl`, and `none`; preserve manual invite links and existing API consumers

**Scale/Scope**: One synchronous message per test/invite request; settings and invite/auth screens only

## Constitution Check

*GATE: Passed before Phase 0 research and re-checked after Phase 1 design.*

| Principle | Gate |
|-----------|------|
| I. Code / contracts | PASS — plan records current simulated/manual behavior and schedules the app contract update |
| II. Manifest-driven | PASS — manifest points to change 006 and its context pack |
| III. Contract before impl | PASS — Phase 0 task will update `specs/contracts/app/contract.md` before product code |
| IV. Incremental changes | PASS — all artifacts live under `specs/changes/006-smtp-invite-delivery/` |
| V. Tests | PASS — backend transport/API and frontend redirect/status tests plus full validation are planned |
| VI. Security | PASS — membership remains enforced and SMTP secrets are decrypted only inside the mail service and sanitized on failure |
| VII. Simplicity | PASS — standard library transport, no queue, no migration, narrow UI changes |

Post-design re-check: PASS. The API delta is backward-compatible, no new persistence is introduced, and failure semantics are explicit.

## Project Structure

### Documentation (this feature)

```text
specs/changes/006-smtp-invite-delivery/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/http-api.md
└── tasks.md
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── api/v1/endpoints/settings.py
│   ├── api/v1/endpoints/warehouses.py
│   ├── schemas/setting.py
│   ├── schemas/warehouse.py
│   ├── services/smtp_mailer.py
│   └── utils/datetime.py
└── tests/
    ├── test_slice5_invites_activity.py
    └── test_slice6_settings_llm_smtp.py

frontend/
└── src/app/
    ├── auth/login.component.ts
    ├── auth/signup.component.ts
    ├── invites/accept-invite.component.ts
    ├── services/warehouse.service.ts
    ├── warehouses/warehouses.component.ts
    └── **/*.spec.ts
```

**Structure Decision**: Mantener la separación existente FastAPI/Angular. El transporte SMTP se aísla como servicio backend puro para poder simularlo en tests y evitar duplicar conexión, autenticación y composición de mensajes en endpoints.

## Complexity Tracking

No hay violaciones ni complejidad adicional que justificar.
