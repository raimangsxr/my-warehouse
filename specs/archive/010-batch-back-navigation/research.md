# Research: Navegación padre en lotes

## Destinos deterministas

**Decision**: Usar rutas padre explícitas en lugar del historial del navegador.

**Rationale**: Funciona con URL directa y evita regresar fuera de la aplicación o a una pantalla no relacionada.

**Alternatives considered**: `Location.back()` depende de un historial válido; un servicio global es desproporcionado para dos rutas.

## Contexto de caja

**Decision**: Reutilizar `boxId` del query param del listado.

**Rationale**: La caja de origen ya lo aporta; no requiere estado adicional.

**Alternatives considered**: Persistir origen en storage añade estado obsoleto y complejidad.
