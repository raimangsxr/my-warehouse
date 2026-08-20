# Research: Navegación por warehouses y perfil

## Default warehouse persistence

**Decision**: Store a nullable account-level default warehouse id and keep the currently active warehouse as client-local state.

**Rationale**: The user explicitly wants a cross-entry default while still opening another warehouse temporarily. Separate state prevents “open” from silently becoming “make default” and supports multiple devices.

**Alternatives considered**:

- Local storage only: rejected because the preference would differ between devices and disappear with browser data.
- Make every switch update the default: rejected because it conflicts with explicit marking.
- Store active warehouse server-side: rejected because simultaneous devices may legitimately operate in different warehouses.

## Default fallback and invitation behavior

**Decision**: If the stored default is absent/invalid, choose the accessible membership with the oldest membership timestamp, persist it, and enter Home. Invitation acceptance opens the invited warehouse but only sets it as default when no valid default exists.

**Rationale**: Oldest membership is stable and typically represents the primary/first space. Invitations must immediately take users to the accepted context without unexpectedly replacing an established preference.

**Alternatives considered**:

- Newest warehouse: less stable and makes every invite a likely implicit preference.
- Alphabetical first: renames can change startup behavior.
- Always return to the list: directly contradicts the requested entry flow.

## Creation permission bootstrap

**Decision**: Allow creation with zero memberships or with at least one Administrator membership; deny users who have memberships exclusively as Contributor. Serialize the eligibility check per user.

**Rationale**: This implements the confirmed bootstrap rule and closes the API boundary, including concurrent attempts that could otherwise both observe zero memberships.

**Alternatives considered**:

- Global application role: explicitly not selected and materially larger.
- Any authenticated user: current behavior, rejected by the requested contributor restriction.
- Only an administrator of the active warehouse: unnecessarily ties a global create action to transient client state.

## Warehouse summaries and privacy

**Decision**: Provide one overview collection for all accessible warehouses, with grouped active counts and role-filtered member identities. Contributors see display name and role; administrators of that specific warehouse also see email.

**Rationale**: One collection avoids client N+1 requests, while server-side privacy shaping prevents a contributor from recovering email addresses through direct calls.

**Alternatives considered**:

- Reuse administrator-only member endpoint per card: contributors could not receive the requested access overview and the client would issue many requests.
- Expose all emails to all members: unnecessary personal-data disclosure.
- Store denormalized counters: premature complexity for domestic inventory scale and introduces consistency work.

## Routing without an active warehouse

**Decision**: Authenticate the app shell independently, allow Warehouses/Profile without selection, and apply the selected-warehouse guard only to operational routes.

**Rationale**: A parent guard requiring selection makes the no-warehouse state and integrated warehouse view unreachable, causing redirect loops.

**Alternatives considered**:

- Second shell for account-only pages: duplicates layout and navigation.
- Fake/temporary selected warehouse: weakens authorization semantics.
- Keep `/warehouses` outside the shell: explicitly rejected by the feature request.

## Mobile pointer behavior

**Decision**: Reduce mobile action density using a more-actions menu and combine explicit vertical pan semantics with a 12px tap-intent threshold. Do not prevent the native pointer move.

**Rationale**: Buttons do not need to forward scroll events. The robust approach is to let the browser own vertical panning and prevent an action only after movement demonstrates scroll intent. The menu also increases non-interactive card surface and reduces destructive-action accidents.

**Alternatives considered**:

- CSS-only change: lower risk but does not protect against delayed/synthetic click activation across browser/Material combinations.
- Bottom sheet: clean but adds an extra step to every secondary operation and was not selected.
- Forward touch events manually: brittle and fights native scrolling.

## PWA role presentation

**Decision**: Move all update controls to Profile. Everyone sees four plain-language status fields and actions; full current diagnostics appear only for an Administrator of the active warehouse.

**Rationale**: Update capability belongs to the client/account experience, while service-worker/install diagnostics are operational information. Using the active role matches all existing per-warehouse role semantics.

**Alternatives considered**:

- Full diagnostics for anyone who administers any warehouse: role context would be surprising when operating as Contributor.
- Keep PWA under Settings: excludes contributors from update checks and conflicts with the request.
