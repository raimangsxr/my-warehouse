# Data Model: Navegación por warehouses y perfil

## User

Existing account entity extended with one preference.

| Field | Type | Rules |
|-------|------|-------|
| `id` | UUID string | Existing primary key |
| `email` | string | Existing unique identity; read-only in this feature |
| `display_name` | nullable string | Trimmed; max 120; empty becomes null |
| `default_warehouse_id` | nullable UUID string | References a warehouse; must also have a membership when explicitly set; clears when target warehouse is deleted |

Relationships:

- A user has zero or more memberships.
- A user has zero or one default warehouse preference.
- The default relation is valid only while a matching membership exists.

State transitions:

- `null → warehouse`: explicit selection, first warehouse creation or startup fallback.
- `warehouse A → warehouse B`: explicit default action or stale-default recovery.
- `warehouse → null`: target deletion; startup may then choose another membership.

## Membership

Existing user/warehouse association.

Relevant fields: `user_id`, `warehouse_id`, `role`, `created_at`.

- `created_at` is exposed with the warehouse membership list to choose a deterministic fallback.
- Role remains exactly `administrator` or `contributor`.
- Creation eligibility derives from the complete set of a user's memberships; it is not stored separately.

## Warehouse overview

Read model, not a new table.

| Field | Type | Definition |
|-------|------|------------|
| Warehouse identity | existing fields | id, name, creator, creation time |
| Membership context | role + joined time | Requesting user's role and membership creation time |
| `active_item_count` | non-negative integer | Items whose `deleted_at` is null |
| `stock_unit_count` | integer | Sum of movements for active items; may be zero |
| `active_box_count` | non-negative integer | Boxes whose `deleted_at` is null, including inbound |
| `open_batch_count` | non-negative integer | Intake batches whose status is not terminal (`committed`) |
| `member_count` | non-negative integer | Current memberships |
| `members` | list | Privacy-shaped member summaries |

No summary data is persisted; values reflect committed current data.

## Member overview

| Field | Contributor requester | Administrator requester |
|-------|-----------------------|-------------------------|
| `user_id` | included | included |
| `display_name` | included | included |
| `role` | included | included |
| `email` | null/omitted | included |

Visibility is evaluated independently for each warehouse in the overview collection.

## Pointer intent

Ephemeral UI state only.

| Field | Meaning |
|-------|---------|
| pointer id | Identifies the active pointer |
| start x/y | Coordinates captured on pointer down |
| moved | True once Euclidean/axis movement reaches 12px |

Transitions: idle → pressed → moved or valid tap → idle. Keyboard clicks bypass pointer tracking and remain valid.

## Migration

- Revision follows `20260820_0013`.
- Add nullable indexed `users.default_warehouse_id` with foreign key to `warehouses.id` and deletion behavior `SET NULL`.
- No data backfill; this avoids guessing user preference. Startup resolution creates a valid preference on next authenticated entry.
- Downgrade removes foreign key/index/column using batch operations compatible with SQLite tests.
