# UI Contract: Lista de lotes

## Surface

Ruta: `/app/batches`

## Batch row title

- La cabecera de cada fila muestra el nombre visible del lote.
- Si `target_box_name` está disponible, la misma cabecera muestra una etiqueta `Caja: {target_box_name}` junto al nombre del lote.
- Si `target_box_name` es nulo, vacío o no está disponible, no se muestra una etiqueta de caja ni un identificador técnico.
- El nombre fallback del lote (`Lote {8 primeros caracteres del id}`) conserva el mismo tratamiento.
- El título y la etiqueta pueden ajustar línea en pantallas estrechas; las acciones de abrir y eliminar permanecen accesibles.

## Unchanged behavior

- Estado, antigüedad, contadores, orden, creación, apertura y eliminación conservan el comportamiento actual.
- La etiqueta no es un enlace ni cambia la caja destino.
