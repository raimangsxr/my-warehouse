---
inclusion: always
---

# Flujo de trabajo y calidad mínima

## Antes de implementar cualquier cambio

1. Leer las secciones relevantes de `requirements.md` y `design.md`.
2. Si el cambio introduce requisitos nuevos, añadirlos en `requirements.md` antes de implementar.

## Al implementar

- Cada unidad de trabajo entrega funcionalidad end-to-end (backend + frontend + migración si aplica).
- Validar siempre `warehouse_id` + membresía del usuario en endpoints de datos.
- Stock siempre como eventos (`stock_movements`), nunca campo mutable directo.
- Multiusuario sin roles: todos los miembros del warehouse tienen los mismos permisos.

## Checklist de Done por cambio

- [ ] Funcionalidad implementada end-to-end (backend + frontend).
- [ ] Si se tocó el modelo: migración Alembic creada con nombre `YYYYMMDD_NNNN_descripcion.py`.
- [ ] Tests backend añadidos/ajustados (`pytest -q` pasa).
- [ ] Build frontend sano (`ng build` sin errores).
- [ ] `specs.md` actualizado:
  - Sección correspondiente en `.kiro/specs/my-warehouse/requirements.md` o `design.md` refleja el cambio.
  - Tarea marcada como completada en `tasks.md`.
  - Si hay cambio de arquitectura/API: actualizar `design.md`.
- [ ] Seguridad aplicada (auth, validaciones, ownership).
- [ ] Sin dependencias nuevas sin justificar.

## Actualizar las specs

Cada cambio relevante debe:
- Actualizar `requirements.md` si cambia el comportamiento esperado (añadir/modificar sentencias EARS).
- Actualizar `design.md` si cambia la arquitectura, el modelo de datos o la API.
- Marcar tareas como `[x]` en `tasks.md` y mover al backlog las que queden pendientes.
- Si se tomó una decisión ante ambigüedad: documentarla en `design.md` sección "Decisiones / Assumptions".

## Dependencias nuevas

- Backend: justificar en `design.md` antes de añadir a `pyproject.toml`.
- Frontend: justificar en `design.md` antes de añadir a `package.json`.
- Preferir lo que ya está en el stack antes de añadir librerías externas.

## Ambigüedad

- Tomar una decisión razonable y simple.
- Documentarla en `design.md` con ID `A-NNN` y fecha.
- Priorizar soluciones reversibles cuando la ambigüedad afecte UX o datos.

## Seguridad — recordatorio rápido

- Gemini API key y credenciales SMTP: solo en backend, cifradas con `secret_store.py`.
- QR tokens: `secrets.token_urlsafe()`, nunca predecibles.
- No exponer `reset_token` en respuesta API en producción.
- TLS obligatorio en despliegue real.
- Contenedores: usuario no privilegiado (`uid=10001`), rootless.
