#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="${1:-$(basename "$PWD")}"
FIRST_CONTRACT="${2:-app}"
FIRST_CHANGE="${3:-001-initial-sdd-baseline}"

mkdir -p "specs/contracts/${FIRST_CONTRACT}"
mkdir -p "specs/changes/${FIRST_CHANGE}"
mkdir -p "specs/archive"

cat > specs/manifest.yml <<EOF
project: ${PROJECT_NAME}

contracts:
  - id: ${FIRST_CONTRACT}
    path: specs/contracts/${FIRST_CONTRACT}/contract.md
    status: active
    description: Current baseline behavior for the application.

changes:
  - id: ${FIRST_CHANGE}
    path: specs/changes/${FIRST_CHANGE}/
    status: active
    contract: ${FIRST_CONTRACT}
    description: Initial SDD baseline for documenting existing behavior.

active:
  change: specs/changes/${FIRST_CHANGE}/
  contract: specs/contracts/${FIRST_CONTRACT}/contract.md
  context_pack: specs/changes/${FIRST_CHANGE}/context-pack.md
EOF

cat > "specs/contracts/${FIRST_CONTRACT}/contract.md" <<EOF
# ${FIRST_CONTRACT} Contract

## Purpose

Describe the current behavior of this part of the system.

## Current Behavior

TODO: Document what the application already does.

## User Flows

TODO: List the main user flows.

## Data and State

TODO: Document important data models, state, persistence, and ownership.

## APIs / Interfaces

TODO: Document endpoints, commands, events, components, or public interfaces.

## Permissions and Access

TODO: Document roles, authentication, authorization, and visibility rules.

## Error Handling

TODO: Document expected errors, fallback states, and recovery behavior.

## Validation

TODO: Document relevant tests or manual checks.
EOF

cat > "specs/changes/${FIRST_CHANGE}/context-pack.md" <<EOF
# Context Pack: ${FIRST_CHANGE}

## Goal

Establish the initial SDD baseline for this project.

## Relevant Contract

- specs/contracts/${FIRST_CONTRACT}/contract.md

## Current Understanding

TODO: Summarize what is known about the current system.

## Files / Areas Likely Involved

TODO: List important directories, modules, services, components, or configs.

## Constraints

TODO: Add technical, product, design, migration, or compatibility constraints.

## Validation Plan

TODO: Add narrow validation commands first, then broader checks.
EOF

cat > "specs/changes/${FIRST_CHANGE}/spec.md" <<EOF
# Spec: ${FIRST_CHANGE}

## Problem

The project needs an initial SDD baseline so future changes can be planned and implemented against explicit behavior.

## Goals

- Document current system behavior.
- Establish the first active contract.
- Create a repeatable change workflow.

## Non-Goals

- Rewriting the application.
- Fully documenting every historical decision.

## Requirements

TODO: Add functional requirements for the baseline or next change.

## Acceptance Criteria

TODO: Add concrete criteria for accepting this change.
EOF

cat > "specs/changes/${FIRST_CHANGE}/plan.md" <<EOF
# Plan: ${FIRST_CHANGE}

## Approach

TODO: Describe the implementation or documentation approach.

## Steps

1. Review the current application structure.
2. Fill in the active contract.
3. Update the context pack.
4. Define validation commands.
5. Keep specs/manifest.yml synchronized.

## Risks

TODO: List risks, unknowns, or migration concerns.
EOF

cat > "specs/changes/${FIRST_CHANGE}/tasks.md" <<EOF
# Tasks: ${FIRST_CHANGE}

## Tasks

- [ ] Review the project structure.
- [ ] Document current behavior in specs/contracts/${FIRST_CONTRACT}/contract.md.
- [ ] Complete specs/changes/${FIRST_CHANGE}/context-pack.md.
- [ ] Complete specs/changes/${FIRST_CHANGE}/spec.md.
- [ ] Define validation commands.
- [ ] Update specs/manifest.yml if paths or statuses change.
EOF

cat > AGENTS.md <<EOF
# ${PROJECT_NAME} Agent Instructions

## SDD policy

1. Start every SDD task from \`specs/manifest.yml\`.
2. Do not scan all specs by default.
3. Treat \`specs/contracts/**/contract.md\` as the source of truth for current behavior.
4. Treat \`specs/changes/**\` as incremental records.
5. Read \`context-pack.md\` for the active change before planning or implementation.
6. Do not read \`specs/archive/**\` unless explicitly justified.
7. If behavior changes, update the affected active contract before implementation.
8. Keep \`specs/manifest.yml\` synchronized with new contracts, moved paths, and change status.
9. Run narrow tests first, then broader validation.

## Active SDD work

- Active change: \`specs/changes/${FIRST_CHANGE}/\`
- Active contract: \`specs/contracts/${FIRST_CONTRACT}/contract.md\`
- Context pack: \`specs/changes/${FIRST_CHANGE}/context-pack.md\`

## Suggested flow

\`specify -> clarify -> checklist -> plan -> tasks -> analyze -> implement\`
EOF

echo "SDD setup created for ${PROJECT_NAME}"
echo ""
echo "Created:"
echo "  specs/manifest.yml"
echo "  specs/contracts/${FIRST_CONTRACT}/contract.md"
echo "  specs/changes/${FIRST_CHANGE}/"
echo "  AGENTS.md"
echo ""
echo "Next step:"
echo "  Fill in specs/contracts/${FIRST_CONTRACT}/contract.md with the real current behavior."
