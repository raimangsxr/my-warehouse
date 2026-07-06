# Spec: 001-initial-sdd-baseline

## Problem

Existían specs discordantes: `specs.md` legacy describía comportamientos aspiracionales o desactualizados (offline-first, drag-drop, tablas normalizadas, EPICs sin marcar) que no coinciden con el código incorporado. Sin una regla clara de precedencia, futuros cambios podrían implementarse contra documentación incorrecta.

## Goals

- Establecer **código como prioridad** ante cualquier discordancia documental.
- Consolidar comportamiento real en `specs/contracts/app/contract.md`.
- Deprecar `specs.md` raíz con aviso explícito.
- Documentar qué **no** está implementado para evitar regresiones de expectativas.

## Non-Goals

- Implementar features faltantes (drag-drop, offline completo, etc.).
- Borrar `specs.md` sin confirmación del equipo (solo marcarlo deprecado).
- Migrar changelog histórico completo.

## Requirements

### R1 — Precedencia documental
`specs/README.md` y `AGENTS.md` definen: código > contrato > changes > specs.md deprecado.

### R2 — Contrato alineado al código
El contrato describe con precisión:
- online-first con cola offline limitada (no offline-first),
- mover cajas por selector (no DnD),
- tags/aliases JSON (no tablas),
- sync manual (no auto-reconnect),
- filtros Home reales,
- features ausentes explícitamente marcadas ❌.

### R3 — Legacy invalidado
`specs.md` lleva banner de deprecación; agentes y reglas Cursor apuntan al contrato SDD.

### R4 — Verificación
Tests backend y build frontend documentados y ejecutables.

## Acceptance Criteria

- [x] Regla "code wins" en `specs/README.md`, `AGENTS.md`, `.cursor/rules/specify-rules.mdc`.
- [x] Contrato revisado contra código (2026-07-05).
- [x] `specs.md` marcado DEPRECADO.
- [x] Lista explícita de no-implementado en contrato.
- [x] Revisión humana y cierre del change 001 (2026-07-06).
- [ ] Borrado de `specs.md` (opcional; permanece deprecado).

## Out of Scope (documented, not planned in 001)

| Item | Estado en código |
|------|------------------|
| Offline-first completo | ❌ |
| Drag-and-drop | ❌ |
| Virtual scroll | ❌ |
| Invites email automático | ❌ |
| Rate limiting | ❌ |
| Merge conflictos UI | ❌ |
| QR por artículo | ❌ fuera de alcance |

## Next Changes (sugeridos post-cierre)

Solo después de cerrar 001, abrir changes incrementales contra el contrato — nunca contra `specs.md`.
