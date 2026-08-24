# Implementation Plan: Navegación padre en lotes

**Branch**: `004-batch-back-navigation` | **Date**: 2026-08-24 | **Spec**: [spec.md](spec.md)

## Summary

Añadir controles de retorno visibles y deterministas en lista y detalle de lotes. El listado deriva su padre del `boxId` ya disponible y usa Inicio como fallback; el detalle enlaza siempre al listado.

## Technical Context

**Language/Version**: TypeScript 5.8

**Primary Dependencies**: Angular 20, Angular Router, Angular Material 20

**Storage**: N/A

**Testing**: Vitest 3.2 mediante Angular test builder

**Target Platform**: Aplicación web responsive/PWA

**Project Type**: Frontend Angular dentro de aplicación web

**Performance Goals**: Sin nuevas solicitudes ni estado persistente

**Constraints**: Enlaces directos, copia española, accesibilidad y cabeceras responsive

**Scale/Scope**: Dos componentes y sus pruebas existentes

## Constitution Check

| Principle | Result | Rationale |
|-----------|--------|-----------|
| I. Code / contracts | PASS | El contrato activo se actualiza antes del producto |
| II. Manifest-driven | PASS | Manifiesto y context pack apuntan a 010 |
| III. Contract before impl | PASS | T001 es el gate contractual |
| IV. Incremental changes | PASS | Artefactos completos en `specs/changes/010-batch-back-navigation/` |
| V. Tests | PASS | Pruebas de ambos componentes, suite y build |
| VI. Security | PASS | No cambian permisos, datos ni secretos |
| VII. Simplicity | PASS | Se reutilizan RouterLink y el query param existente |

**Post-design re-check**: PASS; sin excepciones.

## Project Structure

```text
frontend/src/app/items/
├── intake-batches.component.ts
├── intake-batches.component.spec.ts
├── item-intake-batch.component.ts
└── item-intake-batch.component.spec.ts

specs/contracts/app/contract.md
specs/changes/010-batch-back-navigation/
```

**Structure Decision**: Implementación local en las dos superficies existentes; no se crea componente ni servicio compartido porque solo hay dos destinos simples y distintos.

## Implementation Design

1. Documentar los padres lógicos en el contrato activo.
2. Guardar el `boxId` de contexto en el listado y exponer destino/texto deterministas.
3. Añadir un enlace visible en la cabecera del listado hacia caja o Inicio.
4. Importar navegación declarativa y añadir «Volver a lotes» en la cabecera del detalle.
5. Probar ambos destinos, acceso sin contexto y presencia de los controles.

## Complexity Tracking

No hay violaciones que justificar.
