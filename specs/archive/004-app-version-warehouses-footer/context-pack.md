# Context Pack: 004-app-version-warehouses-footer

## Task classification

- Type: change to existing contracts
- Affected contracts: `app`, `ops-platform`
- Requires contract update: yes
- Current status: completed (implemented 2026-07-08; artefactos SDD cerrados retroactivamente)

## Mandatory context

- `specs/manifest.yml`
- [spec.md](./spec.md)
- `specs/contracts/app/contract.md` — **actualizar antes de implementar** (footer UI)
- `specs/contracts/ops-platform/contract.md` — **actualizar antes de implementar** (build injection)
- Referencia externa: `../kiosk-screen/specs/changes/037-app-version-hall-footer/`

## Constraints

- Reutilizar patrón `write-app-version.mjs` + `ARG APP_VERSION` (no inventar mecanismo distinto).
- Default local `dev` en `app-version.ts` checked-in.
- Footer solo en `/warehouses` (no en shell `/app/*`).
- No cambiar flujo PWA de actualización en Settings/shell.

## Implementation order

```text
T0  specs/contracts/app/contract.md + ops-platform/contract.md
 → T1  frontend/scripts/write-app-version.mjs + app-version.ts default
 → T2  frontend/Dockerfile + release-images.yml
 → T3  warehouses.component.ts (footer)
 → T4  Validación (npm run build)
 → T5  Cierre SDD (archive, manifest)
```

## Code entrypoints

- `frontend/scripts/write-app-version.mjs`
- `frontend/src/app/core/app-version.ts`
- `frontend/src/app/warehouses/warehouses.component.ts`
- `frontend/Dockerfile`
- `.github/workflows/release-images.yml`
- `frontend/src/app/services/pwa.service.ts` (solo lectura; consume `APP_VERSION`)

## Validation

```bash
cd frontend && npm run build
cd frontend && APP_VERSION=9.9.9-test node scripts/write-app-version.mjs && npm run build
docker build -f frontend/Dockerfile --build-arg APP_VERSION=9.9.9-test --target prod frontend
```

## Plan

[plan.md](./plan.md) | [tasks.md](./tasks.md) | [checklists/requirements.md](./checklists/requirements.md)
