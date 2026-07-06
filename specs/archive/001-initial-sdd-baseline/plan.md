# Plan: 001-initial-sdd-baseline

## Approach

Auditoría cruzada: leer `specs.md` legacy (estructura + epics + slices), explorar código backend/frontend, y consolidar en contrato SDD compacto que refleje **comportamiento real**, documentando explícitamente divergencias.

## Steps

1. ✅ Inventariar backend: endpoints, modelos, migraciones, tests.
2. ✅ Inventariar frontend: rutas, componentes, servicios, PWA/sync.
3. ✅ Comparar legacy vs código (drag-drop, tags, offline, EPIC checkboxes).
4. ✅ Redactar `specs/contracts/app/contract.md` como fuente de verdad.
5. ✅ Completar context-pack y spec del change.
6. ✅ Afianzar precedencia código > contrato; deprecar `specs.md`.
7. ✅ Revisión humana → cierre del change (2026-07-06). Retirada de `specs.md` opcional.

## Risks

| Riesgo | Mitigación |
|--------|------------|
| Pérdida de historial al borrar `specs.md` | Mantener hasta cierre explícito; changelog preservado en git |
| Contrato desactualizado en futuros PRs | Política SDD: actualizar contrato antes de implementar |
| Gaps no detectados | Validación con `pytest` + build como smoke |

## Outcome

Baseline SDD operativo. El equipo puede iniciar changes incrementales (`002-*`) contra el contrato sin releer el monolito legacy.
