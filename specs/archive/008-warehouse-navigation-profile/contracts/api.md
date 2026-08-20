# API Contract: Account and warehouse navigation

Base path remains `/api`; all operations require the existing Bearer authentication unless stated otherwise.

## `GET /auth/me`

Response `200`:

```json
{
  "id": "user-id",
  "email": "user@example.com",
  "display_name": "Nombre",
  "default_warehouse_id": "warehouse-id"
}
```

`default_warehouse_id` may be null.

## `PATCH /auth/me`

Updates only mutable personal data in this scope.

Request:

```json
{ "display_name": "Nombre visible" }
```

- Leading/trailing whitespace is removed.
- Empty string becomes null.
- Maximum length is 120.
- Email is not accepted as mutable input.

Response `200`: updated user shape from `GET /auth/me`.

## `PUT /auth/me/default-warehouse`

Request:

```json
{ "warehouse_id": "warehouse-id" }
```

Response `200`: updated user shape from `GET /auth/me`.

Errors:

- `403` when the warehouse does not exist or the user is not a member; no preference changes.

## `GET /warehouses`

Existing list response adds `membership_created_at`:

```json
[
  {
    "id": "warehouse-id",
    "name": "Garaje",
    "created_by": "user-id",
    "created_at": "2026-08-20T10:00:00Z",
    "membership_created_at": "2026-08-20T10:00:00Z",
    "role": "administrator"
  }
]
```

Order remains stable; startup fallback explicitly sorts by membership creation time ascending and warehouse id as tie-breaker.

## `GET /warehouses/overview`

Returns summaries only for warehouses accessible to the current user.

Response `200`:

```json
[
  {
    "id": "warehouse-id",
    "name": "Garaje",
    "created_by": "user-id",
    "created_at": "2026-08-20T10:00:00Z",
    "membership_created_at": "2026-08-20T10:00:00Z",
    "role": "contributor",
    "active_item_count": 42,
    "stock_unit_count": 57,
    "active_box_count": 8,
    "open_batch_count": 2,
    "member_count": 3,
    "members": [
      {
        "user_id": "member-id",
        "display_name": "Ana",
        "email": null,
        "role": "administrator"
      }
    ]
  }
]
```

For a requester who is Administrator of a given warehouse, `email` is populated for members of that warehouse. For a Contributor it is null. Counts exclude soft-deleted boxes/items; stock is summed only for active items; open batches exclude `committed`.

## `POST /warehouses` authorization change

Request and success response remain compatible.

Eligibility:

- zero memberships: allowed; new warehouse becomes account default;
- at least one Administrator membership: allowed; existing default remains unchanged;
- one or more memberships, all Contributor: `403` with no created records.

The eligibility check is serialized per user to prevent two concurrent first-creation requests from bypassing the rule.

## Existing contracts retained

- `POST /warehouses/{warehouse_id}/invites`: Administrator of target only.
- `DELETE /warehouses/{warehouse_id}`: Administrator of target plus existing confirmation and processing-batch protection; clears matching defaults.
- `POST /invites/{token}/accept`: returns invited warehouse id. The client opens it immediately and only sets it as default if no valid default exists.
- `POST /auth/change-password`: unchanged and available to every authenticated user.
