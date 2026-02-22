# AGENTS.md — Instrucciones para Codex (my-warehouse)

> Este repositorio mantiene una especificación viva en `specs.md`.
> **Codex debe tratar `specs.md` como la fuente de verdad** y mantenerla actualizada.

## Fuente de verdad (obligatorio)
- `specs.md` es la **especificación del producto**.
- **Al inicio de cada tarea**, abre `specs.md` y lee las secciones relevantes antes de proponer cambios.
- **Si cambias comportamiento, UX, API, modelo de datos, migraciones, sync, o settings**, actualiza `specs.md` **en el mismo PR/commit**.
- Cada cambio relevante debe:
  - Añadir entrada al **Changelog** dentro de `specs.md`.
  - Mantener consistencia con el resto de secciones (API, Modelo, UX, Slices, etc.).

## Forma de trabajar (preferencias del repo)
- Implementa por **vertical slices** (ver sección “Plan de implementación” en `specs.md`).
- Mantén el diseño **Material Design** (Angular Material) y responsive (móvil/tablet/escritorio).
- Multiusuario desde el día 1 (sin roles): valida siempre `warehouse_id` y pertenencia del usuario.
- Stock como eventos (`stock_movements`) para reducir conflictos de sync.

## Calidad mínima por cambio
- Si tocas el modelo: crea/actualiza migraciones Alembic y documenta el cambio en `specs.md`.
- Añade/ajusta tests mínimos razonables (backend) y revisa que el build de frontend siga sano.
- Evita introducir dependencias nuevas sin justificarlo y documentarlo.

## Cuando haya ambigüedad
- Toma una decisión razonable y **documéntala** en `specs.md` en “Open Questions / Assumptions”.
- Si la ambigüedad afecta UX o datos de forma importante, prioriza una solución simple y reversible.

## Seguridad (recordatorio)
- No guardar secretos en el frontend:
  - Gemini API key y credenciales SMTP viven en backend (cifradas).
- No exponer tokens sensibles en QR (solo `qr_token` no adivinable, validado por backend).
