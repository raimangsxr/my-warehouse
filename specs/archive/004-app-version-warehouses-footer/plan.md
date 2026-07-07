# Implementation Plan: App Version in Warehouses Footer

**Change**: `004-app-version-warehouses-footer` | **Date**: 2026-07-08 | **Spec**: [spec.md](./spec.md)  
**Constitution**: `.specify/memory/constitution.md` v1.1.0

## Summary

Añadir footer de versión en `/warehouses` e inyectar `APP_VERSION` en build Docker del frontend (patrón `kiosk-screen` CHG-037). Actualizar contratos `app` y `ops-platform`. Sin cambios de API ni dominio.

## Technical Context

**Language/Version**: TypeScript / Angular 20 (frontend only)

**Primary Dependencies**: Angular Material, Docker Buildx, GitHub Actions release workflow

**Testing**: `npm run build`; smoke manual en `/warehouses`; build Docker con `APP_VERSION` de prueba

**Constraints**: Default `dev` en repo; tag de release en imágenes prod; footer discreto con safe-area

**Scale/Scope**: ~6 archivos frontend/ops + contratos + artefactos SDD

## Constitution Check

| Principle | Status | Evidence |
|-----------|--------|----------|
| **I.** Code / contracts | PASS | Contratos `app` y `ops-platform` actualizados |
| **II.** Manifest-driven | PASS | Change `004` registrado en manifest |
| **III.** Contract before impl | PASS | Contratos redactados antes del código (reconciliado retroactivamente) |
| **IV.** Incremental changes | PASS | Artefactos en `specs/archive/004-app-version-warehouses-footer/` |
| **V.** Tests | PASS | `npm run build`; validación manual footer + Docker build arg |
| **VI.** Security | PASS | Sin secretos; versión pública en UI |
| **VII.** Simplicity | PASS | Copia patrón probado de kiosk-screen |

**Pre-implementation gate:** T0 (contratos) + `tasks.md` generado → proceed.  
**Pre-merge gate:** `npm run build` + smoke `/warehouses`.

## Implementation Order

```text
T0  specs/contracts/app/contract.md + ops-platform/contract.md
T1  frontend/scripts/write-app-version.mjs + app-version.ts
T2  frontend/Dockerfile + .github/workflows/release-images.yml
T3  frontend/src/app/warehouses/warehouses.component.ts
T4  npm run build + smoke
T5  Archive + manifest
```

## Project Structure

### Documentation (this change)

```text
specs/archive/004-app-version-warehouses-footer/
├── spec.md
├── context-pack.md
├── plan.md
├── tasks.md
└── checklists/requirements.md
```

### Source (this change)

```text
frontend/scripts/write-app-version.mjs
frontend/src/app/core/app-version.ts
frontend/src/app/warehouses/warehouses.component.ts
frontend/Dockerfile
.github/workflows/release-images.yml
specs/contracts/app/contract.md
specs/contracts/ops-platform/contract.md
```
