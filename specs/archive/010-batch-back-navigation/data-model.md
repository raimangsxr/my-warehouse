# Data Model: Navegación padre en lotes

No cambian entidades ni persistencia.

## View context

| Value | Source | Meaning |
|-------|--------|---------|
| `boxId` | Query param existente de `/app/batches` | Caja padre cuando el listado se abre desde detalle de caja |

Si `boxId` no existe, el padre del listado es `/app/home`.
