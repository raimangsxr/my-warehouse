# Context Pack: Navegación padre en lotes

## Active contract

- `specs/contracts/app/contract.md`, sección **IA**.

## Current behavior

- `frontend/src/app/items/intake-batches.component.ts` no muestra retorno en la cabecera; recibe `boxId` cuando se abre desde una caja.
- `frontend/src/app/items/item-intake-batch.component.ts` no importa `RouterLink` ni muestra retorno en el detalle.
- `frontend/src/app/boxes/box-detail.component.ts` abre el listado con `boxId` y `lockBox=1`.
- El shell ofrece navegación global, pero en móvil queda detrás del menú y no expresa la jerarquía padre.

## Scope

- Retorno visible en listado y detalle de lotes.
- Listado: caja de contexto si existe; Inicio si no existe.
- Detalle: listado de lotes.
- Pruebas de componente de los destinos y textos.

## Out of scope

- Navegación padre global para el resto de rutas.
- Historial persistente, breadcrumbs globales o un nuevo servicio de navegación.
- Cambios de API o persistencia.
