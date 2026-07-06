# Research: 002-delete-warehouse

**Date:** 2026-07-06

## R1 — Estrategia de borrado atómico (BD + media)

**Decision:** Una sola operación de servicio con transacción SQLAlchemy; borrado de filesystem **antes** del `commit`; `rollback` si falla el borrado de media.

**Rationale:** La spec exige que si fallan los ficheros, el almacén siga existiendo (FR-008, Assumptions). Borrar media tras commit dejaría datos huérfanos o almacén fantasma. Borrar media antes del commit permite revertir la transacción si `shutil.rmtree` falla.

**Alternatives considered:**
- *Media después del commit* — rechazado: incumple FR-008 si falla filesystem.
- *Soft-delete del warehouse* — rechazado: fuera de alcance de la spec.
- *Cola asíncrona de borrado* — rechazado: complejidad innecesaria para v1.

## R2 — Orden de borrado en base de datos

**Decision:** Servicio dedicado `warehouse_delete.py` con borrado explícito por `warehouse_id` en tablas sin cascade ORM completo, luego `db.delete(warehouse)`.

**Tablas a borrar explícitamente (no cubiertas por cascade desde `Warehouse`):**
- `sync_conflicts`
- `processed_commands`
- `change_log`
- `stock_movements`
- `item_favorites` (vía join con `items` del warehouse)

**Tablas con cascade ORM desde `Warehouse`:** `memberships`, `boxes`, `items`, `intake_batches` (+ `intake_drafts` por cascade en batch), `warehouse_invites`, `activity_events`, `smtp_settings`, `llm_settings`.

**Rationale:** El modelo `Warehouse` no declara relaciones hacia `change_log`, `processed_commands`, `sync_conflicts` ni `stock_movements`. `boxes.parent_box_id` es self-FK sin `ON DELETE CASCADE` en migración; borrar el warehouse vía cascade de boxes puede fallar si SQLAlchemy no ordena hijos→padres — el servicio borrará boxes por `warehouse_id` con delete en bulk o orden topológico inverso.

**Alternatives considered:**
- *Solo `session.delete(warehouse)` confiando en FK DB* — rechazado: FKs no tienen CASCADE a nivel migración.
- *Nueva migración CASCADE global* — rechazado en v1: más invasivo; el servicio es suficiente.

## R3 — Bloqueo por lotes en procesamiento

**Decision:** Rechazar `DELETE` con HTTP 409 si existe `intake_batches.status == 'processing'` para el `warehouse_id`.

**Rationale:** Alineado con FR-011 y clarificación del usuario. Evita carreras con `intake_workers` in-process.

**Alternatives considered:**
- *Forzar cancelación del worker y borrar* — rechazado en clarify (opción B).

## R4 — Autorización

**Decision:** `warehouse.created_by == current_user.id`; miembros no creadores → HTTP 403. Lista warehouses ya expone `created_by` en `WarehouseResponse`.

**Rationale:** FR-001, FR-001a. Frontend compara `created_by` con `auth/me().id` para ocultar botón (FR-001b).

## R5 — API y confirmación

**Decision:** `DELETE /api/v1/warehouses/{warehouse_id}` con body JSON `{ "confirm_name": "<exact name>" }`. Validar coincidencia exacta (strip solo en name del warehouse al comparar, no case-folding).

**Rationale:** FR-002, edge case de nombre exacto.

## R6 — Media filesystem

**Decision:** Eliminar recursivamente `{settings.media_root}/{warehouse_id}/` si existe; no error si el directorio ya está ausente (idempotencia parcial en reintentos).

**Rationale:** FR-005. Fotos de items y temporales de intake viven bajo esa ruta.

## R7 — Auditoría

**Decision:** `logger.info` estructurado antes del commit con `warehouse_id`, `warehouse_name`, `actor_user_id`, timestamp.

**Rationale:** FR-010; sin persistencia en BD.

## R8 — Cliente post-borrado

**Decision:**
- Si `mw_selected_warehouse_id` coincide → `localStorage.removeItem`
- `SyncService.purgeWarehouse(warehouseId)` — eliminar comandos/conflictos/meta de IndexedDB para ese warehouse
- Permanecer en `/warehouses`; snackbar de éxito

**Rationale:** FR-007, edge case cola offline.

## R9 — Actualización del contrato SDD

**Decision:** Actualizar `specs/contracts/app/contract.md` en **T0, antes de escribir código** (Principle III de constitución v1.0.0). Revisar de nuevo al cierre del change para alinear con código implementado.

**Rationale:** Política SDD y constitución ratificada; el contrato activo es la fuente de verdad documentada del comportamiento acordado.

**Alternatives considered:**
- *Actualizar solo al merge* — rechazado: viola Principle III.
- *Solo change contract sin tocar app contract* — rechazado: comportamiento durable debe vivir en contrato activo.

## R10 — Idioma de errores API vs UI

**Decision:** `detail` HTTP en **inglés** (convención de `backend/app/api/`); mensajes visibles al usuario en **español** vía snackbars en frontend.

**Rationale:** Constitución: «User-facing UI copy in Spanish»; no exige traducir `detail` API. Consistencia con endpoints existentes (`"Warehouse not found"`, etc.).

**Alternatives considered:**
- *Español en API* — rechazado: rompe convención del codebase y complica tests existentes.

## R11 — Co-miembro con warehouse borrado en sesión activa

**Decision:** `warehouse.guard` en rutas `/app/*`: al entrar, comparar `mw_selected_warehouse_id` con `GET /warehouses`; si ausente → `clearSelectedWarehouseId()`, snackbar español, redirect `/warehouses`.

**Rationale:** US3 escenario 3; FR-007 para usuarios que no ejecutaron el delete.

## R12 — Eliminación solo online

**Decision:** Deshabilitar botón/confirmar delete en UI cuando `navigator.onLine === false` (o `SyncService` online flag); sin cola offline para DELETE.

**Rationale:** Assumption spec L137; `data-model.md` online only.

## R13 — Tests adicionales (post-analyze)

**Decision:** Añadir tests de rollback media (mock `shutil.rmtree` fail), idempotencia 404, y aserción FR-009 en `test_creator_can_delete_warehouse`. Escribir **todos** los tests backend antes del servicio (TDD).

**Rationale:** Cerrar gaps FR-008, FR-009, idempotency contract; Principle V.
