# Research: Mostrar caja en la lista de lotes

## Reutilización del dato existente

**Decision**: Usar `IntakeBatch.target_box_name` directamente en la fila del listado.

**Rationale**: El tipo frontend, el esquema backend y el serializador ya exponen el nombre actual de la caja; no hace falta cargar el árbol de cajas ni añadir una solicitud.

**Alternatives considered**:

- Resolver el nombre mediante `target_box_id` y el árbol cargado: duplica una relación que la respuesta ya resuelve y puede fallar si el árbol aún no terminó de cargar.
- Cambiar el API para añadir otro campo: innecesario porque `target_box_name` ya cubre el requisito.

## Presentación y fallback

**Decision**: Mostrar una etiqueta de caja junto al título solo cuando `target_box_name` tenga valor; si falta, conservar el título actual sin marcador desconocido.

**Rationale**: Mantiene la información precisa, conserva compatibilidad con respuestas incompletas y evita presentar un texto que el usuario pueda interpretar como nombre real.

**Alternatives considered**:

- Mostrar “Caja desconocida”: aporta ruido y no identifica una caja.
- Mostrar el UUID de caja: es técnico, difícil de leer y no cumple el objetivo del usuario.

## Alcance de pruebas

**Decision**: Añadir cobertura al spec existente del componente y ejecutar la validación frontend.

**Rationale**: El comportamiento es puramente de presentación y el API ya está cubierto por el modelo y las pruebas existentes; una prueba de componente observa el resultado relevante con bajo coste.

**Alternatives considered**:

- Añadir pruebas backend: no cambia el comportamiento backend.
- Solo validación manual: insuficiente para una regresión visible fácil de automatizar.
