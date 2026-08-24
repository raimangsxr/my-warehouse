# Implementation Plan: Mostrar caja en la lista de lotes

**Branch**: `003-show-box-in-batch-list` | **Date**: 2026-08-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/changes/009-show-batch-box/spec.md`

## Summary

Mostrar el nombre de la caja destino junto al título de cada lote en `/app/batches`. El dato `target_box_name` ya está presente en el contrato técnico y en las respuestas actuales, por lo que el cambio se limita a documentar el comportamiento, presentar el campo con fallback nulo y cubrirlo con una prueba de componente.

## Technical Context

**Language/Version**: TypeScript 5.8

**Primary Dependencies**: Angular 20, Angular Material 20

**Storage**: N/A; no cambia persistencia

**Testing**: Vitest 3.2 mediante Angular test builder

**Target Platform**: Aplicación web responsive/PWA

**Project Type**: Aplicación web con frontend Angular y backend FastAPI existente

**Performance Goals**: Sin nuevas solicitudes de red y sin impacto perceptible en el listado

**Constraints**: Copia visible en español; conservar acciones y layout móvil; usar el `target_box_name` ya recibido

**Scale/Scope**: Un componente de listado, su prueba enfocada y el contrato activo de aplicación

## Constitution Check

*GATE: Evaluado antes de investigación y de nuevo tras el diseño.*

| Principle | Gate | Result |
|-----------|------|--------|
| I. Code / contracts | El plan parte del comportamiento real y actualizará el contrato activo | PASS |
| II. Manifest-driven | `specs/manifest.yml` apunta a este cambio y context pack | PASS |
| III. Contract before impl | La primera tarea de entrega actualiza `specs/contracts/app/contract.md` | PASS |
| IV. Incremental changes | Todos los artefactos viven en `specs/changes/009-show-batch-box/` | PASS |
| V. Tests | Se añadirá una prueba de componente y se ejecutarán test enfocado y build | PASS |
| VI. Security | No cambian autenticación, membresía, secretos ni operaciones destructivas | PASS |
| VII. Simplicity | Se reutiliza el campo existente sin API, modelo ni abstracciones nuevas | PASS |

**Post-design re-check**: PASS en los siete principios; no hay excepciones ni complejidad adicional.

## Project Structure

### Documentation (this feature)

```text
specs/changes/009-show-batch-box/
├── spec.md
├── context-pack.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── ui.md
├── checklists/
│   ├── requirements.md
│   └── ux.md
└── tasks.md
```

### Source Code (repository root)

```text
frontend/src/app/
├── items/
│   ├── intake-batches.component.ts
│   └── intake-batches.component.spec.ts
└── services/
    └── intake.service.ts              # referencia; no se prevé modificar

backend/app/
├── api/v1/endpoints/intake.py         # referencia; no se prevé modificar
└── schemas/intake.py                  # referencia; no se prevé modificar

specs/contracts/app/contract.md
```

**Structure Decision**: Cambio frontend localizado en el componente standalone existente; el backend ya entrega el dato necesario y solo se consulta para confirmar el contrato actual.

## Implementation Design

1. Actualizar la sección de lotes del contrato activo para exigir que el listado muestre la caja destino junto al nombre del lote y defina el fallback sin nombre.
2. Añadir al título de cada fila una etiqueta textual derivada de `batch.target_box_name`, condicionada a que exista.
3. Aplicar estilos de título que mantengan la asociación visual y permitan ajuste de línea en móvil sin afectar las acciones.
4. Ampliar la prueba de componente para cargar un lote y comprobar la presencia conjunta del nombre del lote y la caja; cubrir también el fallback nulo.
5. Ejecutar primero el spec del componente, después la suite frontend y finalmente el build.

## Complexity Tracking

No hay violaciones constitucionales que justificar.
