# my-warehouse

`my-warehouse` es una aplicación web (PWA) para inventariar objetos de garaje, trastero o almacén doméstico con una premisa simple: guardar rápido y encontrar rápido.

Combina cajas jerárquicas, búsqueda potente, QR por caja y ayuda de IA para acelerar el alta de artículos, tanto individual como masiva.

## Qué valor aporta

- Reduce el tiempo de localizar objetos guardados.
- Evita compras duplicadas por no recordar si algo ya existe.
- Mantiene el inventario utilizable incluso con uso móvil y conectividad irregular.
- Permite trabajo colaborativo en el mismo almacén (multiusuario).
- Acelera la carga de inventario con captura por foto y procesamiento asistido por IA.

## Cómo se utiliza la aplicación

1. Crea una cuenta e inicia sesión.
2. Crea o selecciona un almacén.
3. Organiza el árbol de cajas (cajas dentro de cajas) según tu espacio real.
4. Da de alta artículos de una de estas formas:
   - Alta manual.
   - Captura por foto (IA propone datos).
   - Captura masiva por lote para procesar N fotos en paralelo.
5. Revisa y corrige los borradores sugeridos por IA.
6. Asigna los artículos a su caja y confirma.
7. Usa búsqueda o escaneo QR para recuperar cualquier objeto en segundos.

## Features principales

- Inventario por almacenes compartidos (multiusuario sin roles).
- Árbol jerárquico de cajas con navegación clara por ruta.
- QR único por caja para acceso rápido desde móvil.
- Artículos con foto, nombre, descripción, tags, alias, ubicación y favoritos.
- Gestión de stock mediante movimientos (`+/-`) para trazabilidad y mejor sync.
- Búsqueda por texto, tags, alias y ruta de caja.
- Papelera con restauración de elementos borrados.
- Actividad reciente del almacén.
- Flujo de captura por foto con enriquecimiento IA.
- Flujo de captura masiva por lote con:
  - subida de múltiples fotos,
  - procesamiento paralelo en backend,
  - revisión/edición antes de confirmar,
  - reprocesado IA contextual (foto o foto+nombre según cambios del usuario).
- Modo offline-first con sincronización y resolución de conflictos.
- Exportación e importación de datos del almacén.

## Experiencia de uso

- Diseño Material responsive para móvil, tablet y escritorio.
- Operaciones rápidas desde cards/listas (favorito, stock, edición, reproceso).
- Feedback inmediato de acciones con snackbars.
- Flujos optimizados para inventario intensivo (alta unitaria y masiva).

## Stack técnico

- Frontend: Angular + Angular Material (PWA).
- Backend: FastAPI + SQLAlchemy + Alembic.
- Base de datos objetivo: PostgreSQL.
- Integración IA: Gemini (desde backend).

## Ejecutar en local

### Backend

```bash
cd /Users/rromanit/workspace/my-warehouse/backend
python -m venv .venv
source .venv/bin/activate
pip install -e .
pytest -q
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd /Users/rromanit/workspace/my-warehouse/frontend
npm install
npm start
```

- Frontend: `http://localhost:4200`
- API: `http://localhost:8000`

## Documentación de producto

La especificación viva del producto está en `/Users/rromanit/workspace/my-warehouse/specs.md` y actúa como fuente de verdad funcional y técnica.
