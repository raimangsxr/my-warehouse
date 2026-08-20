# Tasks: Entrega SMTP e invitaciones fiables

## Phase 1 — Setup and contract gate

- [x] T001 Update SMTP and invite/auth behavior before implementation in `specs/contracts/app/contract.md`
- [x] T002 Validate SDD artifacts and HTTP delta consistency in `specs/changes/006-smtp-invite-delivery/`

## Phase 2 — Foundational mail transport

- [x] T003 Add validated SMTP encryption and email address schema constraints in `backend/app/schemas/setting.py` and `backend/app/schemas/warehouse.py`
- [x] T004 Write transport unit coverage for plain, STARTTLS, SSL, authentication and sanitized failure cases in `backend/tests/test_smtp_mailer.py`
- [x] T005 Implement the reusable synchronous SMTP message transport in `backend/app/services/smtp_mailer.py`

## Phase 3 — User Story 1: Real SMTP test

**Independent test**: A mocked SMTP server records a real message attempt and endpoint failures produce a sanitized non-success response.

- [x] T006 [US1] Replace simulated SMTP endpoint assertions with real transport success/failure assertions in `backend/tests/test_slice6_settings_llm_smtp.py`
- [x] T007 [US1] Wire real delivery and safe HTTP error mapping into `backend/app/api/v1/endpoints/settings.py`
- [x] T008 [P] [US1] Cover SMTP test loading, success and backend error details in `frontend/src/app/settings/settings.component.spec.ts`
- [x] T009 [US1] Surface the actual SMTP test result without false success in `frontend/src/app/settings/settings.component.ts`

## Phase 4 — User Story 2: Invitation email delivery

**Independent test**: Creating an emailed invitation returns `sent` when transport succeeds and preserves a usable manual link with `failed`/`not_configured` otherwise.

- [x] T010 [P] [US2] Add invite response delivery states and email message assertions in `backend/tests/test_slice5_invites_activity.py`
- [x] T011 [US2] Extend the invite response contract with delivery status/message in `backend/app/schemas/warehouse.py`
- [x] T012 [US2] Send the invitation after commit and preserve 201/link fallback on failure in `backend/app/api/v1/endpoints/warehouses.py`
- [x] T013 [P] [US2] Extend invite response typing and UI state tests in `frontend/src/app/services/warehouse.service.ts` and `frontend/src/app/warehouses/warehouses.component.spec.ts`
- [x] T014 [US2] Display sent/not-configured/failed invite outcomes while keeping copyable link in `frontend/src/app/warehouses/warehouses.component.ts`

## Phase 5 — User Story 3: Reliable post-auth acceptance

**Independent test**: An invite with a PostgreSQL-style aware expiry is accepted, and a logged-out user reaches the same token after login or signup.

- [x] T015 [P] [US3] Add aware-UTC expiry, wrong-email and idempotency regression coverage in `backend/tests/test_slice5_invites_activity.py`
- [x] T016 [US3] Replace local naive clock usage with shared UTC normalization in `backend/app/api/v1/endpoints/warehouses.py`
- [x] T017 [P] [US3] Add redirect propagation tests for login/signup and invite result navigation in `frontend/src/app/auth/login.component.spec.ts`, `frontend/src/app/auth/signup.component.spec.ts`, and `frontend/src/app/invites/accept-invite.component.spec.ts`
- [x] T018 [US3] Preserve invite redirect across login/signup links and auto-login in `frontend/src/app/auth/login.component.ts` and `frontend/src/app/auth/signup.component.ts`
- [x] T019 [US3] Navigate directly into the selected garage after successful acceptance and retain differentiated errors in `frontend/src/app/invites/accept-invite.component.ts`

## Phase 6 — Validation and closeout

- [x] T020 Run focused backend tests from `specs/changes/006-smtp-invite-delivery/quickstart.md`
- [x] T021 Run full backend pytest suite from `backend/`
- [x] T022 Run frontend CI test suite and production build from `frontend/`
- [x] T023 Reconcile completed behavior and validation counts in `specs/contracts/app/contract.md` and `specs/changes/006-smtp-invite-delivery/tasks.md`
- [x] T024 Archive change 006 and clear active pointers in `specs/manifest.yml`

## Dependencies

```text
T001–T002 → T003–T005 → US1 (T006–T009)
                    └→ US2 (T010–T014)
T001–T002 ───────────→ US3 (T015–T019)
US1 + US2 + US3 → T020–T024
```

US1, US2 and US3 are independently testable after the foundational contract/service work. T008, T010/T013 and T015/T017 can proceed in parallel because they touch separate test surfaces.

## Implementation Strategy

1. Complete the contract gate and foundational transport.
2. Deliver the real SMTP test first as the diagnostic MVP.
3. Reuse the transport for invitations while preserving manual links.
4. Land the UTC and auth-continuation regression fixes.
5. Run narrow tests, then full backend/frontend validation and archive the change.
