# Data Model Impact: 002-delete-warehouse

**Feature:** Eliminación permanente de warehouse  
**Date:** 2026-07-06

## Entidad principal afectada

### Warehouse (eliminación)

| Atributo | Uso en feature |
|----------|----------------|
| `id` | Identificador en DELETE y ruta media |
| `name` | Confirmación `confirm_name` |
| `created_by` | Autorización: solo creador puede eliminar |

**Lifecycle:** `active` → `deleted` (hard delete, sin estado intermedio persistido).

## Entidades eliminadas en cascada (por warehouse_id)

| Entidad | Notas |
|---------|-------|
| `memberships` | Todos los miembros pierden acceso |
| `boxes` | Árbol completo incl. inbound |
| `items` | Incl. tags/aliases JSON, `photo_url` |
| `item_favorites` | Borrado vía items o explícito |
| `stock_movements` | Borrado explícito por warehouse_id |
| `warehouse_invites` | Pendientes y aceptadas |
| `activity_events` | Historial del warehouse |
| `smtp_settings` | Config cifrada |
| `llm_settings` | Config cifrada |
| `intake_batches` | Todos los estados excepto bloqueo en `processing` |
| `intake_drafts` | Cascade desde batch |
| `change_log` | Borrado explícito |
| `processed_commands` | Borrado explícito |
| `sync_conflicts` | Borrado explícito |

## Entidades NO afectadas

| Entidad | Motivo |
|---------|--------|
| `users` | FR-009 |
| Otros `warehouses` del mismo usuario | FR-009 |
| `refresh_tokens` / `password_reset_tokens` | Sin FK a warehouse |

## Media (filesystem)

| Ruta | Contenido |
|------|-----------|
| `{media_root}/{warehouse_id}/` | Fotos items, intake temporales, uploads |

Borrado recursivo del directorio completo.

## Validaciones de negocio

| Regla | Campo / condición |
|-------|-------------------|
| Solo creador | `warehouses.created_by == current_user.id` |
| Nombre confirmado | `confirm_name == warehouses.name` (exacto) |
| Sin lotes activos | `NOT EXISTS intake_batches WHERE status='processing'` |
| Online only | Sin cola offline para DELETE; UI deshabilita acción sin red |

## State transitions (intake — precondición)

```
DELETE permitido SI batch.status ∈ {drafting, review, committed}
DELETE bloqueado SI ∃ batch.status = processing
```

## Sin cambios de esquema Alembic

No se añaden tablas ni columnas. Opcional futuro: `ON DELETE CASCADE` en FKs de sync — fuera de v1.
