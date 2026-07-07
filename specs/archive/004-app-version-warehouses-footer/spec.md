# Feature Specification: App Version in Warehouses Footer

**Change**: `004-app-version-warehouses-footer`  
**Created**: 2026-07-08  
**Status**: Completed  
**Input**: Mostrar la versión desplegada en un pie discreto de la vista `/warehouses` y gestionar `APP_VERSION` como en `kiosk-screen` (inyección en build Docker desde el tag de release).

## SDD Context

- Manifest entry required: yes
- Affected active contracts: `app`, `ops-platform`
- Context pack: [context-pack.md](./context-pack.md)
- Contract update required before implementation: yes

## User Scenarios & Testing

### User Story 1 — Usuario ve la versión desplegada en warehouses (Priority: P1)

Tras iniciar sesión, el usuario abre `/warehouses` y ve la versión de la aplicación en un pie de página discreto. Facilita soporte sin inspeccionar tags de contenedor.

**Why this priority**: Reduce tiempo para diagnosticar incidencias ligadas a una release concreta.

**Independent Test**: Build de imagen frontend prod con `APP_VERSION=1.2.3`; abrir `/warehouses` y verificar `Versión 1.2.3`.

**Acceptance Scenarios**:

1. **Given** una imagen de release con tag `0.3.5`, **When** el usuario abre `/warehouses`, **Then** el footer muestra `Versión 0.3.5`.
2. **Given** desarrollo local sin inyección de build, **When** el usuario abre `/warehouses`, **Then** el footer muestra `Versión dev`.
3. **Given** la página de warehouses, **When** se renderiza en viewport compacto, **Then** el footer respeta `safe-area-inset-bottom` y no solapa acciones principales.

---

### User Story 2 — Pipeline de release estampa la versión en build (Priority: P1)

El workflow de release pasa el tag de GitHub al build Docker del frontend para que la versión coincida con la imagen publicada.

**Acceptance Scenarios**:

1. **Given** `release-images.yml` corre para tag `0.3.5`, **When** se construye la imagen frontend, **Then** `APP_VERSION` es `0.3.5` y `write-app-version.mjs` genera `app-version.ts` antes de `ng build`.
2. **Given** un build Docker manual sin `APP_VERSION`, **When** se produce la imagen, **Then** se usa el default `dev`.

## Functional Requirements

- **FR-001**: La vista `/warehouses` MUST mostrar la versión en un footer (`Versión {version}`).
- **FR-002**: `APP_VERSION` MUST inyectarse en build Docker del frontend vía `frontend/scripts/write-app-version.mjs`.
- **FR-003**: `release-images.yml` MUST pasar `github.event.release.tag_name` como `APP_VERSION` al build frontend.
- **FR-004**: Desarrollo local y tests MUST usar default checked-in `dev` cuando no hay inyección.
- **FR-005**: `PwaService` y Settings siguen leyendo `APP_VERSION` de `app-version.ts` (sin cambio de comportamiento funcional).

## Success Criteria

- **SC-001**: `npm run build` pasa.
- **SC-002**: Imágenes de release muestran el tag en `/warehouses`, no `dev`.
- **SC-003**: Contratos `app` y `ops-platform` y `manifest.yml` reflejan footer y inyección de versión.

## Non-goals

- Footer de versión en login, signup u otras pantallas de auth.
- Endpoint API de versión en runtime.
- Sincronizar automáticamente `ngsw-config.json` `appData.version` con `APP_VERSION` (sigue gestionado aparte).

## Reference

Patrón alineado con `kiosk-screen` CHG-037 (`../kiosk-screen/specs/changes/037-app-version-hall-footer/`).
