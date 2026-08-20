# Requirements Checklist: Warehouse role authorization

**Purpose**: Review completeness, clarity and consistency of role, migration and authorization requirements.
**Created**: 2026-08-20
**Feature**: [spec.md](../spec.md)

## Requirement Completeness

- [x] CHK001 Are exactly two roles and their per-warehouse scope explicitly defined? [Completeness, Spec §FR-001, §FR-003]
- [x] CHK002 Are all existing operational inventory capabilities assigned to both roles? [Completeness, Spec §FR-005, Permission Matrix]
- [x] CHK003 Are invitations, member management, deletion and Settings explicitly assigned to Administrators only? [Completeness, Spec §FR-004, §FR-006, §FR-020]
- [x] CHK004 Are creation, acceptance and later role-change lifecycle requirements documented? [Completeness, Spec §FR-002, §FR-010, §FR-017, §FR-018]
- [x] CHK005 Is the migration rule for every existing membership deterministic? [Completeness, Spec §FR-014]

## Requirement Clarity

- [x] CHK006 Is “manage permissions” clarified as viewing fixed capabilities and changing role assignment, without overrides? [Clarity, Spec §FR-019, Assumptions]
- [x] CHK007 Is the Contributor restriction on the entire Settings surface unambiguous? [Clarity, Spec §FR-020, Permission Matrix]
- [x] CHK008 Is the invitation default and selectable role explicitly stated? [Clarity, Spec §FR-018]
- [x] CHK009 Is `created_by` clearly historical while deletion authorization belongs to every Administrator? [Clarity, Spec §FR-021, Permission Matrix]

## Requirement Consistency

- [x] CHK010 Do UI restrictions consistently remain secondary to backend authorization? [Consistency, Spec §FR-007, §FR-008]
- [x] CHK011 Do migration, invitation acceptance and role updates all preserve at least one Administrator? [Consistency, Spec §FR-012, §FR-014]
- [x] CHK012 Are fixed permission sets consistent with the requirement for exactly two roles? [Consistency, Spec §FR-001, §FR-019]

## Scenario and Edge Case Coverage

- [x] CHK013 Are users with different roles across warehouses addressed? [Coverage, User Story 1, User Story 2]
- [x] CHK014 Are direct unauthorized requests, stale UI state and concurrent changes addressed? [Coverage, Edge Cases, Spec §FR-007, §FR-013]
- [x] CHK015 Is last-Administrator protection specified for self-change and concurrent role updates? [Coverage, Edge Cases, Spec §FR-012]
- [x] CHK016 Are pending invitation roles protected from invitee tampering? [Coverage, Spec §FR-010]
- [x] CHK017 Are custom permissions, member removal and ownership transfer explicitly bounded out? [Scope, Out of Scope]

## Acceptance Criteria Quality

- [x] CHK018 Can administrative authorization be measured for both UI and direct requests? [Measurability, Spec §SC-001]
- [x] CHK019 Can operational regression coverage be measured for both roles? [Measurability, Spec §SC-002]
- [x] CHK020 Can cross-warehouse isolation and migration completeness be objectively evaluated? [Measurability, Spec §SC-003, §SC-005]

## Security and Dependencies

- [x] CHK021 Is backend enforcement required for every protected operation rather than relying on hidden UI? [Security, Spec §FR-007]
- [x] CHK022 Are atomic rejection and non-disclosure requirements stated for authorization failures? [Security, Spec §FR-013]
- [x] CHK023 Are membership and invitation persistence changes identified as dependencies? [Dependency, Key Entities, Context Pack]
