# Agent SDD gates (my-warehouse)

Short reference for agents. Full rules: `.cursor/rules/speckit-mandatory-flow.mdc`, constitution v1.1.0.

## Entry point for new work

```
/speckit-specify "<description>"
```

Then: clarify → checklist → plan → tasks → analyze → implement.

## Before editing product/ops code

```bash
# From repo root — must show active change, not null
grep -A3 '^active:' specs/manifest.yml
test -f specs/changes/<NNN-slug>/context-pack.md
test -f specs/changes/<NNN-slug>/tasks.md
```

## On completion

1. Mark all tasks `[x]` in `tasks.md`.
2. Move `specs/changes/NNN-<slug>/` → `specs/archive/NNN-<slug>/`.
3. Set `specs/manifest.yml` → `active.change: null`, `active.context_pack: null`.
4. Add completed entry under `changes:` in manifest.

## Retroactive reconciliation (when code landed without SDD)

1. Create archive record with spec, context-pack, plan, tasks (completed).
2. Sync contracts with code.
3. Update manifest.
4. Never use as excuse to skip gates on the next change.
