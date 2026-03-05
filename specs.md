# my-warehouse — `specs.md` (Source of Truth)

**Proyecto:** my-warehouse (PWA para inventario de garaje con cajas jerárquicas y QR)  
**Frontend:** Angular PWA + Angular Material (Material Design)  
**Backend:** FastAPI + SQLAlchemy + Alembic + PostgreSQL  
**Multiusuario:** Sí (desde el día 1, sin roles)  
**Offline-first + Sync + Conflictos:** Sí  
**LLM:** Gemini (tags y alias automáticos)

---

## Control del documento

- **Versión:** v1.55
- **Última actualización:** 2026-03-05  
- **Owner:** (mantener por el equipo)  
- **Estado:** Activo (este fichero es la especificación viva del producto)

### Changelog (mantener siempre al día)
> Regla: **cualquier cambio de implementación que afecte funcionalidad/UX/API/datos debe reflejarse aquí** y anotarse en el changelog.

- **v0.1 (2026-02-22):** Primera especificación completa (MVP + roadmap + arquitectura + sync + Gemini).
- **v0.2 (2026-02-22):** Arranque Slice 1 implementado (backend auth + warehouses + migración inicial + tests, frontend login/signup/warehouses/shell conectado por API). Se añade CORS de desarrollo para `http://localhost:4200`. Nota temporal: entorno local inicial con SQLite para bootstrap, objetivo final sigue siendo PostgreSQL.
- **v0.3 (2026-02-22):** Slice 1 cerrada: `forgot-password`, `reset-password` y `change-password` implementados end-to-end; shell responsive móvil/escritorio con sidenav overlay/side; migración `password_reset_tokens`; tests de auth extendidos.
- **v0.4 (2026-02-22):** Slice 2 completada: backend con CRUD de cajas y artículos, movimiento de cajas con prevención de ciclos, favoritos por usuario, stock como `stock_movements` idempotentes, acciones en lote y soft-delete/restore; frontend con rutas `/app/home`, `/app/boxes`, `/app/boxes/:id`, `/app/items/new`, `/app/items/:id` integradas en shell Material; migración `20260222_0003_slice2_boxes_items`; tests de Slice 2 añadidos. Fix técnico adicional: refresh tokens incorporan `jti` para evitar colisiones de hash en logins consecutivos.
- **v0.5 (2026-02-22):** Slice 3 completada (fase inicial): búsqueda incremental en Home con debounce, orden por relevancia en backend, búsqueda por ruta de cajas, filtro por tag y nube de tags por warehouse (`/warehouses/{warehouse_id}/tags/cloud`) con chips en UI. Se añaden tests backend de búsqueda/tags.
- **v0.6 (2026-02-22):** Slice 4 completada: endpoint `GET /boxes/by-qr/{qr_token}` con control de acceso por membresía, vista `/app/scan` integrada en el header con escaneo por cámara (BarcodeDetector) y fallback por token manual, redirect post-login conservando deep link, y detalle de caja con breadcrumbs navegables por tramo. Se añaden tests backend para lookup QR y permisos.
- **v0.7 (2026-02-22):** Slice 5 completada: invitaciones por token con expiración (`POST /warehouses/{id}/invites`, `POST /invites/{token}/accept`), papelera/restauración expuesta en UI (`/app/trash`) y actividad mínima (`/warehouses/{id}/activity`, `/app/activity`) con eventos clave (create/delete/restore/stock/batch/invite). Se añade migración `20260222_0004_slice5_invites_activity` y tests de invites/activity.
- **v0.8 (2026-02-22):** Slice 6 completada: configuración SMTP y Gemini por warehouse con secretos cifrados en backend (`smtp_settings`, `llm_settings`), endpoint de test SMTP, toggles `auto-tags/auto-alias`, reprocesado manual de item y autogeneración de tags/aliases al crear/editar items cuando LLM está habilitado. UI de Settings ampliada y migración `20260222_0005_slice6_settings_smtp_llm`.
- **v0.9 (2026-02-22):** Refactor transversal de UI/UX en frontend para alineación Material Design: sistema visual global (tokens de superficie, bordes, sombras y spacing), shell con navegación lateral y estados activos, rediseño responsive de auth/warehouses y pantallas core (`home`, `boxes`, `box-detail`, `item-form`, `scan`, `trash`, `activity`, `settings`) con jerarquía visual y estados de carga/vacío/error consistentes.
- **v0.9.1 (2026-02-22):** Ajuste de densidad visual en vistas operativas: `boxes` pasa a layout más compacto (menos altura por card y mejor uso de ancho), reducción global de spacing en listados/cards y corrección de alineación de checkboxes en `home`.
- **v1.0 (2026-02-23):** Slice 7 y Slice 8 completadas. Backend: tablas `change_log`, `processed_commands`, `sync_conflicts`; endpoints `/sync/push`, `/sync/pull`, `/sync/resolve`; export/import JSON de warehouse (`GET /warehouses/{warehouse_id}/export`, `POST /warehouses/{warehouse_id}/import`) con validación y remapeo de IDs en import cross-warehouse. Frontend: cola offline en IndexedDB (comandos), force sync en Settings, vista `/app/conflicts` para resolución, y UI de export/import en Settings. Migración `20260222_0006_slice7_slice8_sync_transfer` y tests backend `test_slice7_sync_conflicts.py`, `test_slice8_export_import.py`.
- **v1.1 (2026-02-23):** Infraestructura de despliegue añadida: `Dockerfile` para backend y frontend (Nginx SPA), manifests Kubernetes en `deploy/k8s` (namespace, config, secrets plantilla, PostgreSQL, job de migración Alembic, deployments/services e ingress Traefik por path `/` + `/api`). Ajustes de runtime: frontend usa `/api/v1` fuera de `localhost:4200`, backend permite `CORS_ORIGINS` configurable y Alembic acepta `DATABASE_URL` por entorno.
- **v1.2 (2026-02-24):** Nueva feature de sesión expirada/no válida: el frontend detecta respuestas `401` en peticiones autenticadas, limpia tokens locales y redirige automáticamente a `/login` preservando `redirect` a la ruta actual.
- **v1.3 (2026-02-24):** Refactor UX de inventario para densidad y jerarquía: vista de cajas en formato compacto (filas de baja altura con acciones inline), indicación jerárquica reforzada (nivel y ruta visible), y creación unificada en `/app/items/new` con selector de tipo para crear **artículo** o **caja** desde el mismo flujo.
- **v1.4 (2026-02-24):** Refinamiento visual de cards de artículos en Home: layout más compacto y legible (menos altura, menor peso visual), acciones de stock en iconos discretos y jerarquía de información reforzada (nombre + ruta + stock + acciones) manteniendo todas las operaciones existentes.
- **v1.5 (2026-02-24):** Refactor completo de jerarquía de cajas en UI: árbol realmente anidado con ramas visuales, expand/collapse por nodo, rutas completas en nodos y selects (crear/mover/alta de elemento/lote) para distinguir claramente contención padre→hijo sin ambigüedad.
- **v1.6 (2026-03-04):** Etiquetas imprimibles por caja en frontend: botón `Etiqueta` en árbol de cajas y botón `Imprimir etiqueta` en detalle de caja. La etiqueta incluye nombre de caja, `short_code`, QR escaneable (contenido = `qr_token`) y token visible como fallback manual.
- **v1.7 (2026-03-04):** Reprocesado LLM accionable desde cards de artículos (`Reprocesar tags`) y endpoint de reprocesado extensible por campos (`fields`) para soportar futuras ampliaciones. Integración de enriquecimiento con Gemini API real a partir de `name` + `description`, usando por defecto modelo costo-efectivo vigente `gemini-2.5-flash-lite` y endpoint `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` (con fallback heurístico backend ante error).
- **v1.8 (2026-03-04):** Rediseño de visualización en Home para alto volumen: cards más compactas y con miniatura (foto/placeholder), densidad por fila incrementada, y nueva vista en formato lista con selector `Cards/Lista` persistido en preferencias locales del navegador.
- **v1.9 (2026-03-04):** Refinamiento visual de Home basado en referencias de producto: vista `Lista` evoluciona a formato tabular denso para escritorio (columnas de artículo/ruta/stock/tags/acciones con scroll horizontal controlado) y vista `Cards` adopta patrón compacto tipo feed (avatar, texto jerárquico, badge de stock y acciones inline), manteniendo operaciones rápidas y selección por lote.
- **v1.10 (2026-03-04):** Ajuste de usabilidad en Home: panel de acciones por lote colapsable (la selección por checkbox solo aparece al activarlo), cards con nombre más compacto y badge de stock reubicado para no interferir en legibilidad, y tooltip en descripción para mostrar texto completo.
- **v1.11 (2026-03-04):** Refinamiento estético de cards en Home: stock presentado como micro-KPI independiente dentro de la card (etiqueta + valor) para mejorar jerarquía visual y evitar competición con título/descripción.
- **v1.12 (2026-03-04):** Ajuste visual iterativo del stock en cards de Home: se sustituye micro-KPI por indicador compacto con icono integrado en la barra de acciones, priorizando limpieza del bloque de contenido y consistencia operativa.
- **v1.13 (2026-03-04):** Alta asistida por foto (Slice 9 inicial): nuevo acceso en toolbar con icono de cámara y ruta `/app/items/from-photo` para sacar/subir imagen, endpoint backend `POST /warehouses/{warehouse_id}/items/draft-from-photo` que genera borrador de artículo (`name`, `description`, `tags`, `aliases`, `confidence`, `warnings`) usando Gemini Vision con fallback heurístico, y prefill automático en `/app/items/new` para que el usuario solo complete caja y confirme.
- **v1.17 (2026-03-04):** Persistencia real de fotos de artículos en servidor: nuevo endpoint `POST /photos/upload?warehouse_id=...` (multipart) que guarda imagen en disco (`/media/{warehouse_id}/{filename}`) y devuelve `photo_url`; el flujo de alta por cámara sube la imagen primero y precarga `photo_url` en `/app/items/new` para persistirla en `items.photo_url` y mostrar avatar en Home/otras vistas.
- **v1.14 (2026-03-04):** Frontend con configuración explícita por entorno (`development`/`production`) mediante archivos `environment` y `fileReplacements` de Angular CLI. En desarrollo, `apiBaseUrl` apunta a `http://localhost:8000/api/v1`; en producción, usa `/api/v1`.
- **v1.15 (2026-03-04):** Configuración LLM ampliada con selector de idioma de salida (`es` por defecto, `en` opcional) persistido por warehouse en `llm_settings.language`. El idioma se aplica a generación LLM en create/update/reprocess de item y en borrador desde foto (`draft-from-photo`). Frontend Settings añade selector Material de idioma y backend incorpora migración `20260304_0007_llm_settings_language`.
- **v1.16 (2026-03-04):** Ajuste UX de Settings LLM: `provider` pasa a selector con opción única `Gemini`, el campo `API key` se precarga con valor guardado (oculto por defecto con toggle mostrar/ocultar), y se elimina el bloque de reprocesado manual por `item_id` de la pantalla de configuración (la acción rápida en cards de Home se mantiene).
- **v1.18 (2026-03-04):** Mejora de inspección visual en Home: al pasar el ratón sobre el avatar de un artículo (desktop) se muestra preview ampliada de la imagen, y en móvil/táctil se abre al pulsar (tap) con cierre por backdrop o `Esc`.
- **v1.19 (2026-03-04):** Caja especial de entrada por warehouse: al crear un almacén se crea automáticamente una caja raíz `Entrada de mercancias` (`is_inbound=true`) para altas masivas pendientes de ubicación final. Esta caja se resalta en rojo en Árbol de cajas y la ruta del artículo en Home se muestra en rojo cuando el artículo está dentro de ella. Backend añade migración `20260304_0008_inbound_box` y bloquea el borrado de la caja especial.
- **v1.20 (2026-03-04):** Refactor de usabilidad móvil en frontend: toolbar del shell simplificada en móvil (acciones clave + menú `more`), mejora global de safe areas/targets táctiles/stacking de formularios y cabeceras, y Home adaptada a mobile-first (filtros apilados, rail de acciones táctil en cards, preview de foto anclada en pantalla y forzado de vista `Cards` en pantallas pequeñas).
- **v1.21 (2026-03-04):** Fix crítico de compatibilidad móvil/webview en Home: se elimina dependencia rígida de `crypto.randomUUID()` (fallback UUID con `getRandomValues`/Math) para evitar crash en clientes sin soporte completo; además, el título de toolbar móvil se trunca por ancho para impedir solapes en pantallas estrechas.
- **v1.22 (2026-03-04):** Segunda pasada responsive transversal en frontend: se eliminan estilos inline en pantallas operativas (`scan`, `items/from-photo`, `settings`, `conflicts`, `trash`, `box-detail`, `warehouses`) y se consolidan utilidades responsive globales (espaciado, acciones full-width en móvil, bloques multimedia y render seguro de payload JSON largo) para asegurar consistencia de uso en móvil/tablet.
- **v1.23 (2026-03-05):** Refactor responsive de `Árbol de cajas` en móvil: se elimina el desbordamiento horizontal en nodos (cabecera y acciones apiladas/en grid), se compacta la indentación de ramas para pantallas estrechas y se fuerza wrapping de rutas/textos largos para mantener la vista usable sin scroll lateral.
- **v1.24 (2026-03-05):** Ajuste de acciones en `Árbol de cajas`: los botones de texto de acciones por nodo se reemplazan por iconos representativos con `tooltip` descriptivo (`Ver`, `Etiqueta`, `Renombrar`, `Mover`, `Papelera`) para reducir ruido visual y mantener claridad operativa.
- **v1.25 (2026-03-05):** Ajuste de layout desktop dentro de la shell: las vistas operativas (`.app-page`/`.page-wide`) amplían su ancho máximo cuando hay espacio horizontal disponible, reduciendo márgenes laterales vacíos en pantallas grandes sin alterar comportamiento en móvil/tablet.
- **v1.26 (2026-03-05):** Refactor de detalle de caja alineado con Home: se extraen componentes reutilizables `item-card` y `item-list`, el detalle de caja renderiza artículos con los mismos componentes visuales/operativos que Home (cards/lista), cabecera de detalle pasa a acciones iconográficas con `tooltip` (`print`, `add`, `photo_camera`), y el flujo `/app/items/from-photo` soporta contexto de caja (`boxId` + `lockBox`) para fijar la caja destino al crear desde foto en detalle. Backend amplía `GET /warehouses/{warehouse_id}/boxes/{box_id}/items` con payload compatible con Home (+ `box_path_ids`).
- **v1.27 (2026-03-05):** Ajuste de legibilidad en vista `Lista` de artículos: la columna `Ruta` aumenta su ancho mínimo/máximo para reducir truncados agresivos de nombres de cajas largas en Home y detalle de caja.
- **v1.28 (2026-03-05):** Refinamiento UX en móvil para detalle de caja: el bloque de acciones de cabecera (`print`, `add`, `photo_camera`) deja de usar layout heredado de botones full-width y pasa a una banda compacta de 3 acciones en una sola fila, con targets táctiles claros y proporciones estables.
- **v1.29 (2026-03-05):** Ajuste de acciones de producto en móvil: se elimina el modo “rail scrollable” en cards (`product-actions-mobile`) y se reemplaza por distribución con wrapping sin contenedor con overflow, evitando scroll vertical/artefactos visuales en Home y detalle de caja.
- **v1.30 (2026-03-05):** Ajuste de comprensión en cards de artículos: los controles de stock `+/-` se integran dentro del badge de stock para vincular explícitamente la acción con el número mostrado.
- **v1.31 (2026-03-05):** Reorganización visual del bloque `product-actions` en cards: stock y acciones rápidas pasan a layout estructurado en dos filas (badge de stock + grid estable de acciones), eliminando saltos desordenados de botones y mejorando consistencia visual en móvil.
- **v1.32 (2026-03-05):** Ajuste fino del badge de stock en cards: `product-stock-inline` pasa a ocupar siempre todo el ancho disponible, con valor centrado y botones `-/+` anclados a los lados con separación interna consistente respecto al borde.
- **v1.33 (2026-03-05):** Refactor de filtro de tags en Home: la fila lineal de chips se reemplaza por una **nube de tags** con peso visual por frecuencia (tamaño tipográfico y cromática variable), wrapping responsive, estado activo más destacado y contador integrado por tag, manteniendo el filtrado por click y la acción de limpiar tag.
- **v1.34 (2026-03-05):** Feedback transversal de acciones en frontend con snackbars Material (`MatSnackBar`) para confirmaciones y errores operativos. Se añade `NotificationService` reutilizable (success/error/info), estilos globales de snackbar por severidad y adopción en acciones principales de `home`, `boxes`, `box-detail`, `item-form`, `settings`, `warehouses`, `trash`, `conflicts`, `scan`, `item-photo-capture`, `accept-invite` y `shell` (logout).
- **v1.35 (2026-03-05):** Hardening del flujo `/app/items/from-photo` ante fallos intermitentes de previsualización en móvil: validación de fichero más robusta (incluye `image/jpg`, tamaño 0 y fallback por extensión cuando el MIME llega vacío), preservación del archivo seleccionado aunque falle el render de la preview, y mensajes de error visibles/no silenciosos para que el usuario pueda continuar con "Analizar foto".
- **v1.36 (2026-03-05):** Estabilización adicional de preview en `/app/items/from-photo` para móvil: la previsualización pasa de `blob:` URL temporal a `data URL` estable (`FileReader`) y se reutiliza en el análisis IA para minimizar desapariciones intermitentes tras mostrarse la imagen.
- **v1.37 (2026-03-05):** Blindaje ante remount de vista en `/app/items/from-photo`: se añade estado temporal en servicio frontend (`file`, `preview`, flags) para restaurar automáticamente la foto seleccionada si el componente se vuelve a crear durante el flujo móvil, evitando que la preview desaparezca por pérdida de estado local.
- **v1.38 (2026-03-05):** Captura masiva por caja (Slice 10): nuevo flujo `/app/items/intake-batch` para subir N fotos por lote, procesarlas en paralelo en backend, revisar/editar inline (`name`, `description`, `tags`, `aliases`) y hacer commit masivo a una caja destino. Backend añade tablas `intake_batches` + `intake_drafts`, endpoints de intake (`create/upload/start/get/update/commit/delete`), procesamiento paralelo server-side desde `photo_url` con estados (`uploaded/processing/ready/review/rejected/error/committed`) y migración `20260305_0009_intake_batches`. Frontend integra acceso desde toolbar y detalle de caja (`collections`) y nueva pantalla de validación operativa.
- **v1.39 (2026-03-05):** Ajuste UX en revisión de intake masivo: acciones por borrador pasan a iconografía con `tooltip` descriptivo (guardar/listo/revisión/rechazar/reintentar IA), y `Reintentar IA` deja de depender solo de estado `error` para permitir reproceso manual desde cualquier borrador no comprometido. El reproceso backend ahora usa contexto adicional (`name` + `description` editados) junto con la foto para mejorar la inferencia.
- **v1.40 (2026-03-05):** Refinamiento semántico de reprocesado en intake masivo: al reintentar IA, el `name` editado por el usuario pasa a ser **autoritativo** (no se sobrescribe con una nueva predicción de nombre), y el reproceso usa foto + `name` + `description` para recalcular principalmente descripción/tags/aliases.
- **v1.41 (2026-03-05):** Ajuste de prompt en inferencia por foto (single y batch): el modelo debe clasificar **solo un objeto**, priorizando el elemento en primer plano y más enfocado, ignorando soportes/fondo/objetos secundarios (p. ej. móvil sobre alfombrilla → `móvil`).
- **v1.42 (2026-03-05):** Regla de contexto en `Reintentar IA` para intake: si el usuario cambió el nombre propuesto por IA, el reproceso usa `foto + name`; si no lo cambió, reprocesa solo con la foto. Se añade `suggested_name` en `intake_drafts` (migración `20260305_0010_intake_suggested_name`) para detectar este caso de forma explícita.
- **v1.43 (2026-03-05):** Refactor visual del panel de acciones en `/app/items/intake-batch` para móvil: botones de lote pasan a layout en grid (2 columnas) con ancho/alto uniforme y botón principal de commit a ancho completo, eliminando alineación irregular y tamaños dispares.
- **v1.44 (2026-03-05):** Persistencia operativa de lotes de captura masiva en estado borrador y reanudación desde shell: se añade `GET /warehouses/{warehouse_id}/intake/batches` (filtros `include_committed`, `only_mine`, `limit`) para listar lotes abiertos, y el panel lateral incorpora sección `Lotes en borrador` con enlaces directos a `/app/items/intake-batch?batchId=...` para continuar un inventariado interrumpido sin perder progreso.
- **v1.45 (2026-03-05):** Gestión de borrado de lotes y ajuste visual del panel lateral: se habilita eliminación explícita de lote desde `/app/items/intake-batch` y desde la sección `Lotes en borrador` del shell (con bloqueo en estado `processing`), y se refactoriza su presentación en sidenav a filas compactas con acción de abrir + eliminar para evitar desalineaciones de tamaño/alineación en móvil y escritorio.
- **v1.46 (2026-03-05):** Storage temporal por lote en intake masivo: las fotos de borradores se guardan en carpeta temporal por lote (`/media/{warehouse_id}/intake/{batch_id}/...`) para permitir reanudación fiable; al crear artículos en commit se mueven a storage definitivo de producto (`/media/{warehouse_id}/items/...`) y se limpia la carpeta temporal del lote cuando ya no aplica (batch comprometido o eliminado).
- **v1.47 (2026-03-05):** Robustez de parseo JSON en respuestas Gemini: el backend de enriquecimiento (foto/tags) ahora acepta JSON con texto envolvente o contenido adicional (p. ej. bloques markdown o texto tras el objeto JSON) usando extracción tolerante de la primera entidad JSON válida, evitando fallos `JSONDecodeError: Extra data` y reduciendo caídas a fallback heurístico por formato.
- **v1.48 (2026-03-05):** Política de fallback configurable de modelos Gemini por warehouse: `llm_settings` añade `model_priority` (migración `20260305_0011_llm_model_priority`), `GET/PUT /settings/llm` incluye el orden completo de modelos y el backend aplica fallback en cascada para tags/aliases, draft por foto y intake batch (si un modelo falla por límite/error de request/formato, prueba el siguiente). Frontend Settings incorpora UI para reordenar prioridades (default: Gemini 3.1 Flash Lite → Gemini 3 Flash → Gemini 2.5 Flash → Gemini 2.5 Flash Lite).
- **v1.49 (2026-03-05):** Corrección de 404 en modelos Gemini 3 al generar por foto/tags: cuando un ID configurado no existe con nombre estable (p. ej. `gemini-3-flash`), backend prueba variantes runtime (`-preview`/`-latest`) del mismo modelo antes de pasar al siguiente de `model_priority`, reduciendo falsos fallos por nomenclatura de versión.
- **v1.50 (2026-03-05):** Refactor de lotes a módulo dedicado: se elimina el panel dinámico de lotes en sidenav y se añade sección `Lotes` con vista de listado (`/app/batches`) + detalle (`/app/batches/:batchId`). El detalle de lote pasa a flujo operativo por estados de UX `Nuevo/Procesado/Error/Guardado` con tablero por bloques (foto+título), acciones iconográficas con `tooltip` (añadir foto, guardar procesados, reprocesar errores, eliminar lote) y edición manual en error con acción `Marcar como procesado`. Backend intake elimina fallback local sin IA durante procesamiento de lote: si no hay resultado LLM válido, el draft queda en `error`; además `retry_errors=true` reprocesa **solo** errores en secuencia (1 a 1).
- **v1.51 (2026-03-05):** Regla de stock inicial en altas de artículo: todo artículo nuevo nace con stock `1` mediante creación automática de `StockMovement` inicial (`delta=+1`) en los flujos de alta normal (`POST /warehouses/{warehouse_id}/items`), commit de intake batch y `item.create` vía sync. Se añade registro de `change_log` de tipo `stock` para sincronización consistente entre clientes.
- **v1.52 (2026-03-05):** Detalle de lote con control granular por borrador: la card de artículo seleccionado añade cierre explícito (`X`) y reapertura por click en mini-card del resumen; se incorporan acciones iconográficas con `tooltip` por artículo (`Re-procesar IA por foto`, `Re-procesar IA por título`, `Eliminar artículo`). Backend expone `POST /warehouses/{warehouse_id}/intake/drafts/{draft_id}/reprocess` (modo `photo|name`) y `DELETE /warehouses/{warehouse_id}/intake/drafts/{draft_id}` con limpieza de media temporal por borrador.
- **v1.53 (2026-03-05):** Observabilidad ampliada del pipeline LLM en backend: se añaden logs `INFO/DEBUG` por petición de IA con identificador de operación, orden de `model_priority`, intentos por modelo configurado y alias runtime, modelo ganador que resuelve cada petición (tags/aliases y draft por foto) y trazado explícito de fallback cuando falla un intento y se pasa al siguiente modelo/alias o a fallback heurístico.
- **v1.54 (2026-03-05):** Hardening de observabilidad y flujo de lotes: todos los fallos backend registrados con logging de severidad `ERROR` (incluyendo fallos de autenticación/acceso y fallos de IA/fallback por modelo), `POST /warehouses/{warehouse_id}/intake/batches/{batch_id}/photos` permite añadir nuevas fotos a lotes previamente `committed` (reabriendo estado operativo del lote), y en frontend detalle de lote sincroniza correctamente los campos del editor al llegar resultados IA para artículos recién añadidos (evita formulario en blanco tras procesado sin necesidad de refrescar la página).
- **v1.55 (2026-03-05):** UX de búsqueda en frontend sin acción explícita de submit: se elimina el botón `Buscar` en Home y Detalle de caja, y ambos buscadores funcionan en tiempo real mientras se escribe con `debounce` (300ms), manteniendo botón `Limpiar` para reset inmediato de filtros.

