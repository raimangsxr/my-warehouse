# Tasks: 004-app-version-warehouses-footer

**Spec:** [spec.md](./spec.md) | **Plan:** [plan.md](./plan.md)

## Phase 0 — Contract (blocking)

- [x] T0.1 Actualizar `specs/contracts/ops-platform/contract.md` (`APP_VERSION`, `write-app-version.mjs`, release workflow)
- [x] T0.2 Actualizar `specs/contracts/app/contract.md` (footer `/warehouses`, fuente `APP_VERSION`)
- [x] T0.3 Registrar change en `specs/manifest.yml`

## Phase 1 — Build injection

- [x] T1.1 Crear `frontend/scripts/write-app-version.mjs`
- [x] T1.2 Establecer default `dev` en `frontend/src/app/core/app-version.ts`
- [x] T1.3 Añadir `ARG APP_VERSION` y script en `frontend/Dockerfile` (stage `build`)
- [x] T1.4 Pasar `APP_VERSION=${{ github.event.release.tag_name }}` en `release-images.yml`

## Phase 2 — UI

- [x] T2.1 Footer `Versión {{ appVersion }}` en `warehouses.component.ts`
- [x] T2.2 Estilos: pie discreto, safe-area, layout flex min-height

## Phase 3 — Validación

- [x] T3.1 `cd frontend && npm run build`
- [x] T3.2 Verificar script: `APP_VERSION=9.9.9-test node scripts/write-app-version.mjs`

## Phase 4 — Cierre SDD

- [x] T4.1 Mover artefactos a `specs/archive/004-app-version-warehouses-footer/`
- [x] T4.2 Actualizar `specs/manifest.yml` (`active.change: null`, change completed)
- [x] T4.3 Reforzar reglas agente (AGENTS.md, `.cursor/rules/`, constitution v1.1.0)

## Dependency Graph

```text
T0 → T1 → T2 → T3 → T4
```
