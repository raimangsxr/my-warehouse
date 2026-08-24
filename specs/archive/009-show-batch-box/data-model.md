# Data Model: Mostrar caja en la lista de lotes

## Existing entity: IntakeBatch

No se introducen entidades, campos, validaciones ni transiciones nuevas.

| Field | Existing meaning | Use in this change |
|-------|------------------|--------------------|
| `id` | Identidad del lote | Generar el título fallback si `name` es nulo |
| `name` | Nombre opcional del lote | Título principal cuando está disponible |
| `target_box_id` | Identidad de la caja destino | Mantener la asociación; no se muestra como texto técnico |
| `target_box_name` | Nombre actual y opcional de la caja destino | Contexto visible junto al título del lote |

## Relationship

Cada lote pertenece a una única caja destino. La vista usa el nombre resuelto de esa relación que ya acompaña al lote.

## Null handling

- `name = null`: se mantiene `Lote {prefijo de id}`.
- `target_box_name = null`: se omite la etiqueta de caja y se conserva el resto de la fila.