---

## Cómo trabajar con este fichero (instrucciones para Codex)

Este fichero **es la fuente de verdad** de la aplicación.

**Reglas de oro:**
1. **Antes de implementar**, lee las secciones relevantes y valida que lo que vas a construir está descrito aquí.
2. **Cada PR/commit importante** debe:
   - Implementar una parte concreta (slice/ticket).
   - Actualizar `specs.md` si cambió algún detalle (UX, API, modelo, reglas, decisiones).
   - Añadir una entrada en el **Changelog** (arriba).
3. Si el usuario pide cambios:
   - **Primero** actualiza `specs.md` (o en el mismo cambio) y luego implementa.
4. Mantén el documento organizado:
   - No borres información histórica relevante: muévela a “Decisiones” o “Changelog”.
   - Si un requisito cambia, deja claro cuál es el comportamiento actual.
5. Si detectas una ambigüedad durante implementación, añade una sección **“Open Questions / Assumptions”** al final y toma una decisión razonable (documentada).

**Formato recomendado para cambios:**
- Actualiza la sección correspondiente (p.ej. API, Modelo, UX).
- Añade entrada al Changelog con: fecha, resumen, impacto, migraciones si aplica.

---

## Tabla de contenidos

1. [Resumen](#resumen)  
2. [Objetivos y no-objetivos](#objetivos-y-no-objetivos)  
3. [Conceptos del dominio](#conceptos-del-dominio)  
4. [UX / Pantallas / Flujos](#ux--pantallas--flujos)  
5. [Requisitos funcionales (Epics + User Stories)](#requisitos-funcionales-epics--user-stories)  
6. [Arquitectura y stack](#arquitectura-y-stack)  
7. [Modelo de datos (PostgreSQL)](#modelo-de-datos-postgresql)  
8. [API (REST) - Endpoints](#api-rest---endpoints)  
9. [Búsqueda, tags, alias](#búsqueda-tags-alias)  
10. [QR (solo cajas)](#qr-solo-cajas)  
11. [Offline-first + Sync + Conflictos](#offline-first--sync--conflictos)  
12. [LLM (Gemini): tags y alias automáticos](#llm-gemini-tags-y-alias-automáticos)  
13. [Requisitos no funcionales](#requisitos-no-funcionales)  
14. [Plan de implementación (vertical slices)](#plan-de-implementación-vertical-slices)  
15. [Definición de Done](#definición-de-done)  
16. [Open Questions / Assumptions](#open-questions--assumptions)

---

## Resumen

**my-warehouse** es una aplicación PWA para **localizar rápidamente** objetos guardados en un garaje/trastero usando:
- **Cajas jerárquicas** (cajas dentro de cajas).
- **Artículos** con foto opcional, stock y favoritos.
- **QR por caja** para acceder a su contenido con escaneo desde móvil.
- **Búsqueda instantánea** por múltiples campos.
- **Offline-first + sincronización** con resolución de conflictos.
- **Enriquecimiento automático** con LLM (Gemini): tags y alias sin mantenimiento manual.

UI basada en **Material Design**, responsive para **móvil, tablet y escritorio**.

---

## Objetivos y no-objetivos

### Objetivos
1. Encontrar artículos rápido por **búsqueda** o **escaneo QR**.
2. Visualizar la **ruta jerárquica** (Caja A > Caja B > …) para saber dónde está cada cosa.
3. Operaciones rápidas: ⭐ favoritos, +/- stock, mover (drag & drop), acciones en lote.
4. Multiusuario desde el día 1 (sin roles).
5. Offline-first real + sync + conflictos.
6. Tags y alias automáticos via Gemini.
7. Configuración central (SMTP + Gemini + preferencias).
8. Fotos en storage con URLs cacheables (mejor rendimiento y caché).

### No-objetivos (por ahora)
- QR por artículo.
- Plantillas de impresión avanzadas (solo vista del QR + código corto).
- Roles/permisos granulares.
- 2FA.
- Integraciones externas complejas (más allá de SMTP + Gemini).

---

## Conceptos del dominio

### Warehouse (Almacén / Workspace)
- Contenedor compartido (ej. “Garaje”).
- Varios usuarios pueden pertenecer al mismo warehouse.
- Un usuario puede pertenecer a varios warehouses.
- Sin roles: todos los miembros tienen los mismos permisos.
- Al crearse, inicializa automáticamente una caja raíz especial de entrada (`Entrada de mercancias`) para agrupar artículos recién incorporados.

### Box (Caja)
- Nodo de un árbol: puede contener artículos y otras cajas.
- Propiedades:
  - Nombre (si no se especifica: “Caja N” incremental por warehouse)
  - Descripción opcional
  - Ubicación física opcional
  - **QR único** + **código corto** humano (visible bajo el QR)
  - Flag `is_inbound` (booleano): identifica la caja especial de entrada por warehouse.

### Item (Artículo)
- Propiedades (mínimo):
  - Foto opcional (si no, placeholder)
  - Nombre
  - Descripción opcional
  - Stock (operación rápida +/-1)
  - Favorito ⭐ (por usuario)
  - Ubicación física opcional
  - Tags y alias (automáticos via LLM)

### Stock como eventos (movimientos)
- El stock **no** se edita como un número “mutable” sin historial.
- Se calcula como la suma de movimientos:
  - `+1` inicial automático al crear un artículo (alta estándar, intake commit y alta por sync)
  - `+1` / `-1` (rápido)
  - (opcional futuro) ajuste “set to N”
- Ventaja: mergeable en sync, reduce conflictos y da auditoría.

---

## UX / Pantallas / Flujos

### Rutas principales
- `/login`
- `/signup`
- `/forgot-password`
- `/invites/:token` (aceptar invitación)
- `/warehouses` (lista + crear + seleccionar)
- `/app` (shell)
  - `/app/home` (buscador + favoritos)
  - `/app/batches` (listado de lotes de captura)
  - `/app/batches/:batchId` (detalle operativo de lote)
  - `/app/items/new`
  - `/app/items/from-photo` (captura/subida + inferencia IA)
  - `/app/items/intake-batch` (ruta legacy redirigida a `/app/batches`)
  - `/app/items/:id` (detalle/edición)
  - `/app/boxes` (árbol de cajas)
  - `/app/boxes/:id` (detalle de caja)
  - `/app/scan` (escaneo QR)
  - `/app/scan/:qrToken` (deep link con token)
  - `/app/trash` (papelera + restauración)
  - `/app/activity` (actividad mínima)
  - `/app/settings` (configuración)
  - `/app/conflicts` (lista + resolución)

### Shell (Material)
- Toolbar superior con:
  - escritorio: chip de warehouse activo + accesos directos (QR, cámara individual, lotes, settings, salir)
  - móvil: accesos esenciales visibles (menú lateral + QR) y resto de acciones en menú overflow (`more_vert`) para evitar saturación horizontal, incluyendo acceso a lotes
- navegación lateral con iconografía y estado activo por sección
- navegación lateral con módulo dedicado `Lotes` (enlace de primer nivel) que lleva a vista de listado y gestión de lotes
- Responsive:
  - móvil: navegación compacta (sidenav overlay), toolbar optimizada para notch/safe-area y targets táctiles amplios
  - tablet/escritorio: sidenav persistente
  - escritorio ancho (`>=1200px`): el contenido principal de la ruta activa se expande hasta un máximo mayor para aprovechar mejor el área útil disponible junto al sidenav

### Reglas responsive transversales
- Se evita `style` inline en vistas de producto; el layout responsive se centraliza en clases reutilizables para mantener coherencia entre pantallas.
- En móvil (`<=600px`), acciones primarias/secundarias en bloques operativos se apilan a ancho completo cuando compiten por espacio horizontal.
- Contenedores multimedia (video/preview de foto) usan ancho fluido y límites de alto para no romper el flujo vertical.
- Contenido técnico largo (p. ej., payload JSON de conflictos, tokens y enlaces) fuerza `word-break`/`pre-wrap` para evitar desbordes.
- En móvil no se permite overflow horizontal de la página en vistas operativas; cuando una sección tiene alta densidad (árboles, metadatos, acciones), la prioridad es reflow vertical (stack/grid) antes que scroll lateral.

### Feedback de acciones
- Las acciones explícitas de usuario (crear/guardar/mover/borrar/restaurar/sync/import/export/resolver conflictos) muestran feedback inmediato con snackbar en la esquina inferior derecha.
- Se usan tres severidades visuales consistentes: `success` (confirmación), `error` (fallo), `info` (estado operativo no bloqueante, p. ej. comandos offline en cola).
- Los mensajes inline existentes se mantienen para contexto persistente de pantalla; el snackbar cubre confirmación/error inmediata de la acción disparada.

### Home
- Buscador arriba (input fijo).
- Estado inicial: favoritos del usuario + chips de filtros rápidos.
- Al escribir: filtra y ordena por relevancia.
- Acciones rápidas en cada card/lista con iconografía consistente (favorito, +/- stock, editar, reprocesar, borrar) y `tooltip` descriptivo por acción para mantener claridad sin perder densidad visual.
- Acción principal: **Nuevo elemento** (desde ahí se elige crear artículo o caja).
- Visualización conmutable entre `Cards` y `Lista` mediante selector en la propia Home (preferencia persistida en cliente) en escritorio/tablet; en móvil se prioriza siempre `Cards` para legibilidad y operación táctil.
- Cards de artículos compactas: prioridad a densidad (más elementos visibles por fila), miniatura de producto y jerarquía clara (nombre, ruta, stock, tags y acciones inline).
- El avatar de artículo permite preview ampliada de foto para inspección rápida: hover contextual en escritorio y panel fijo inferior en móvil/táctil, sin salir de Home.
- La ruta del artículo se resalta en rojo si su caja actual es la caja especial de entrada.
- Vista lista: filas densas para escaneo rápido de muchos artículos con las mismas acciones operativas (favorito, stock, editar, reprocesar tags, borrar).
- En escritorio, la vista lista usa tabla densa con encabezados por columna para maximizar comparación visual entre artículos; en pantallas pequeñas mantiene legibilidad mediante contenedor con scroll horizontal.
- El panel de acciones por lote está colapsado por defecto y al activarlo habilita selección visual por checkbox en cards/lista; al cerrarlo limpia selección para evitar estado oculto.
- La descripción en cards/lista mantiene truncado visual y expone el contenido completo mediante tooltip.
- La nube de tags en Home pondera visualmente cada tag según su frecuencia (más uso = más tamaño/peso visual) para facilitar escaneo y priorización de filtros frecuentes.
- En móvil, filtros/checkboxes/nube de tags de Home se apilan en una sola columna; la nube permite scroll vertical acotado y las acciones rápidas de cada card mantienen layout táctil con wrapping para evitar botones diminutos o saltos de línea confusos.

### Árbol de cajas
- Árbol con expand/collapse (Material Tree).
- Drag & drop:
  - mover caja dentro de otra caja
  - mover artículo a otra caja
- Mostrar contadores por caja:
  - total artículos recursivo
  - total cajas recursivo
- Presentación compacta:
  - filas densas (menor altura por nodo, sin desperdicio de espacio)
  - jerarquía explícita con nivel y ruta (breadcrumb textual)
  - ramas anidadas visuales (padre/hijos) con connectors
  - en móvil, ramas con indentación reducida y conectores compactos para evitar overflow por profundidad
  - en móvil, cabecera del nodo y acciones se apilan con wrapping (sin carriles horizontales por nodo)
  - selectors de caja con ruta completa (`Raíz > ... > Caja`) para evitar homónimos
- La caja especial de entrada se muestra visualmente destacada en rojo y con badge `Entrada`.
- Acciones por nodo en formato iconográfico (Material Icons) con tooltip textual para mantener densidad y descubribilidad (`Ver`, `Etiqueta`, `Renombrar`, `Mover`, `Papelera`).

### Detalle de caja (clave)
- Header: nombre caja + QR + código corto (pequeño bajo QR).
- Acciones de cabecera en iconos con tooltip: `print` (imprimir etiqueta), `add` (nuevo elemento), `photo_camera` (alta por foto contextual) y `collections` (captura masiva contextual).
- Buscador interno incremental con `debounce` (actualiza resultados al escribir, sin botón `Buscar`).
- Lista de artículos recursivos renderizada con los mismos componentes reutilizables que Home (`item-card` / `item-list`) para mantener consistencia visual y funcional.
- Cada fila/card muestra ruta completa (breadcrumb) `Caja raíz > … > Caja actual > …`.
- La ruta es navegable por tramo en detalle de caja (navega a la caja correspondiente).
- En alta por foto iniciada desde detalle, tras la inferencia IA la caja destino queda fijada a la caja actual (`lockBox`) en `/app/items/new`.
- En captura masiva iniciada desde detalle, la caja destino del lote queda fijada por contexto (`boxId` + `lockBox`) en el módulo `/app/batches` para evitar reasignaciones accidentales.

### Scanner QR
- Icono en header → vista escáner.
- Escaneo → navega a detalle de caja.
- Deep link:
  - si no login: login y redirección a caja
  - si login sin pertenencia: error “sin acceso”

### Settings (Configuración)
Secciones:
1) Perfil  
2) Seguridad (cambiar contraseña)  
3) Email (SMTP) + test email  
4) LLM (Gemini):
   - Provider en selector (actualmente opción única: `Gemini`)
   - API key (guardada cifrada en backend) precargada en input oculto con toggle mostrar/ocultar
   - idioma de salida para generación (`es` por defecto, `en` opcional)
   - orden de prioridad de modelos Gemini configurable (reordenable) para fallback automático en cascada
   - toggles: auto-tags / auto-alias
   - acceso rápido desde cards de artículos: botón `Reprocesar tags` (sin bloque manual por `item_id` en Settings)
5) Offline/Sync:
   - estado conexión, cola, “forzar sync”
   - acceso a conflictos

---

## Requisitos funcionales (Epics + User Stories)

### EPIC A — Autenticación y cuenta
**US-A1: Registro**
- [x] Registro con email + password.
- [x] Validación password (mínimo longitud, etc.).
- [x] Tras registro: acceso a crear/seleccionar warehouse.

**US-A2: Login/Logout**
- [x] Login devuelve access token + refresh token.
- [x] Logout invalida refresh token.
- [x] Sesión persistente (PWA).

**US-A3: Cambio de contraseña**
- [x] Usuario autenticado puede cambiar contraseña (requiere password actual).

**US-A4: Recuperación de contraseña por email**
- [x] Solicitud reset → email con link token.
- [x] Token caduca, un solo uso.
- [x] Tras reset, refresh tokens previos quedan invalidados.

**US-A5: Expiración/invalidación de sesión**
- [x] Si el backend responde `401` en una petición autenticada, el cliente invalida sesión local.
- [x] Redirección automática a `/login`.
- [x] Conserva `redirect` para volver a la ruta previa tras login.

---

### EPIC B — Warehouses (multiusuario sin roles)
**US-B1: Crear warehouse**
- [x] Crear warehouse con nombre.
- [x] Creador queda como miembro.

**US-B2: Listar/seleccionar warehouses**
- [x] Listar warehouses donde el usuario es miembro.
- [x] Selección persistida en cliente.

**US-B3: Invitar usuario**
- [x] Generar invitación (token/link).
- [ ] Opcional: enviar por email (SMTP).
- [x] Expira.
- [x] Aceptar → miembro.

**US-B4: Ver miembros**
- [x] Miembros visibles para cualquier miembro.

---

### EPIC C — Cajas (árbol)
**US-C1: Crear caja**
- [x] Crear en raíz o bajo `parent_box_id`.
- [x] Si no nombre: “Caja N” incremental por warehouse.
- [x] Genera QR token + short_code único.

**US-C2: Editar caja**
- [x] Editar nombre, descripción, ubicación física opcional.

**US-C3: Mover caja**
- [x] Drag & drop cambia parent.
- [x] Prohibido crear ciclos (no mover dentro de un descendiente).

**US-C4: Borrado seguro**
- [x] Soft-delete a papelera.
- [x] Si contiene elementos, requiere confirmación explícita.
- [x] Restauración.

**US-C5: Conteos**
- [x] Mostrar:
  - `total_items_recursive`
  - `total_boxes_recursive`

**US-C6: Jerarquía visible y compacta**
- [x] Listado de cajas en formato compacto (optimizado para más nodos visibles).
- [x] Diferenciación clara de nivel jerárquico por nodo.
- [x] Ruta de caja visible para reducir ambigüedad de contexto.
- [x] Árbol anidado con expand/collapse y líneas de rama para identificar contención.

---

### EPIC D — Artículos
**US-D1: Crear artículo**
- [x] Campos: name (req), desc (opt), photo (opt), box (req), ubicación física (opt).
- [x] Stock inicial obligatorio en alta: todo artículo nuevo nace con stock `1`.
- [x] Enriquecimiento LLM (tags + alias) si habilitado.

**US-D2: Editar artículo**
- [x] Cambiar name/desc/photo/box/ubicación.
- [x] Si cambia name/desc → re-LLM (si habilitado).

**US-D3: Favoritos por usuario**
- [x] Toggle ⭐ por usuario.
- [x] Home muestra favoritos por defecto.

**US-D4: Stock rápido**
- [x] +/-1 crea `StockMovement` idempotente (command_id).
- [x] Stock mostrado = suma movimientos.

**US-D5: Borrado seguro**
- [x] Soft-delete + restauración.

**US-D6: Acciones en lote**
- [x] Selección múltiple + acciones:
  - mover a caja
  - marcar/desmarcar favoritos
  - borrar

**US-D7: Alta unificada de elemento**
- [x] En `/app/items/new`, el usuario elige tipo de alta: **Artículo** o **Caja**.
- [x] Si selecciona Caja, se crea `box` con padre opcional usando el mismo flujo.
- [x] El acceso principal se etiqueta como “Nuevo elemento”.

**US-D8: Alta de artículo vía foto + LLM**
- [x] Desde toolbar (`icono cámara`), el usuario puede sacar/subir foto para inferir metadatos del artículo.
- [x] Backend devuelve borrador estructurado (`name`, `description`, `tags`, `aliases`, `confidence`, `warnings`) con fallback local si Gemini falla o no está configurado.
- [x] El formulario `/app/items/new` se abre pre-rellenado y mantiene edición manual completa; el usuario debe seleccionar/confirmar caja antes de guardar.
- [x] Si el navegador no puede renderizar la preview de la foto (casos HEIC/compatibilidad), la UI mantiene el fichero seleccionado, muestra error visible y permite continuar con el análisis.
- [x] La preview se genera con `data URL` estable en memoria para reducir pérdidas de imagen intermitentes en móvil tras captura.
- [x] Si la vista de captura se remonta (render/navegación móvil), la foto seleccionada se restaura automáticamente desde estado temporal y no se pierde el flujo.

**US-D9: Captura masiva por caja + revisión operativa**
- [x] Existe módulo dedicado `Lotes` con vista de listado (`/app/batches`) y detalle (`/app/batches/:batchId`), accesible desde sidenav, toolbar y detalle de caja.
- [x] El usuario puede crear lote por caja destino y abrirlo para gestión operativa temporal.
- [x] El usuario puede subir `N` fotos en lote (multipart) sin pasar por formulario item por item.
- [x] Estados operativos de UX por artículo en lote: `Nuevo`, `Procesado`, `Error`, `Guardado`.
- [x] En detalle de lote se muestra tablero resumen en 4 bloques (`Nuevo/Procesado/Error/Guardado`) con mini-cards (solo foto + título).
- [x] Acciones del lote en iconos con `tooltip`: `Añadir artículo`, `Guardar procesados`, `Reprocesar errores`, `Eliminar lote`.
- [x] Si el procesamiento IA falla en un artículo (incluyendo falta de API key o fallo de todos los modelos), el draft queda en `Error` sin fallback local no-IA.
- [x] Desde `Error`, el usuario puede editar manualmente `name`, `description`, `tags`, `aliases` y marcar el draft como `Procesado`.
- [x] `Reprocesar errores` actúa solo sobre drafts en `Error` y se ejecuta secuencialmente (1 a 1).
- [x] `Guardar procesados` crea artículos en caja destino para drafts en estado procesado.
- [x] La card de detalle del artículo seleccionado se puede cerrar con `X`; al pulsar una mini-card del resumen, el detalle se vuelve a abrir con el draft correspondiente.
- [x] La card de artículo incluye acciones por draft con iconos + `tooltip`: reproceso IA por foto, reproceso IA por título (`name`) y eliminación del draft.

---

### EPIC E — Búsqueda + filtros + nube de tags
**US-E1: Búsqueda de artículos**
- [x] Busca por: nombre, descripción, tags, alias, ruta, ubicación física.
- [x] Actualización incremental con debounce.
- [x] Orden por relevancia (match exacto > parcial).

**US-E2: Filtros rápidos**
- [x] Chips: Favoritos, Stock=0, Con foto, Sin foto, etc.

**US-E3: Nube de tags**
- [x] Chips discretos.
- [x] Click en tag filtra.

---

### EPIC F — QR (solo cajas)
**US-F1: Escaneo desde header**
- [x] Permisos cámara con UX claro.
- [x] Escaneo abre detalle caja.

**US-F2: Deep link seguro**
- [x] QR token no adivinable.
- [x] Login redirect.
- [x] Control acceso por warehouse.

**US-F3: Etiqueta imprimible de caja**
- [x] Desde árbol de cajas y detalle de caja se puede lanzar impresión.
- [x] La etiqueta imprime nombre de caja + `short_code` + QR escaneable.
- [x] El QR codifica `qr_token` (compatible con scanner interno) y se muestra token en texto como respaldo.

---

### EPIC G — Configuración (SMTP + Gemini)
**US-G1: Config SMTP**
- [x] Por warehouse.
- [x] Guardado seguro (password cifrado).
- [x] “Test email”.

**US-G2: Config Gemini API key**
- [x] Guardada cifrada en backend.
- [x] Idioma de salida configurable (`es` por defecto, `en` opcional) y persistido por warehouse.
- [x] Orden de prioridad de modelos Gemini configurable por warehouse (fallback en cascada).
- [x] Toggles auto-tags/auto-alias.
- [x] Reprocesar tags/alias.

---

### EPIC H — Offline + Sync + Conflictos
**US-H1: Usable offline**
- [ ] Shell offline.
- [ ] Datos recientes offline (IndexedDB).
- [ ] Crear/editar/mover/stock offline → cola.

**US-H2: Sync automático**
- [ ] Al reconectar: push comandos + pull cambios.
- [ ] UI de estado (offline/sync/pendiente).

**US-H3: Conflictos**
- [ ] Lista de conflictos.
- [ ] Resolución: keep server / keep client / merge.
- [ ] Stock no conflict (eventos mergeables).

---

### EPIC I — Export/Import
**US-I1: Export**
- [ ] Export JSON (mínimo) + CSV (opcional).
- [ ] Incluye cajas, items, tags, alias, movimientos.

**US-I2: Import**
- [ ] Import JSON validado con reporte de errores.
- [ ] Evita duplicados por IDs.

---

## Arquitectura y stack

### Frontend
- Angular (PWA) + Angular Material (Material Design).
- Configuración por entorno de build con Angular CLI (`fileReplacements`): `environment.ts` (dev) y `environment.prod.ts` (prod).
- IndexedDB (recomendado: Dexie) para offline cache + cola comandos.
- Angular Service Worker para cache de shell y assets.
- UI: Material Tree, CDK DragDrop, virtual scroll (CDK) en listas grandes.

### Backend
- FastAPI (REST).
- SQLAlchemy 2.x (ORM).
- Alembic (migraciones).
- PostgreSQL.
- Auth: JWT access + refresh; hashing Argon2 (preferible).
- Email: SMTP configurable (por warehouse) y test.
- Fotos: storage + URLs cacheables (S3/MinIO o filesystem gestionado) + ETag/immutable.
- Sync:
  - comandos idempotentes (processed_commands)
  - pull incremental (change_log con `seq`)
  - control concurrencia (`version` + `updated_at`)

### Despliegue (contenedores + Kubernetes)
- Imágenes Docker:
  - Backend: `backend/Dockerfile` (FastAPI + Uvicorn)
  - Frontend: `frontend/Dockerfile` (build Angular + serving estático con Nginx SPA)
- Kubernetes (base en `deploy/k8s`):
  - `StatefulSet` + `Service` para PostgreSQL
  - `Job` de migraciones (`alembic upgrade head`)
  - `Deployment` + `Service` para backend y frontend
  - `Ingress` con clase `traefik`, rutas `/api`→backend y `/`→frontend

### Seguridad (principios)
- Nada de secretos en el navegador:
  - Gemini API key se persiste **solo** en backend (cifrada); en Settings puede visualizarse para miembros autenticados del warehouse.
  - SMTP password **solo** en backend (cifrado).
- TLS obligatorio en despliegue.
- Rate limiting en endpoints de auth/reset.

---

## Modelo de datos (PostgreSQL)

### Convenciones
- `warehouse_id` en entidades multi-tenant.
- Soft delete: `deleted_at` nullable.
- Concurrencia: `version` (int) + `updated_at`.
- Auditoría: `created_at`, `created_by`, `updated_by`.

### Tablas (lógico)

**users**
- id (uuid PK)
- email (unique)
- password_hash
- display_name
- created_at, updated_at

**warehouses**
- id (uuid PK)
- name
- created_at, created_by

**memberships**
- user_id (FK)
- warehouse_id (FK)
- joined_at
- PK (user_id, warehouse_id)

**boxes**
- id (uuid PK)
- warehouse_id (FK)
- parent_box_id (FK boxes.id, nullable)
- name
- description (nullable)
- physical_location (nullable)
- qr_token (unique)
- short_code (unique, humano)
- is_inbound (bool, default false)
- version, created_at, updated_at, deleted_at
- created_by, updated_by

Índices:
- (warehouse_id, parent_box_id)
- (warehouse_id, deleted_at)
- unique(qr_token)
- unique(short_code)

**items**
- id (uuid PK)
- warehouse_id (FK)
- box_id (FK boxes.id)
- name
- description (nullable)
- physical_location (nullable)
- photo_id (FK photos.id, nullable)
- version, created_at, updated_at, deleted_at
- created_by, updated_by

Índices:
- (warehouse_id, box_id)
- (warehouse_id, deleted_at)

**item_favorites**
- user_id (FK)
- item_id (FK)
- created_at
- PK (user_id, item_id)

**tags**
- id (uuid PK)
- warehouse_id (FK)
- name (normalizado)
- created_at
- unique(warehouse_id, name)

**item_tags**
- item_id (FK)
- tag_id (FK)
- PK (item_id, tag_id)

**item_aliases**
- id (uuid PK)
- item_id (FK)
- alias
- created_at
- unique(item_id, alias)

**photos**
- id (uuid PK)
- warehouse_id (FK)
- storage_key
- content_type
- size_bytes
- sha256 (para cache/versionado)
- created_at

**intake_batches**
- id (uuid PK)
- warehouse_id (FK)
- target_box_id (FK boxes.id)
- created_by (FK users.id)
- name (nullable)
- status (`drafting|processing|review|committed`)
- total_count
- processed_count
- committed_count
- started_at, finished_at
- created_at, updated_at

Índices:
- (warehouse_id, status)
- (warehouse_id, target_box_id)

**intake_drafts**
- id (uuid PK)
- warehouse_id (FK)
- batch_id (FK intake_batches.id)
- photo_url
- status interno (`uploaded|processing|ready|review|rejected|error|committed`)
  - mapeo UX actual:
    - `Nuevo` = `uploaded|processing`
    - `Procesado` = `ready|review`
    - `Error` = `error|rejected`
    - `Guardado` = `committed`
- position (orden de captura/subida)
- suggested_name (nullable): último nombre sugerido por IA para decidir si aplicar contexto manual en `Reintentar IA`
- name (nullable), description (nullable)
- tags (json[]), aliases (json[])
- confidence (float), warnings (json[])
- llm_used (bool)
- error_message (nullable)
- processing_attempts
- created_item_id (FK items.id, nullable)
- created_at, updated_at

Índices:
- (warehouse_id, batch_id)
- (batch_id, status)

**stock_movements**
- id (uuid PK)
- warehouse_id (FK)
- item_id (FK)
- delta (int, normalmente +1/-1)
- reason (nullable)
- occurred_at (server time)
- created_by
- command_id (uuid, unique, nullable)  # idempotencia offline

Índices:
- (item_id, occurred_at desc)

**smtp_settings** (por warehouse)
- warehouse_id (PK/FK)
- host, port, username, password_encrypted, encryption_mode
- from_address, from_name
- updated_at, updated_by

**llm_settings** (por warehouse)
- warehouse_id (PK/FK)
- provider = "gemini"
- language = "es" | "en" (default "es")
- model_priority (json array ordenado, obligatorio): `["gemini-3.1-flash-lite","gemini-3-flash","gemini-2.5-flash","gemini-2.5-flash-lite"]`
- api_key_encrypted
- auto_tags_enabled (bool)
- auto_alias_enabled (bool)
- updated_at, updated_by

**change_log** (para sync pull incremental)
- seq (bigserial PK)
- warehouse_id
- entity_type (box|item|stock|tag|favorite|...)
- entity_id (uuid)
- action (create|update|delete)
- entity_version (int, nullable)
- created_at

Índices:
- (warehouse_id, seq)

**processed_commands** (idempotencia push)
- command_id (uuid PK)
- warehouse_id
- user_id
- device_id
- processed_at
- result_hash (opcional)

---

## API (REST) - Endpoints

**Base:** `/api/v1`  
**Auth:** Bearer JWT (access). Refresh con endpoint dedicado.

### Auth
- `POST /auth/signup`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/change-password`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`

### Warehouses
- `GET /warehouses`
- `POST /warehouses` (crea warehouse + caja raíz especial `Entrada de mercancias` con `is_inbound=true`)
- `GET /warehouses/{id}`
- `GET /warehouses/{id}/members`
- `POST /warehouses/{warehouse_id}/invites`
- `POST /invites/{token}/accept`
- `GET /warehouses/{warehouse_id}/activity?limit=50`

### Boxes
- `GET /warehouses/{warehouse_id}/boxes/tree?include_deleted=...`
- `POST /warehouses/{warehouse_id}/boxes`
- `GET /warehouses/{warehouse_id}/boxes/{box_id}`
- `PATCH /warehouses/{warehouse_id}/boxes/{box_id}`
- `POST /warehouses/{warehouse_id}/boxes/{box_id}/move` (new_parent_box_id)
- `DELETE /warehouses/{warehouse_id}/boxes/{box_id}` (soft, body `{force}`)
- `POST /warehouses/{warehouse_id}/boxes/{box_id}/restore`
- `GET /boxes/by-qr/{qr_token}` → devuelve box_id + warehouse_id
- `GET /warehouses/{warehouse_id}/boxes/{box_id}/items?q=...` → lista plana recursiva con payload compatible con cards/lista de Home (`photo_url`, `tags`, `aliases`, `is_favorite`, `stock`, `box_is_inbound`, etc.) y `box_path_ids` para breadcrumb navegable

### Items
- `GET /warehouses/{warehouse_id}/items?q=...&favorites_only=...&stock_zero=...&with_photo=...`
  - respuesta incluye `box_is_inbound` para señalizar si la caja actual del artículo es la caja especial de entrada
- `POST /warehouses/{warehouse_id}/items`
  - crea artículo y registra movimiento inicial `stock_movements.delta=+1` (command_id determinista por item)
- `POST /warehouses/{warehouse_id}/items/draft-from-photo`
  - body: `{ "image_data_url": "data:image/...;base64,..." }`
  - respuesta: `{ "name", "description", "tags", "aliases", "confidence", "warnings", "llm_used" }`
- `GET /warehouses/{warehouse_id}/items/{item_id}`
- `PATCH /warehouses/{warehouse_id}/items/{item_id}`
- `DELETE /warehouses/{warehouse_id}/items/{item_id}` (soft)
- `POST /warehouses/{warehouse_id}/items/{item_id}/restore`
- `POST /warehouses/{warehouse_id}/items/{item_id}/favorite` (toggle o set)
- `POST /warehouses/{warehouse_id}/items/batch` (move|favorite|unfavorite|delete)

Stock:
- `POST /warehouses/{warehouse_id}/items/{item_id}/stock/adjust` body: `{ "delta": 1, "command_id": "uuid" }`

### Intake masivo por caja
- `POST /warehouses/{warehouse_id}/intake/batches`
  - body: `{ "target_box_id": "...", "name?": "..." }`
  - crea lote y fija caja destino.
- `GET /warehouses/{warehouse_id}/intake/batches?include_committed=false&only_mine=true&limit=20`
  - lista lotes para módulo de gestión (ordenados por `updated_at` desc).
  - por defecto devuelve solo lotes abiertos creados por el usuario actual; la UI de módulo puede pedir `include_committed=true` y/o `only_mine=false`.
- `GET /warehouses/{warehouse_id}/intake/batches/{batch_id}`
  - devuelve `batch` + `drafts` para refresco/polling.
- `POST /warehouses/{warehouse_id}/intake/batches/{batch_id}/photos` (multipart `files[]`)
  - sube N imágenes al storage backend temporal del lote (`/media/{warehouse_id}/intake/{batch_id}`) y crea `intake_drafts` en estado `uploaded`.
  - si el lote estaba `committed`, la subida lo reabre automáticamente para continuar captura incremental (estado vuelve a flujo activo según recuento de drafts).
- `POST /warehouses/{warehouse_id}/intake/batches/{batch_id}/start`
  - body: `{ "retry_errors": bool }`
  - `retry_errors=false`: procesa borradores `uploaded` (flujo normal de nuevos).
  - `retry_errors=true`: reprocesa **solo** borradores `error` de forma secuencial (1 a 1).
  - en procesamiento de intake, si IA no devuelve resultado válido, el draft queda en `error` (sin fallback local no-IA).
- `PATCH /warehouses/{warehouse_id}/intake/drafts/{draft_id}`
  - edición manual de metadatos + cambio de estado permitido (`ready|review|rejected|uploaded|error`), bloqueando transiciones manuales a `processing|committed`.
- `POST /warehouses/{warehouse_id}/intake/drafts/{draft_id}/reprocess`
  - body: `{ "mode": "photo" | "name" }` (`photo` por defecto).
  - `mode=photo`: reproceso de un único draft usando solo la imagen.
  - `mode=name`: reproceso de un único draft usando imagen + título manual (`name`) como contexto autoritativo.
- `DELETE /warehouses/{warehouse_id}/intake/drafts/{draft_id}`
  - elimina un artículo temporal del lote (si no está procesando) y limpia su foto temporal del storage de intake.
- `POST /warehouses/{warehouse_id}/intake/batches/{batch_id}/commit`
  - body: `{ "include_review": false }` (campo legacy, no requerido para flujo actual).
  - crea items para drafts en `ready` (estado UX `Procesado`).
  - cada item creado registra stock inicial `+1` vía `stock_movements`.
  - mueve cada foto guardada desde carpeta temporal del lote a storage definitivo de artículos (`/media/{warehouse_id}/items`) y actualiza `items.photo_url`.
- `DELETE /warehouses/{warehouse_id}/intake/batches/{batch_id}`
  - elimina lote si no está en procesamiento y limpia su carpeta temporal de media.

### Photos
- `POST /photos/upload?warehouse_id=...` (multipart) → guarda en disco backend y devuelve `{ photo_url, content_type, size_bytes }`
- `GET /media/{warehouse_id}/{filename}` → archivo estático servible para renderizar avatar/foto de item desde `items.photo_url`

### Tags
- `GET /warehouses/{warehouse_id}/tags`
- `GET /warehouses/{warehouse_id}/tags/cloud` → `{ tag, count }[]`

### Settings
- `GET /settings/smtp?warehouse_id=...`
- `PUT /settings/smtp?warehouse_id=...`
- `POST /settings/smtp/test?warehouse_id=...`

- `GET /settings/llm?warehouse_id=...`
  - respuesta incluye: `{ warehouse_id, provider, language, model_priority, auto_tags_enabled, auto_alias_enabled, has_api_key, api_key_value }`
- `PUT /settings/llm?warehouse_id=...`
  - body incluye: `{ provider, language, model_priority, api_key?, auto_tags_enabled, auto_alias_enabled }`
- `POST /settings/llm/reprocess-item/{item_id}?warehouse_id=...`
  - body: `{ "fields": ["tags" | "aliases", ...] }` (opcional, por defecto `["tags","aliases"]`)
  - respuesta: `{ message, item_id, processed_fields, tags, aliases }`

### Sync
- `POST /sync/push`
- `GET /sync/pull?warehouse_id=...&since_seq=...`
- `POST /sync/resolve`

### Export / Import
- `GET /warehouses/{warehouse_id}/export` → snapshot JSON del warehouse (boxes/items/stock_movements).
- `POST /warehouses/{warehouse_id}/import` → upsert validado de snapshot JSON en warehouse destino.

---

## Búsqueda, tags, alias

### Búsqueda (online)
- Campos: item.name, item.description, tags, aliases, ruta de cajas, physical_location.
- Recomendación: Postgres full-text + trigram opcional.
- Relevancia:
  1) match exacto en nombre
  2) prefijo en nombre
  3) match en alias
  4) match en tags
  5) match en descripción/ruta

### Búsqueda (offline)
- Índice local mínimo en IndexedDB:
  - name + aliases + tags + (opcional) descripción
- Debounce en input.

### Tags
- No se introducen manualmente en el flujo normal.
- Se generan por LLM al crear/editar artículo (si habilitado).
- En captura masiva (`/app/batches/:batchId`), se permite ajuste manual inline antes del guardado de procesados.
- Nube de tags: chips interactivos para filtrar con codificación visual por frecuencia (tamaño/color), contador por tag y estado activo resaltado.

### Alias
- No se introducen manualmente en el flujo normal.
- Generados por LLM al crear/editar artículo (si habilitado).
- En captura masiva (`/app/batches/:batchId`), se permite ajuste manual inline antes del guardado de procesados.

---

## QR (solo cajas)

- Cada caja tiene `qr_token` único y no adivinable.
- `short_code` humano y corto (se muestra bajo el QR).
- Escaneo desde header (cámara):
  - abre la caja por token
  - si no autenticado → login + redirect
  - si sin acceso → error
- Impresión de etiqueta:
  - disponible en listado de cajas y detalle de caja
  - composición mínima: nombre caja, `short_code`, QR (`qr_token`) y token visible como fallback manual

---

## Offline-first + Sync + Conflictos

### Cliente
- IndexedDB:
  - cache entidades (boxes/items/tags/favs)
  - cola comandos
  - cursor `since_seq`
- SW cache shell + assets.

### Comandos idempotentes
Cada acción offline genera un comando:
- `command_id` (uuid)
- `device_id`
- `type`
- `entity_id`
- `base_version` (para updates/moves)
- `payload`

El servidor persiste `processed_commands` para no duplicar.

### Pull incremental
- El servidor expone `change_log.seq` por warehouse.
- El cliente hace `pull` desde `since_seq`.

### Conflictos
- Stock: **sin conflicto** (eventos sumables).
- Metadatos de caja/artículo:
  - Si `base_version != server_version` → conflicto
  - UI ofrece:
    - mantener servidor
    - mantener cliente
    - merge por campos (si aplica)

---

## LLM (Gemini): tags y alias automáticos

### Seguridad
- La API key de Gemini **no** se persiste en frontend; el valor puede solicitarse en Settings para edición/visualización por miembros autenticados.
- Se guarda cifrada en backend (por warehouse).

### Modelo y endpoint
- Orden por defecto de fallback (prioridad alta→baja):
  - `gemini-3.1-flash-lite` (Gemini 3.1 Flash Lite)
  - `gemini-3-flash` (Gemini 3 Flash)
  - `gemini-2.5-flash` (Gemini 2.5 Flash)
  - `gemini-2.5-flash-lite` (Gemini 2.5 Flash Lite)
- El orden se configura por warehouse en `llm_settings.model_priority` desde Settings (UI con reordenación).
- Si un ID exacto devuelve `404` por nomenclatura/versionado del proveedor, backend intenta alias runtime del mismo modelo (`-preview`, `-latest`, `-preview-latest`) antes de saltar al siguiente de la prioridad.
- Endpoint REST Gemini API: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`.
- La generación de tags/alias se hace a partir de `item.name` + `item.description`.
- Para alta por foto, backend envía la imagen (data URL base64) como `inline_data` a Gemini y obtiene borrador de metadatos de artículo.
- En captura masiva, backend reconstruye `data URL` desde `photo_url` persistida en storage y procesa borradores en paralelo por lote.

### Reglas
- En inferencia desde foto, clasificar únicamente el objeto principal en primer plano y más enfocado.
- Ignorar soportes y fondo (mesa, alfombrilla, estantería, pared) y objetos secundarios fuera de foco.
- Tags: 3–10, normalizados, sin duplicados.
- Alias: 0–5, no repetir nombre, útiles para búsqueda.
- Idioma de salida configurable por warehouse (`llm_settings.language`): por defecto español (`es`), opcional inglés (`en`).
- Política de fallback LLM: ante error de request/límite/formato en un modelo, backend prueba automáticamente el siguiente de `model_priority` antes de caer a heurístico local.
- Preferir tags existentes (backend incluye lista al prompt).

### Flujo
- Al crear/editar item (si cambia name/desc):
  - backend llama Gemini con `name + description` y genera tags/alias en el idioma configurado
  - si falla el primer modelo, backend reintenta secuencialmente con el resto de `model_priority`
  - si todos fallan, backend aplica fallback heurístico para no bloquear la operación
  - UI refleja estado “generando tags…”
- Al crear item desde foto:
  - frontend captura/sube imagen y llama `POST /warehouses/{warehouse_id}/items/draft-from-photo`
  - backend intenta inferir `name/description/tags/aliases` con Gemini Vision en el idioma configurado
  - si falla el primer modelo, backend reintenta secuencialmente con el resto de `model_priority`
  - si todos fallan o no hay API key válida, backend devuelve fallback no bloqueante con advertencias
  - frontend abre `/app/items/new` con datos pre-rellenados para confirmación del usuario
- En captura masiva por lote:
  - frontend crea `intake_batch`, sube `files[]` y dispara `start`
  - backend procesa borradores en paralelo y clasifica estado por draft (`ready` o `review`)
  - al reintentar IA desde revisión, backend compara `name` actual contra `suggested_name`: si difiere usa `foto + name`; si coincide usa solo foto
  - usuario revisa/edita inline y hace commit masivo de drafts listos en la caja destino

---

## Requisitos no funcionales

### UI/UX
- Material Design estricto (Angular Material).
- Responsive: móvil, tablet, escritorio.
- Acciones rápidas con targets grandes (uso en garaje).
- Sistema visual consistente: superficies con contraste suave, bordes y elevación sutiles, tipografía jerárquica y estados de UI homogéneos (loading/empty/error/success).

### Seguridad
- Hash de passwords: Argon2 (preferible).
- JWT access + refresh.
- Rate limiting en auth y reset.
- CORS restringido.
- TLS en despliegue real.

### Rendimiento
- Virtual scroll en listas grandes.
- Cache de imágenes con ETag/immutable.
- Búsqueda eficiente.

### Observabilidad
- Logging estructurado.
- Métricas básicas.
- Auditoría mínima (created_by/updated_by).

---

## Plan de implementación (vertical slices)

### Slice 1 — Fundaciones: Auth + Warehouses + Shell Material
- Backend: auth + modelos + migraciones base.
- Frontend: login/signup + selección warehouse + shell responsive.
- Estado actual (2026-02-22): **completada**.
  - Backend: `signup`, `login`, `refresh`, `logout`, `me`, `change-password`, `forgot-password`, `reset-password`; `list/create/get/members` de warehouses.
  - Persistencia auth: refresh tokens revocados en `logout`, `reset-password` y `change-password`.
  - Frontend: pantallas login/signup/forgot/reset/warehouses/shell, interceptor JWT, guards, selección persistida de warehouse.
  - Responsive: shell con sidenav `over` en móvil y `side` en escritorio.

### Slice 2 — Core: Boxes + Items + Favoritos + Stock Movements
- CRUD cajas (sin QR aún).
- CRUD items.
- Favoritos por usuario.
- Stock +/-1 como eventos.
- Estado actual (2026-02-22): **completada**.
  - Backend: modelos `boxes`, `items`, `item_favorites`, `stock_movements`; endpoints de tree, CRUD, move con validación de ciclos, soft-delete/restore, favoritos y batch.
  - Frontend: vistas `home`, `boxes`, `box-detail`, `item-form`; filtros rápidos (favoritos/stock=0), acciones rápidas (+/- stock, favorito) y lote (mover/favorito/borrar).
  - Migración: `20260222_0003_slice2_boxes_items`.
  - Calidad: test backend de Slice 2 (`test_slice2_boxes_items.py`) y build frontend OK.

### Slice 3 — Search + filtros + nube de tags (inicial)
- Buscador incremental.
- Chips filtros.
- Nube tags (aunque aún se alimentará más tarde).
- Estado actual (2026-02-22): **completada**.
  - Backend: `GET /warehouses/{warehouse_id}/items` con ranking por relevancia, búsqueda por ruta de cajas y filtro `tag`; endpoints `GET /warehouses/{warehouse_id}/tags` y `GET /warehouses/{warehouse_id}/tags/cloud`.
  - Frontend: Home con búsqueda incremental (debounce), filtros rápidos y nube de tags con chips clicables.
  - Calidad: test backend `test_slice3_search_tags.py`.

### Slice 4 — QR cajas + Scan + Detalle recursivo con rutas
- qr_token + endpoint by-qr.
- scanner.
- detalle caja con lista plana recursiva + breadcrumbs.
- Estado actual (2026-02-22): **completada**.
  - Backend: `GET /boxes/by-qr/{qr_token}` con validación de acceso por membresía y respuesta `{box_id, warehouse_id}` para navegación segura.
  - Frontend: ruta `/app/scan` (y `/app/scan/:qrToken`) desde el header; escaneo por cámara con `BarcodeDetector` cuando está disponible y fallback manual por token.
  - UX/Seguridad: redirect a login preservando URL objetivo y retorno al deep link tras autenticación; selección automática de `warehouse_id` al resolver QR.
  - Detalle de caja: breadcrumbs navegables por tramo en resultados recursivos.
  - Calidad: test backend `test_slice4_qr_scan.py`.

### Slice 5 — Multiusuario: invites + papelera/restauración + actividad mínima
- invitaciones.
- soft delete + restore.
- actividad básica.
- Estado actual (2026-02-22): **completada**.
  - Backend: invitaciones por token con expiración y aceptación (`POST /warehouses/{warehouse_id}/invites`, `POST /invites/{token}/accept`), endpoint de actividad (`GET /warehouses/{warehouse_id}/activity`) y registro de eventos básicos.
  - Frontend: aceptación de invitación (`/invites/:token`), papelera con restauración (`/app/trash`) y lista de actividad (`/app/activity`), además de creación de invites desde la vista de warehouses.
  - Migración: `20260222_0004_slice5_invites_activity`.
  - Calidad: test backend `test_slice5_invites_activity.py`.

### Slice 6 — Settings: SMTP + Gemini + autogen tags/alias
- settings SMTP + test.
- settings Gemini + autogen tags/alias.
- reprocesado manual.
- Estado actual (2026-02-22): **completada**.
  - Backend: endpoints `/settings/smtp`, `/settings/smtp/test`, `/settings/llm`, `/settings/llm/reprocess-item/{item_id}` con validación de membresía por warehouse y `model_priority` configurable para fallback Gemini en cascada.
  - Seguridad: secretos SMTP y Gemini almacenados cifrados en backend y expuestos en lectura solo como máscara (`has_*`/`*_masked`).
  - Items: autogeneración de tags/aliases en create/update cuando LLM está habilitado con API key configurada, con fallback de modelos antes del heurístico local.
  - Frontend: Settings con secciones de Seguridad, SMTP y LLM; incluye control de orden de prioridad de modelos Gemini, y el reprocesado manual se acciona desde cards de Home.
  - Migración: `20260222_0005_slice6_settings_smtp_llm`, `20260305_0011_llm_model_priority`.
  - Calidad: test backend `test_slice6_settings_llm_smtp.py`.

### Slice 7 — Offline + Sync + Conflictos
- IndexedDB + cola.
- /sync push/pull + change_log + processed_commands.
- UI de conflictos.
- Estado actual (2026-02-23): **completada**.
  - Backend: tablas `change_log`, `processed_commands`, `sync_conflicts`; endpoints `/sync/push`, `/sync/pull`, `/sync/resolve`; registro de `change_log` también en mutaciones online de boxes/items.
  - Frontend: servicio `SyncService` con IndexedDB (cola + `since_seq` + conflictos), fallback offline para comandos `item.favorite/unfavorite` y `stock.adjust`, sección de sync en Settings (estado/cola/forzar sync), y pantalla `/app/conflicts` para resolver con server/client.
  - Migración: `20260222_0006_slice7_slice8_sync_transfer`.
  - Calidad: test backend `test_slice7_sync_conflicts.py`.

### Slice 8 — Export/Import
- export JSON (y opcional CSV).
- import JSON con validación.
- Estado actual (2026-02-23): **completada**.
  - Backend: `GET /warehouses/{warehouse_id}/export` y `POST /warehouses/{warehouse_id}/import` con validación de referencias (parent/box/item) y remapeo de IDs/tokens cuando el snapshot se importa en otro warehouse.
  - Frontend: acciones de Export/Import JSON en Settings.
  - Migración: `20260222_0006_slice7_slice8_sync_transfer`.
  - Calidad: test backend `test_slice8_export_import.py`.

### Slice 9 — Alta de artículo por foto (LLM Vision)
- Captura/subida de imagen desde toolbar.
- Inferencia de metadatos de item con Gemini Vision.
- Prefill de `/app/items/new` para reducir fricción de alta.
- Estado actual (2026-03-05): **completada (iteración 3)**.
  - Backend: endpoint `POST /warehouses/{warehouse_id}/items/draft-from-photo`, validación de membresía/imagen y respuesta estructurada (`name`, `description`, `tags`, `aliases`, `confidence`, `warnings`, `llm_used`).
  - Frontend: ruta `/app/items/from-photo`, captura/subida de foto (móvil/escritorio), análisis y navegación a formulario de alta pre-rellenado; en flujo contextual desde detalle de caja se propagan `boxId` + `lockBox` para fijar caja destino en `/app/items/new`; el pre-análisis mantiene archivo seleccionado, fallback visible cuando falla la previsualización, render estable de preview con `data URL` y restauración automática del estado si el componente se recrea durante el flujo.
  - Seguridad: la API key Gemini permanece cifrada en backend; ante error o falta de configuración se aplica fallback heurístico no bloqueante.
  - Migración: no requerida (sin cambios de modelo en esta iteración).
  - Calidad: test backend `test_slice9_item_photo_draft.py` y build frontend OK.

### Slice 10 — Captura masiva por caja (batch intake + commit)
- Crear lotes por caja y subir N fotos sin pasar por formulario individual.
- Procesamiento IA de borradores con salida operativa por estados de UX (`Nuevo|Procesado|Error|Guardado`).
- Revisión operativa en frontend con tablero por estados, edición inline y acciones de lote iconográficas.
- Guardado masivo para crear items en la caja destino a partir de `Procesado`.
- Estado actual (2026-03-05): **completada**.
  - Backend: modelos `intake_batches`, `intake_drafts`; endpoints `/warehouses/{warehouse_id}/intake/...`; reproceso secuencial de errores y sin fallback local cuando falla IA en intake; commit de procesados con creación de `items` y `change_log`.
  - Frontend: módulo `/app/batches` + detalle `/app/batches/:batchId`; creación/listado de lotes, subida múltiple, procesamiento, edición manual en error, guardado de procesados y accesos en shell y detalle de caja (`collections`).
  - Migración: `20260305_0009_intake_batches`.
  - Calidad: test backend `test_slice10_intake_batch.py` y build frontend OK.

---

## Definición de Done

Para considerar una slice “Done”:
- [ ] Funcionalidad implementada end-to-end (frontend + backend).
- [ ] Tests mínimos (unit y/o integration) para backend; pruebas básicas en frontend.
- [ ] Migraciones Alembic incluidas si hay cambios de modelo.
- [ ] Seguridad aplicada (auth, validaciones, ownership por warehouse).
- [ ] `specs.md` actualizado si hubo cambios.
- [ ] Changelog actualizado.

---

## Open Questions / Assumptions

> Añadir aquí cualquier decisión tomada durante la implementación si el requisito no era totalmente explícito.

- **A-001 (2026-02-22):** Para acelerar bootstrap local sin fricción de dependencias, la base inicial corre con SQLite y sesiones SQLAlchemy síncronas. Se mantiene como objetivo migrar a PostgreSQL + capa async en la evolución de slices.
- **A-002 (2026-02-22):** La validación de email en el backend se dejó básica (string + límites) en esta fase inicial por disponibilidad de entorno; se endurecerá en siguientes pasos de Slice 1/2.
- **A-003 (2026-02-22):** En entorno de desarrollo, `POST /auth/forgot-password` devuelve `reset_token` en la respuesta para poder probar el flujo sin SMTP. En producción debe enviarse por email y no exponerse en API.
- **A-004 (2026-02-22):** En Slice 2 el endpoint de stock rápido se expone como `POST /warehouses/{warehouse_id}/items/{item_id}/stock/adjust` (en lugar de `/stock`) para dejar explícito el comando idempotente con `command_id`; se puede simplificar en Slice 7 si se estandariza capa de sync.
- **A-005 (2026-02-22):** En Slice 3 la relevancia de búsqueda usa un ranking heurístico en backend (exacto nombre > prefijo/contains nombre > alias > tag > descripción/ruta/ubicación) compatible con SQLite bootstrap; al migrar a PostgreSQL se podrá reemplazar por full-text/trigram conservando la misma semántica de orden.
- **A-006 (2026-02-22):** En Slice 4 el escaneo QR en web usa `BarcodeDetector` nativo cuando existe soporte del navegador; si no está disponible o no hay permisos de cámara, la UI habilita fallback por token manual para mantener el flujo funcional sin dependencias nuevas.
- **A-007 (2026-02-22):** En Slice 5, `POST /warehouses/{warehouse_id}/invites` devuelve `invite_url` calculada con `frontend_url` del backend y expone `invite_token` en respuesta para uso manual/QA; cuando SMTP esté activo (Slice 6), la entrega por email podrá hacerse sin cambiar el contrato base de aceptación.
- **A-008 (2026-02-22):** En Slice 6, el endpoint `POST /settings/smtp/test` valida configuración y responde en modo simulado (sin envío real) para mantener bootstrap local sin dependencia de servidor SMTP externo; la verificación de entrega real se completará cuando se integre transporte SMTP productivo.
- **A-009 (2026-02-23):** En la primera iteración de Slice 7, la cola offline del frontend cubre de forma explícita los comandos de uso rápido (`item.favorite/unfavorite` y `stock.adjust`); el resto de operaciones mantiene modo online-first y puede ampliarse por comando sin romper el contrato `/sync`.
- **A-010 (2026-02-23):** En Slice 8, al importar un snapshot en un warehouse distinto, backend remapea IDs (`boxes`, `items`, `stock_movements`) y `qr_token` cuando detecta colisión global para preservar integridad sin exigir preprocesado del JSON en cliente.
- **A-011 (2026-02-23):** La base de despliegue Kubernetes asume un único host público servido por Traefik con routing por path (`/` frontend, `/api` backend). El dominio/TLS (`my-warehouse.example.com`, `my-warehouse-tls`) queda como plantilla y debe ajustarse por entorno.
- **A-012 (2026-03-04):** Para habilitar impresión de etiquetas sin añadir librerías QR al frontend en esta iteración, la imagen QR se renderiza con un servicio remoto (`api.qrserver.com`) usando como payload únicamente `qr_token` (no credenciales ni secretos). Si se requiere operación 100% offline/air-gapped, se migrará a generador QR local en frontend o endpoint backend dedicado.
- **A-013 (2026-03-04):** El enriquecimiento LLM de tags/alias/foto usa Gemini API con cadena configurable por `llm_settings.model_priority` (default: `gemini-3.1-flash-lite` → `gemini-3-flash` → `gemini-2.5-flash` → `gemini-2.5-flash-lite`). Si fallan todos los modelos por límites/error/formato, backend aplica fallback heurístico local para mantener disponibilidad.
- **A-014 (2026-03-04):** En la primera versión de Slice 9, la foto para inferencia no se persistía automáticamente en `items.photo_url`; esta limitación queda superada por `A-015` al añadir subida y almacenamiento en disco con URL servible.
- **A-015 (2026-03-04):** Para esta iteración, la persistencia de fotos usa filesystem local del backend (`media_root`) y URL pública (`/media/...`) referenciada desde `items.photo_url`, sin tabla `photos` dedicada. Si se necesita almacenamiento distribuido (S3/objeto), la migración puede conservar el contrato `photo_url`.
- **A-015 (2026-03-04):** Para simplificar edición de credenciales LLM en Settings, `GET /settings/llm` puede devolver `api_key_value` descifrada al frontend para miembros autenticados del warehouse. La clave sigue persistida únicamente cifrada en backend y no se almacena en cliente fuera del estado temporal de formulario.
- **A-016 (2026-03-04):** En import cross-warehouse, si el snapshot trae una caja `is_inbound=true` pero el warehouse destino ya tiene su propia caja especial activa, la caja importada se conserva como caja normal (`is_inbound=false`) para mantener un único punto de entrada visual/operativo por warehouse.
- **A-017 (2026-03-05):** En Slice 10, el procesamiento paralelo de intake se ejecuta en backend con `ThreadPoolExecutor` y estados persistidos en DB (sin broker externo). Es una solución simple/reversible para esta fase; si se requiere resiliencia multi-worker/procesos, se migrará a cola distribuida dedicada (p. ej. Redis/Celery o equivalente) conservando el contrato REST.
- **A-018 (2026-03-05):** Se asume correspondencia directa entre nombres comerciales pedidos y IDs de API Gemini: `Gemini 3.1 Flash Lite`→`gemini-3.1-flash-lite`, `Gemini 3 Flash`→`gemini-3-flash`, `Gemini 2.5 Flash`→`gemini-2.5-flash`, `Gemini 2.5 Flash Lite`→`gemini-2.5-flash-lite`.
- **A-019 (2026-03-05):** Algunos modelos Gemini 3 pueden exponerse como IDs `preview/latest` y devolver `404` en el ID base. Backend aplica resolución runtime (`-preview`, `-latest`, `-preview-latest`) antes de pasar al siguiente modelo del fallback.
- **A-020 (2026-03-05):** En el nuevo detalle por bloques (`Nuevo/Procesado/Error/Guardado`), los drafts guardados permanecen visibles en `Guardado` como trazabilidad ligera (foto+título) y dejan de ser editables; la imagen temporal se limpia al moverse al storage definitivo de items durante el guardado.
