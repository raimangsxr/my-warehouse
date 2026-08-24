# Requirements Checklist: Warehouse member access removal

**Purpose**: Review completeness, clarity, consistency and security of requirements for removing warehouse members.
**Created**: 2026-08-24
**Feature**: [spec.md](../spec.md)

**Note**: Standard-depth review gate for the author and PR reviewers, focused on authorization integrity and destructive-action UX.

## Requirement Completeness

- [x] CHK001 Is the authorized actor explicitly limited to an Administrator of the target warehouse? [Completeness, Spec §FR-001, §FR-003]
- [x] CHK002 Are both possible target roles explicitly covered without giving special status to the warehouse creator? [Completeness, Spec §FR-002]
- [x] CHK003 Are the effects on membership, account, shared content, history and future access all documented? [Completeness, Spec §FR-007, §FR-009]
- [x] CHK004 Is the affected default-warehouse preference included in the removal lifecycle? [Completeness, Spec §FR-008]
- [x] CHK005 Are confirmation, successful feedback and immediate list update requirements all defined? [Completeness, Spec §FR-005, §FR-006]

## Requirement Clarity and Consistency

- [x] CHK006 Is “eliminar a un miembro” unambiguously defined as deleting only the membership? [Clarity, Assumptions]
- [x] CHK007 Is “sea el rol que sea” consistently scoped to another member rather than self-removal? [Clarity, Spec §FR-002, §FR-004, Assumptions]
- [x] CHK008 Does the self-removal restriction remain consistent with the guarantee that one Administrator remains? [Consistency, Assumptions]
- [x] CHK009 Are UI visibility and server-side authorization requirements clearly separated? [Consistency, Spec §FR-001, §FR-003]
- [x] CHK010 Is successful removal consistently defined as a single membership deletion plus a single activity event? [Consistency, Spec §FR-006, §FR-011, §SC-005]

## Scenario and Edge Case Coverage

- [x] CHK011 Are primary scenarios documented separately for Contributor and Administrator targets? [Coverage, User Story 1]
- [x] CHK012 Are cancellation, missing-target and unauthorized-request outcomes explicitly covered? [Coverage, User Story 2, Spec §FR-003, §FR-010]
- [x] CHK013 Is concurrent removal of the same target addressed with a deterministic second outcome? [Coverage, Edge Cases]
- [x] CHK014 Is access revocation for an already authenticated removed member specified? [Security, Edge Cases, Spec §FR-007]
- [x] CHK015 Are account deletion, content deletion, invitation revocation, self-removal and new role systems explicitly bounded out? [Scope, Context Pack §Out of scope]

## Acceptance Criteria Quality

- [x] CHK016 Can the interaction cost of a confirmed removal be objectively measured? [Measurability, Spec §SC-001]
- [x] CHK017 Can successful access revocation be evaluated for both target roles? [Measurability, Spec §SC-002]
- [x] CHK018 Can rejection paths be evaluated for zero partial membership changes? [Measurability, Spec §SC-003]
- [x] CHK019 Can preference cleanup and activity recording be measured independently? [Measurability, Spec §SC-004, §SC-005]

## Non-Functional Requirements and Assumptions

- [x] CHK020 Are accessibility requirements defined for the destructive control on keyboard, mobile and desktop? [Accessibility, Spec §FR-012]
- [x] CHK021 Is the assumption that remaining Administrators need no additional last-admin check justified by the self-removal exclusion? [Assumption]
- [x] CHK022 Are atomicity expectations specified for missing or unauthorized targets? [Reliability, Spec §FR-003, §FR-010]

## Notes

- All items passed against the current specification; no additional checklist clarification was required.
