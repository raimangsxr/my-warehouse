# Quickstart Validation: Warehouse navigation and profile

## Automated validation

Run narrow tests first:

```bash
cd backend
uv run pytest tests/test_warehouse_navigation_profile.py tests/test_auth_warehouses.py

cd ../frontend
npm run test -- --configuration=ci
```

Then run the complete gates:

```bash
cd backend
uv run pytest

cd ../frontend
npm run test -- --configuration=ci
npm run build
```

## Manual role/navigation matrix

1. Sign in with a new account and verify `/app/warehouses` appears inside the shell.
2. Create the first warehouse; verify it becomes active/default and opens Home.
3. As an Administrator, create a second warehouse; verify the previous default is unchanged.
4. Open the second warehouse; verify active changes but default does not.
5. Mark the second as default, sign out/in, and verify direct entry to its Home.
6. Sign in as a contributor-only account; verify switching/default actions remain available but creation, invitation, deletion and configuration do not.
7. Attempt `POST /api/warehouses` with the contributor token and verify 403/no new warehouse.
8. Compare overview members as Contributor versus Administrator; emails must only appear to the latter for that warehouse.

## Manual profile/PWA matrix

1. Open Profile as Contributor and edit display name; email remains read-only.
2. Change password and confirm the current session behavior and revoked alternate sessions match existing security behavior.
3. Verify only installed status, current version, detected version and last check are shown as Contributor or with no active warehouse.
4. Switch to an administered warehouse and verify full diagnostics appear.
5. Run `Buscar actualización`; verify success/failure copy remains understandable and non-blocking.

## Manual touch validation

Use a real coarse-pointer mobile browser where possible and a 320px viewport fallback:

1. On Home, start vertical drags over stock decrement, stock increment, favorite and `Más acciones`.
2. Repeat in box detail.
3. Each drag of at least 12px must scroll without changing stock/favorite or opening/navigating/deleting.
4. Tap each visible action and each menu entry; it must execute exactly once.
5. Navigate the same actions with keyboard; focus stays visible and accessible names are announced.
6. Confirm no horizontal page scroll on Warehouses, Profile or item cards at 320px.

## Completed evidence (2026-08-20)

- Backend: 74 tests passed; the new migration's upgrade/downgrade path is covered in `test_warehouse_navigation_profile.py`.
- Frontend: 214 tests passed and the production build completed.
- Mobile browser at 320×700: no horizontal overflow; scroll initiated over mobile item actions moved the content 420 px; `pan-y` was effective; compact menu exposed Edit, Reprocess tags and Delete.
