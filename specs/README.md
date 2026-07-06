# Specs (SDD Spec Kit)

Governance: [.specify/memory/constitution.md](../.specify/memory/constitution.md)

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

## Flujo de trabajo

```
manifest.yml → context-pack.md → contract.md → spec/plan/tasks del change → implementar → validar
```

Ver `AGENTS.md` en la raíz del repositorio.

## Estructura

```
specs/
├── manifest.yml              # Índice
├── contracts/
│   └── app/
│       └── contract.md       # Contrato activo de la aplicación
├── changes/                  # Changes activos (vacío hasta el próximo)
└── archive/
    └── 001-initial-sdd-baseline/   # Baseline inicial (cerrado 2026-07-06)
        ├── context-pack.md
        ├── spec.md
        ├── plan.md
        └── tasks.md
```

## Validación rápida

```bash
cd backend && uv run pytest
cd frontend && npm run build
```
