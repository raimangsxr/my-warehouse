# Active changes

No hay changes activos. El último completado es **`004-app-version-warehouses-footer`** (`specs/archive/004-app-version-warehouses-footer/`).

Para abrir un nuevo change:

1. Ejecutar `/speckit-specify` con la descripción del cambio.
2. Seguir el flujo completo: `clarify → checklist → plan → tasks → analyze → implement`.
3. Actualizar `specs/manifest.yml` (`active.change`, `active.context_pack`).
4. Al cerrar: mover a `specs/archive/` y poner `active.change: null`.

**Nunca** implementar código de producto/ops sin un change activo y `tasks.md` generado. Ver `AGENTS.md` y `.cursor/rules/speckit-mandatory-flow.mdc`.
