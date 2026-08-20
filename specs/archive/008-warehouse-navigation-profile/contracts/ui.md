# UI Contract: Integrated account and warehouse experience

## Routes

- `/app`: authenticated entry resolver; chooses a valid default and routes to Home, or routes to Warehouses when none exist.
- `/app/warehouses`: authenticated, inside shell, no selected warehouse required.
- `/app/profile`: authenticated, inside shell, no selected warehouse required.
- Operational routes under `/app` continue requiring a selected accessible warehouse.
- Administrative operational routes additionally require Administrator role for the selected warehouse.
- Legacy `/warehouses` redirects to `/app/warehouses` for saved links.

## Header

- Shows active warehouse name and role when selected; activates Warehouses for switching.
- Shows current user display name, falling back to email.
- User menu exposes `Perfil` and `Cerrar sesión` on desktop and mobile.
- Role-sensitive navigation updates immediately after opening another warehouse.

## Warehouses

Each card presents:

- name and requesting user's role;
- active and default badges;
- active article, stock unit, active box, open batch and member counts;
- member display names and roles; email only to target-warehouse administrators;
- `Abrir` and explicit `Marcar como predeterminado` actions.

Creation is visible when there are no memberships or at least one Administrator membership. Invitation and deletion controls are visible only on warehouses administered by the user. Contributor-only accounts see no create/invite/delete controls.

## Profile

- Account card: editable display name, read-only email.
- Security card: current/new password workflow moved from Settings.
- Application card for all users: installed, installed/current version, detected new version, last check, and install/check/apply actions when available.
- Administrator detail: service-worker state, install-prompt eligibility, update error, version transition and platform-specific hints only when active warehouse role is Administrator.
- With no active warehouse or Contributor role, only the four-field summary is shown.

## Mobile item actions

- At mobile breakpoint, stock decrement/display/increment and favorite remain directly visible.
- Edit, reprocess (when permitted) and delete live under one `Más acciones` menu.
- Vertical movement of 12px or more from any action surface cancels activation and permits native page scroll.
- Tap below threshold activates once.
- Keyboard interaction remains standard and all buttons/menu items have Spanish accessible labels.
- Desktop keeps the existing direct action row.
