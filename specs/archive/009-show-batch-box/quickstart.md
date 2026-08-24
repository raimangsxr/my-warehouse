# Quickstart: Validar caja en la lista de lotes

## Automated validation

Desde `frontend/`:

```bash
npm test -- --watch=false --include='src/app/items/intake-batches.component.spec.ts'
npm test -- --watch=false
npm run build
```

## Manual smoke check

1. Abrir `/app/batches` en un warehouse con al menos dos lotes asociados a cajas distintas.
2. Comprobar que cada título identifica su caja destino sin abrir el lote.
3. Reducir el ancho a móvil y comprobar que los nombres largos ajustan línea sin tapar las acciones.
4. Abrir uno de los lotes y comprobar que la navegación existente continúa funcionando.
