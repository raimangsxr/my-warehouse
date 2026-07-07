# Specs (SDD Spec Kit)

Governance: [.specify/memory/constitution.md](../.specify/memory/constitution.md) (v1.1.0)

## Fuente de verdad

| Prioridad | Artefacto | Uso |
|-----------|-----------|-----|
| **1** | Código en `backend/` y `frontend/` | Comportamiento real del sistema |
| **2** | `specs/contracts/**/contract.md` | Especificación consolidada del comportamiento actual |
| **3** | `specs/changes/**` | Cambios incrementales (spec, plan, tasks, context-pack) |
| **4** | `specs/manifest.yml` | Índice de contratos y changes activos |
| ~~5~~ | `specs.md` (raíz) | **DEPRECADO** — solo archivo histórico; no usar para implementar |

## Regla de resolución de conflictos

Cuando un documento de specs **discrepa** del código:

1. **El código manda** para definir el comportamiento actual.
2. Actualizar el **contrato activo** para reflejar el código (no al revés, salvo que el cambio sea intencional).
3. Si el legacy `specs.md` contradice el contrato o el código, **ignorar el legacy**.
4. Los cambios de comportamiento futuros siguen el flujo SDD: contrato primero → implementación → tests.

## Flujo de trabajo (obligatorio)

```
manifest.yml → specify → clarify → checklist → plan → tasks → analyze → implement → archive
```

**Puerta dura:** no editar `backend/`, `frontend/`, `deploy/` ni workflows sin `active.change` en manifest y `tasks.md` generado. Ver `.cursor/rules/speckit-mandatory-flow.mdc`.

Ver `AGENTS.md` en la raíz del repositorio.

## Estructura

```
specs/
├── manifest.yml              # Índice
├── contracts/
│   ├── app/
│   │   └── contract.md       # Comportamiento de la aplicación
│   └── ops-platform/
│       └── contract.md       # Docker, compose, release workflows
├── changes/                  # Changes activos (vacío hasta el próximo)
└── archive/
    ├── 001-initial-sdd-baseline/
    ├── 002-delete-warehouse/
    ├── 003-dev-docker-setup/
    └── 004-app-version-warehouses-footer/   # Footer versión + APP_VERSION build (2026-07-08)
```

## Validación rápida

```bash
cd backend && uv run pytest
cd frontend && npm run build
```
