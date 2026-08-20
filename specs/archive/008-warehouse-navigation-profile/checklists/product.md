# Product Requirements Checklist: Warehouse navigation and profile

**Purpose**: Review product, authorization, UX and recovery requirement quality before technical planning
**Created**: 2026-08-20
**Feature**: [spec.md](../spec.md)
**Audience**: Author and PR reviewer
**Depth**: Standard release gate

## Requirement Completeness

- [x] CHK001 Are authenticated routes that must work without an active warehouse explicitly identified? [Completeness, Spec §FR-001–FR-002]
- [x] CHK002 Are active-versus-default warehouse responsibilities and mutations defined separately? [Completeness, Spec §FR-003–FR-010]
- [x] CHK003 Are creation and administrative permissions specified for zero-membership, administrator and contributor-only users? [Completeness, Spec §FR-011–FR-014]
- [x] CHK004 Are warehouse summary fields and member visibility requirements enumerated? [Completeness, Spec §FR-015–FR-018]
- [x] CHK005 Are profile fields, password ownership and PWA information levels fully bounded? [Completeness, Spec §FR-019–FR-025]
- [x] CHK006 Are mobile action placement, gesture intent and non-touch access requirements all documented? [Completeness, Spec §FR-026–FR-030]

## Requirement Clarity

- [x] CHK007 Is the fallback warehouse selection order deterministic rather than described as merely automatic? [Clarity, Spec §FR-007]
- [x] CHK008 Is it clear that opening a warehouse does not implicitly change the default? [Clarity, Spec §FR-009]
- [x] CHK009 Is the administrator context for detailed PWA data tied to the active warehouse? [Clarity, Spec §FR-023–FR-024]
- [x] CHK010 Are deleted entities and terminal batches excluded unambiguously from displayed metrics? [Clarity, Spec §FR-017]
- [x] CHK011 Is a measurable movement threshold provided for distinguishing scroll from tap? [Clarity, Spec §SC-007]

## Requirement Consistency

- [x] CHK012 Do the creation rules consistently preserve first-warehouse bootstrap while denying contributor-only expansion? [Consistency, Spec §US-3, §FR-011–FR-013]
- [x] CHK013 Do member summary privacy rules align with per-warehouse administrative authorization? [Consistency, Spec §FR-014, §FR-016]
- [x] CHK014 Do shared mobile-card requirements align between Home and box detail without changing role restrictions? [Consistency, Spec §FR-026–FR-030]
- [x] CHK015 Does moving password controls out of Settings preserve the existing security outcome for session invalidation? [Consistency, Spec §US-4, §FR-021]

## Acceptance Criteria Quality

- [x] CHK016 Can direct-entry, switching and fallback outcomes be objectively verified for all membership states? [Measurability, Spec §SC-001–SC-003]
- [x] CHK017 Can authorization denial be measured without relying on UI visibility alone? [Measurability, Spec §SC-002]
- [x] CHK018 Is the simplified PWA information set countable and distinct from full diagnostics? [Measurability, Spec §SC-006]
- [x] CHK019 Are gesture and single-activation outcomes quantified for touch and keyboard input? [Measurability, Spec §SC-007–SC-008]
- [x] CHK020 Is the minimum supported mobile width explicitly measurable? [Measurability, Spec §SC-009]

## Scenario and Edge Case Coverage

- [x] CHK021 Are primary, alternate, denial, stale-data and zero-state warehouse flows covered? [Coverage, Spec §US-1–US-3, Edge Cases]
- [x] CHK022 Are invitation acceptance and default preservation covered together? [Coverage, Spec §FR-010]
- [x] CHK023 Are concurrent default updates assigned a deterministic resolution rule? [Coverage, Spec §Edge Cases]
- [x] CHK024 Are unsupported or failed PWA checks included without making profile unusable? [Coverage, Spec §Edge Cases, §FR-031]
- [x] CHK025 Are gesture starts on nested icon, ripple and expanded touch target addressed? [Coverage, Spec §Edge Cases]

## Security, Privacy and Accessibility

- [x] CHK026 Is server-side enforcement required for all new authorization boundaries? [Security, Spec §US-3, §FR-013–FR-014]
- [x] CHK027 Is member email disclosure restricted per target warehouse rather than by a global role? [Privacy, Spec §FR-016]
- [x] CHK028 Are keyboard access, focus visibility, accessible naming and exactly-once activation required for compact actions? [Accessibility, Spec §FR-029]
- [x] CHK029 Is email immutability in this scope stated consistently in stories, requirements and assumptions? [Privacy, Spec §US-4, §FR-020, Assumptions]

## Dependencies and Assumptions

- [x] CHK030 Is the account-level persistence assumption distinguished from device-local active selection? [Assumption, Spec §Assumptions]
- [x] CHK031 Are excluded identity, role, analytics and offline capabilities explicitly bounded? [Scope, Context Pack §Out of scope]
- [x] CHK032 Are existing administrative modules retained rather than silently duplicated in the warehouse summary? [Assumption, Spec §Assumptions]

## Review Result

- [x] CHK033 Are all high-impact product requirements ready for technical planning with no unresolved conflicts or ambiguity markers? [Readiness]
