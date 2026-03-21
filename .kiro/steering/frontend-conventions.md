---
inclusion: always
---

# Frontend — Convenciones y patrones

## Stack y versiones

- Angular 20 (standalone components, no NgModules)
- Angular Material 20 + CDK 20
- RxJS 7.8, TypeScript 5.8, Zone.js 0.15
- Angular Service Worker (PWA, solo en `production`)
- IndexedDB para cache offline y cola de comandos

## Estructura de componentes

```
frontend/src/app/
├── core/
│   ├── auth.interceptor.ts     # JWT + refresh automático en 401
│   ├── auth.guard.ts
│   ├── environment.ts          # dev: http://localhost:8000/api/v1
│   └── environment.prod.ts     # prod: /api/v1
├── services/
│   ├── auth.service.ts
│   ├── warehouse.service.ts
│   ├── box.service.ts
│   ├── item.service.ts
│   ├── intake.service.ts
│   ├── sync.service.ts
│   ├── notification.service.ts  # snackbars (success/error/info)
│   └── pwa.service.ts
└── <vista>/
    └── <vista>.component.ts    # standalone, imports explícitos
```

## Reglas de componentes

- Todos los componentes son **standalone** (`standalone: true`).
- Importar solo lo necesario en cada componente (no barrel imports masivos).
- Usar `inject()` en lugar de constructor injection donde sea posible.
- Signals y `computed()` para estado derivado simple; RxJS para flujos async complejos.
- Limpiar subscripciones con `takeUntilDestroyed()` o `DestroyRef`.

## Routing

- Lazy loading por ruta con `loadComponent`.
- Guards en rutas protegidas (`/app/**` requiere auth + warehouse seleccionado).
- Preservar `redirect` en query param al redirigir a `/login`.

## Material Design

- Usar siempre componentes de Angular Material (no CSS custom para lo que Material ya cubre).
- `appearance: 'outline'` en todos los form fields (configurado globalmente en `main.ts`).
- Densidad compacta en vistas operativas (home, boxes, batches).
- Iconos: Material Icons con `tooltip` descriptivo en acciones iconográficas.
- Snackbars via `NotificationService` (no usar `MatSnackBar` directamente en componentes).

## Responsive (mobile-first)

- Breakpoints: móvil `<=600px`, tablet `601-1199px`, escritorio `>=1200px`.
- Sidenav: `over` en móvil, `side` en escritorio.
- En móvil: acciones primarias a ancho completo, sin overflow horizontal.
- Targets táctiles mínimos: 44x44px.
- No usar `style` inline en vistas de producto; centralizar en clases CSS reutilizables.
- Vista `Cards` forzada en móvil (no `Lista`).

## Feedback de acciones

- Toda acción explícita del usuario muestra snackbar via `NotificationService`:
  - `success()` — confirmación de operación completada
  - `error()` — fallo con mensaje descriptivo
  - `info()` — estado operativo no bloqueante (ej. comando en cola offline)
- No silenciar errores HTTP; mostrar siempre feedback visible al usuario.

## Offline y sync

- `SyncService` gestiona IndexedDB (cola + `since_seq` + conflictos).
- Comandos offline cubiertos: `item.favorite/unfavorite`, `stock.adjust`.
- El interceptor `authInterceptor` refresca token automáticamente en `401` si hay sesión persistente.
- La API REST (`/api/**`) no se cachea en Service Worker.

## Entornos

- Dev: `environment.ts` → `apiBaseUrl: 'http://localhost:8000/api/v1'`
- Prod: `environment.prod.ts` → `apiBaseUrl: '/api/v1'`
- Build de producción: `ng build --configuration production` (activa `fileReplacements` + SW).

## PWA

- `manifest.webmanifest` con shortcuts a Home, Scan y Batches.
- SW activo solo en `production`; en dev desactivado para evitar interferencias.
- `PwaService` gestiona `beforeinstallprompt` y actualizaciones de SW.
- Versión legible en `appData.version` del SW; shell muestra snackbar al detectar nueva versión.

## Convenciones de código

- Nombres de archivos: `kebab-case.component.ts`, `kebab-case.service.ts`.
- Observables: sufijo `$` (ej. `items$`).
- Evitar `any`; tipar siempre las respuestas HTTP con interfaces.
- HTTP calls en services, nunca en componentes directamente.
- `debounceTime(300)` en inputs de búsqueda.
