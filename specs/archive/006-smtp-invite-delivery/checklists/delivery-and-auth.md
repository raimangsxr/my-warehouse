# Requirements Checklist: SMTP delivery and invite authentication

**Purpose**: Review requirement completeness for SMTP delivery, partial failures, secrets and post-authentication invite handling.
**Created**: 2026-08-20
**Feature**: [spec.md](../spec.md)

## Requirement Completeness

- [x] CHK001 Are real-delivery requirements defined for both SMTP test and invitation messages? [Completeness, Spec §FR-001, §FR-004]
- [x] CHK002 Is the non-atomic outcome “invite created but email not sent” explicitly defined? [Completeness, Spec §FR-006]
- [x] CHK003 Are both login and registration continuation requirements documented? [Completeness, User Story 3]
- [x] CHK004 Is the manual-link fallback retained for unavailable SMTP? [Completeness, Spec §FR-006]

## Requirement Clarity

- [x] CHK005 Is the SMTP test recipient unambiguously identified as the address entered by the user? [Clarity, Spec §FR-001]
- [x] CHK006 Is ownership of SMTP configuration unambiguously scoped to the selected garage? [Clarity, Assumptions]
- [x] CHK007 Is email identity matching defined as normalized comparison rather than exact casing? [Clarity, Spec §FR-008, Edge Cases]
- [x] CHK008 Is the public URL dependency for invitation links explicitly stated? [Clarity, Spec §FR-005]

## Requirement Consistency

- [x] CHK009 Are successful invite creation and successful email delivery treated as distinct outcomes throughout the requirements? [Consistency, User Story 2, Spec §FR-006]
- [x] CHK010 Are the privacy requirements consistent across API responses, UI errors and logs? [Consistency, Spec §FR-003, §FR-011]
- [x] CHK011 Does the post-authentication destination preserve the same token used by the original invite URL? [Consistency, Spec §FR-007]

## Scenario and Edge Case Coverage

- [x] CHK012 Are connection, authentication, transport-security, timeout and recipient rejection failures covered as a scenario class? [Coverage, Edge Cases]
- [x] CHK013 Are invalid, expired, consumed, duplicate-membership and wrong-account invitations covered? [Coverage, User Story 3, Edge Cases]
- [x] CHK014 Is browser refresh during the authentication handoff covered? [Coverage, Edge Cases]
- [x] CHK015 Are behavior boundaries for mail queues, retries, bounce tracking and password recovery explicit? [Scope, Assumptions]

## Acceptance Criteria Quality

- [x] CHK016 Can successful SMTP test delivery be objectively distinguished from merely queuing or simulating a message? [Measurability, Spec §SC-001]
- [x] CHK017 Can invitation mail delivery and link usability be measured independently? [Measurability, Spec §SC-002, §SC-003]
- [x] CHK018 Can secret non-disclosure be evaluated across all specified failure paths? [Measurability, Spec §SC-005]

## Dependencies and Assumptions

- [x] CHK019 Is the external SMTP server identified as a dependency with explicit failure handling? [Dependency, User Story 1, Edge Cases]
- [x] CHK020 Is the existing per-garage SMTP configuration documented as an implementation constraint? [Assumption]
- [x] CHK021 Is synchronous delivery called out as a deliberate scope tradeoff with no automatic retry guarantee? [Assumption]
