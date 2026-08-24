# UI Contract: Navegación padre en lotes

- `/app/batches/:batchId` muestra «Volver a lotes» y enlaza a `/app/batches`.
- `/app/batches?boxId={id}` muestra «Volver a la caja» y enlaza a `/app/boxes/{id}`.
- `/app/batches` sin `boxId` muestra «Volver a Inicio» y enlaza a `/app/home`.
- Cada control incluye icono de retorno y texto visible, es alcanzable por teclado y permanece en la cabecera responsive.
- No se modifica creación, filtrado, apertura ni eliminación de lotes.
