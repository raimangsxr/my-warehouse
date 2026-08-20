# Quickstart: Validación de roles por warehouse

## Preparación

1. Aplicar migraciones y arrancar backend/frontend con el flujo habitual del repositorio.
2. Crear dos usuarios y dos warehouses.
3. Invitar al segundo usuario como Contribuidor en uno y como Administrador en otro.

## Validación manual mínima

1. Confirmar que el creador aparece como Administrador.
2. Aceptar ambas invitaciones y comprobar que el rol ofrecido se conserva.
3. Como Contribuidor, crear/editar cajas, artículos y lotes.
4. Confirmar que no aparecen Settings, miembros, invitaciones ni eliminación y que peticiones directas reciben `403`.
5. Cambiar al warehouse donde el mismo usuario es Administrador y comprobar que aparecen las acciones sin recargar sesión.
6. Desde Miembros, promover/degradar usuarios y verificar el cambio inmediato.
7. Intentar degradar al único Administrador y comprobar `409` sin cambios.
8. Como Administrador no creador, eliminar un warehouse de prueba usando la confirmación nominal.

## Validación automatizada

```bash
cd backend && uv run pytest tests/test_warehouse_roles.py
cd backend && uv run pytest
cd frontend && npm test -- --watch=false
cd frontend && npm run build
```

También ejecutar `alembic upgrade head` sobre una base con membresías anteriores y verificar el backfill antes de probar el downgrade en un entorno desechable.
