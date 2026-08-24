# Quickstart: Eliminar miembro del warehouse

Validación estrecha:

```bash
cd backend
uv run pytest tests/test_warehouse_roles.py

cd ../frontend
npm test -- --watch=false --include='src/app/services/warehouse.service.spec.ts' --include='src/app/members/members.component.spec.ts'
```

Validación amplia:

```bash
cd backend
uv run pytest

cd ../frontend
npm test -- --watch=false
npm run build
```

Comprobación manual: entrar como Administrador en Miembros, cancelar una retirada, retirar un Contribuidor y otro Administrador, y verificar que la acción no aparece en la fila propia ni en anchos móvil/escritorio.
