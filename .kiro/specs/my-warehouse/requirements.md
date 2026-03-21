# Requirements — my-warehouse

> PWA para inventariar objetos de garaje/trastero/almacén. Premisa: guardar rápido, encontrar rápido.

---

## EPIC A — Autenticación y cuenta

WHEN un usuario envía datos de registro válidos (email + password) THE SYSTEM SHALL crear la cuenta y redirigir a selección de warehouse.
WHEN un usuario envía un email ya registrado THE SYSTEM SHALL mostrar error "Email ya registrado".
WHEN un usuario envía formato de email inválido THE SYSTEM SHALL mostrar error de validación de email.
WHEN un usuario introduce credenciales correctas THE SYSTEM SHALL autenticar, emitir access token + refresh token y redirigir al warehouse activo.
WHEN un usuario introduce credenciales incorrectas THE SYSTEM SHALL mostrar error "Credenciales inválidas".
WHEN un usuario marca "Mantener sesión" en login THE SYSTEM SHALL emitir access token persistente sin expiración (revocable en backend) y cookie HttpOnly persistente para refresh.
WHEN un usuario hace logout THE SYSTEM SHALL revocar refresh token, access token persistente y borrar la cookie de sesión.
WHEN el backend responde 401 en una petición autenticada THE SYSTEM SHALL limpiar tokens locales y redirigir a /login preservando la ruta actual en el parámetro redirect.
WHEN un usuario solicita reset de contraseña THE SYSTEM SHALL enviar email con token de un solo uso que caduca en 1 hora.
WHEN un usuario usa un token de reset válido THE SYSTEM SHALL permitir establecer nueva contraseña e invalidar todos los refresh tokens previos.
WHEN un usuario autenticado cambia su contraseña THE SYSTEM SHALL requerir la contraseña actual e invalidar todos los refresh tokens.

---

## EPIC B — Warehouses (multiusuario sin roles)

WHEN un usuario crea un warehouse THE SYSTEM SHALL registrarlo como miembro y crear automáticamente una caja raíz especial "Entrada de mercancias" con is_inbound=true.
WHEN un usuario lista sus warehouses THE SYSTEM SHALL mostrar solo los warehouses donde es miembro.
WHEN un miembro genera una invitación THE SYSTEM SHALL crear un token con expiración y devolver la URL de aceptación.
WHEN un miembro genera una invitación y SMTP está configurado para el warehouse THE SYSTEM SHALL enviar un email al destinatario con la URL de aceptación.
WHEN el envío de email de invitación falla THE SYSTEM SHALL registrar el error en logs y devolver igualmente la URL de aceptación al invitante (el fallo de email no bloquea la operación).
WHEN un miembro genera una invitación con email y SMTP está configurado THE SYSTEM SHALL incluir en la respuesta el campo email_sent indicando si el email fue enviado con éxito.
WHEN el envío del email de invitación falla THE SYSTEM SHALL registrar el error en logs pero no bloquear la creación de la invitación.
WHEN un miembro envía un test de email SMTP THE SYSTEM SHALL intentar conexión y envío real (no simulado) y reportar éxito o error detallado.
WHEN un usuario acepta una invitación válida THE SYSTEM SHALL añadirlo como miembro del warehouse.
WHEN un usuario acepta una invitación expirada o ya usada THE SYSTEM SHALL mostrar error descriptivo.
WHEN un miembro consulta los miembros del warehouse THE SYSTEM SHALL listar todos los miembros activos.

---

## EPIC C — Cajas (árbol jerárquico)

WHEN un usuario crea una caja sin especificar nombre THE SYSTEM SHALL asignar "Caja N" con N incremental por warehouse.
WHEN se crea una caja THE SYSTEM SHALL generar qr_token único no adivinable y short_code humano único.
WHEN un usuario mueve una caja a otra THE SYSTEM SHALL validar que no se crea un ciclo (no mover dentro de un descendiente propio).
WHEN un usuario borra una caja THE SYSTEM SHALL aplicar soft-delete (deleted_at) sin eliminar la fila.
WHEN un usuario intenta borrar la caja especial de entrada (is_inbound=true) THE SYSTEM SHALL rechazar la operación con error.
WHEN un usuario restaura una caja borrada THE SYSTEM SHALL limpiar deleted_at y hacerla visible de nuevo.
WHEN se consulta el árbol de cajas THE SYSTEM SHALL devolver total_items_recursive y total_boxes_recursive por nodo.
WHEN se consulta el árbol THE SYSTEM SHALL resaltar visualmente la caja especial de entrada (is_inbound=true).

---

## EPIC D — Artículos

WHEN un usuario crea un artículo THE SYSTEM SHALL registrar automáticamente un stock_movement inicial con delta=+1.
WHEN un usuario crea un artículo con LLM habilitado THE SYSTEM SHALL generar tags y aliases automáticamente via Gemini.
WHEN un usuario edita nombre o descripción de un artículo con LLM habilitado THE SYSTEM SHALL regenerar tags y aliases.
WHEN un usuario ajusta stock con +1 o -1 THE SYSTEM SHALL crear un stock_movement idempotente usando command_id.
WHEN se muestra el stock de un artículo THE SYSTEM SHALL calcularlo como suma de todos sus stock_movements.delta.
WHEN un usuario marca/desmarca favorito en un artículo THE SYSTEM SHALL persistir el estado por usuario (no global).
WHEN un usuario borra un artículo THE SYSTEM SHALL aplicar soft-delete; el artículo queda en papelera.
WHEN un usuario restaura un artículo desde papelera THE SYSTEM SHALL limpiar deleted_at.
WHEN un usuario selecciona múltiples artículos y aplica acción en lote THE SYSTEM SHALL ejecutar mover/favorito/borrar sobre todos los seleccionados.
WHEN un artículo está en la caja especial de entrada THE SYSTEM SHALL mostrar su ruta en rojo en Home y Detalle de caja.

---

## EPIC E — Búsqueda, filtros y nube de tags

WHEN un usuario escribe en el buscador THE SYSTEM SHALL actualizar resultados con debounce de 300ms sin requerir acción de submit.
WHEN se ordenan resultados de búsqueda THE SYSTEM SHALL priorizar: match exacto en nombre > prefijo en nombre > alias > tags > descripción/ruta.
WHEN un usuario activa filtro "Solo favoritos" THE SYSTEM SHALL mostrar únicamente artículos marcados como favoritos por ese usuario.
WHEN un usuario activa filtro "Stock = 0" THE SYSTEM SHALL mostrar únicamente artículos con stock cero.
WHEN se muestra la nube de tags THE SYSTEM SHALL ponderar visualmente cada tag por frecuencia de uso (tamaño/color variable).
WHEN un usuario hace click en un tag de la nube THE SYSTEM SHALL filtrar artículos por ese tag.

---

## EPIC F — QR y escaneo

WHEN un usuario escanea un QR de caja THE SYSTEM SHALL navegar al detalle de esa caja.
WHEN un usuario no autenticado escanea un QR THE SYSTEM SHALL redirigir a login preservando el deep link.
WHEN un usuario autenticado sin acceso al warehouse escanea un QR THE SYSTEM SHALL mostrar error "Sin acceso".
WHEN un usuario introduce un short_code en el scanner manual THE SYSTEM SHALL resolver la caja correspondiente.
WHEN un short_code coincide con más de una caja accesible para el usuario THE SYSTEM SHALL responder 409 y exigir usar el QR.
WHEN un usuario imprime la etiqueta de una caja THE SYSTEM SHALL generar etiqueta con nombre de caja, short_code, QR (contenido = qr_token) y token visible como fallback.
WHEN el nombre de la caja es largo THE SYSTEM SHALL autoescalar el texto para que ocupe el ancho útil del QR en la etiqueta.

---

## EPIC G — Configuración (SMTP + Gemini LLM)

WHEN un miembro guarda configuración SMTP THE SYSTEM SHALL cifrar la contraseña en backend y nunca exponerla en texto plano.
WHEN un miembro envía un test de email THE SYSTEM SHALL intentar conexión SMTP y reportar éxito o error.
WHEN un miembro guarda la API key de Gemini THE SYSTEM SHALL cifrarla en backend; el frontend nunca la almacena.
WHEN se genera contenido LLM THE SYSTEM SHALL usar el orden de model_priority configurado por warehouse con fallback en cascada.
WHEN un modelo Gemini devuelve 404 THE SYSTEM SHALL probar alias runtime (-preview, -latest) antes de pasar al siguiente modelo.
WHEN todos los modelos Gemini fallan en create/edit de artículo THE SYSTEM SHALL aplicar fallback heurístico local sin bloquear la operación.
WHEN un miembro reordena la prioridad de modelos Gemini en Settings THE SYSTEM SHALL persistir el nuevo orden en llm_settings.model_priority.
WHEN un miembro configura el idioma de salida LLM THE SYSTEM SHALL aplicarlo a toda generación de tags/aliases/borradores para ese warehouse.

---

## EPIC H — Offline-first + Sync + Conflictos

WHEN un usuario realiza acción de favorito o ajuste de stock sin conexión THE SYSTEM SHALL encolar el comando en IndexedDB con command_id único.
WHEN el usuario recupera conexión THE SYSTEM SHALL enviar comandos encolados al servidor (push) y descargar cambios nuevos (pull desde since_seq).
WHEN el servidor recibe un comando ya procesado (mismo command_id) THE SYSTEM SHALL ignorarlo sin error (idempotencia).
WHEN hay conflicto de metadatos (base_version != server_version) THE SYSTEM SHALL registrar el conflicto y ofrecer opciones: mantener servidor / mantener cliente / merge por campos.
WHEN hay conflicto de stock THE SYSTEM SHALL resolverlo automáticamente sumando los eventos (sin conflicto real).
WHEN el estado de conectividad o sincronización cambia THE SYSTEM SHALL actualizar en tiempo real un indicador visual en la toolbar con los estados: online, offline, syncing, pending (comandos en cola), error.

---

## EPIC I — Export / Import

WHEN un miembro exporta el warehouse THE SYSTEM SHALL generar snapshot JSON con cajas, artículos, stock_movements y tags.
WHEN un miembro exporta el warehouse con formato CSV THE SYSTEM SHALL generar un ZIP con ficheros CSV separados para cajas (boxes.csv), artículos (items.csv) y movimientos de stock (stock_movements.csv).
WHEN un miembro importa un snapshot JSON en el mismo warehouse THE SYSTEM SHALL hacer upsert validando referencias.
WHEN un miembro importa un snapshot en un warehouse distinto THE SYSTEM SHALL reasignar IDs y qr_tokens para evitar colisiones globales.
WHEN el snapshot importado contiene una caja is_inbound=true y el warehouse destino ya tiene una THE SYSTEM SHALL importar esa caja como caja normal (is_inbound=false).

---

## EPIC J — Alta por foto (LLM Vision)

WHEN un usuario sube una foto desde el flujo de alta individual THE SYSTEM SHALL enviar la imagen a Gemini Vision y devolver borrador con name, description, tags, aliases, confidence, warnings.
WHEN Gemini Vision falla o no hay API key configurada THE SYSTEM SHALL devolver fallback heurístico no bloqueante con warnings.
WHEN el navegador no puede renderizar la preview de la foto THE SYSTEM SHALL mantener el archivo seleccionado, mostrar error visible y permitir continuar con el análisis.
WHEN el componente de captura se recrea durante el flujo móvil THE SYSTEM SHALL restaurar automáticamente la foto seleccionada desde estado temporal.
WHEN se infiere desde foto THE SYSTEM SHALL clasificar únicamente el objeto principal en primer plano, ignorando fondo y objetos secundarios.

---

## EPIC K — Captura masiva por lote (Intake Batch)

WHEN un usuario crea un lote THE SYSTEM SHALL asociarlo a una caja destino y ponerlo en estado drafting.
WHEN un usuario sube fotos a un lote THE SYSTEM SHALL crear intake_drafts en estado uploaded y, si hay LLM configurado, arrancar el worker de procesamiento automáticamente.
WHEN un lote está committed y se suben fotos nuevas THE SYSTEM SHALL reabrirlo automáticamente para continuar captura incremental.
WHEN el worker procesa un draft con LLM exitoso THE SYSTEM SHALL pasar el draft a estado ready.
WHEN el worker procesa un draft y LLM falla THE SYSTEM SHALL pasar el draft a estado error (sin fallback local no-IA).
WHEN un usuario hace commit de procesados THE SYSTEM SHALL crear artículos con stock inicial = draft.quantity y mover fotos a storage definitivo.
WHEN un draft está en committed THE SYSTEM SHALL permitir solo editar quantity; el ajuste genera stock_movement diferencial sobre el item creado.
WHEN un usuario reintenta IA en un draft y el nombre fue editado por el usuario THE SYSTEM SHALL usar foto + name como contexto; si no fue editado, usar solo foto.
WHEN retry_errors=true en start THE SYSTEM SHALL reprocesar solo drafts en error, secuencialmente (1 a 1).
WHEN la vista de detalle de lote está abierta THE SYSTEM SHALL refrescar automáticamente cada 5 segundos para soportar trabajo colaborativo.
WHEN el usuario abandona la vista de detalle de lote THE SYSTEM SHALL cancelar el polling.

---

## EPIC M — Sugerencias de reorganización de cajas (box-reorganization-suggestions)

### Requirement M.1: Solicitar sugerencias bajo demanda

**User Story:** Como miembro de un warehouse, quiero solicitar sugerencias de reorganización de mis artículos entre cajas, para poder agrupar artículos de la misma tipología y reducir el desorden acumulado.

#### Acceptance Criteria

1. WHEN un miembro autenticado invoca el endpoint de sugerencias de reorganización, THE Reorganization_Service SHALL procesar todos los artículos activos (deleted_at IS NULL) del warehouse y devolver una lista de sugerencias de movimiento.
2. WHEN se solicitan sugerencias, THE Reorganization_Service SHALL incluir en cada sugerencia: el identificador y nombre del artículo, el identificador y nombre de la caja actual, el identificador y nombre de la caja destino sugerida, y una razón textual de la sugerencia.
3. WHEN el warehouse no tiene artículos activos, THE Reorganization_Service SHALL devolver una lista de sugerencias vacía sin error.
4. WHEN un usuario sin membresía en el warehouse solicita sugerencias, THE API SHALL rechazar la petición con error 403.

### Requirement M.2: Análisis basado en LLM

**User Story:** Como miembro de un warehouse, quiero que las sugerencias se basen en el análisis inteligente de títulos y tags de mis artículos, para obtener agrupaciones semánticamente coherentes.

#### Acceptance Criteria

1. WHEN se generan sugerencias, THE Reorganization_Service SHALL enviar a Gemini los títulos y tags de todos los artículos activos del warehouse para que el LLM proponga agrupaciones por tipología.
2. WHEN el LLM devuelve agrupaciones, THE Reorganization_Service SHALL traducir esas agrupaciones en movimientos concretos indicando qué artículos deben cambiar de caja y a cuál.
3. WHEN no hay API key de Gemini configurada para el warehouse, THE API SHALL devolver error 422 con mensaje descriptivo indicando que se requiere configuración LLM para esta funcionalidad.
4. IF el LLM falla o devuelve una respuesta no parseable, THEN THE Reorganization_Service SHALL devolver error 502 con mensaje descriptivo; la operación no debe bloquear ni modificar datos del warehouse.
5. WHEN se llama al LLM, THE Reorganization_Service SHALL usar el model_priority configurado en llm_settings del warehouse con fallback en cascada según el patrón existente.

### Requirement M.3: Integridad y seguridad de las sugerencias

**User Story:** Como miembro de un warehouse, quiero que las sugerencias solo hagan referencia a cajas y artículos de mi propio warehouse, para evitar confusiones o accesos indebidos.

#### Acceptance Criteria

1. THE Reorganization_Service SHALL incluir en las sugerencias únicamente artículos y cajas pertenecientes al warehouse del usuario solicitante.
2. WHEN el LLM propone una caja destino que no existe en el warehouse, THE Reorganization_Service SHALL descartar esa sugerencia sin error.
3. THE Reorganization_Service SHALL NO modificar ningún dato del warehouse al generar sugerencias; la operación es de solo lectura.

### Requirement M.4: Aplicación de cambios con confirmación manual

**User Story:** Como miembro de un warehouse, quiero confirmar que he realizado físicamente un movimiento y que el sistema lo aplique virtualmente, para mantener el inventario digital sincronizado con la realidad física.

#### Acceptance Criteria

1. WHEN un miembro confirma una sugerencia de movimiento, THE Reorganization_Service SHALL actualizar el box_id del artículo en la base de datos al box_id de la caja destino sugerida.
2. WHEN se aplica un movimiento confirmado, THE Reorganization_Service SHALL registrar el cambio en el change_log del warehouse con el user_id del confirmante.
3. WHEN un miembro confirma un movimiento sobre un artículo que ya no existe o ha sido borrado, THE API SHALL devolver error 404 con mensaje descriptivo sin modificar otros datos.
4. WHEN un miembro confirma un movimiento sobre un artículo que ya está en la caja destino, THE Reorganization_Service SHALL marcar la sugerencia como confirmada sin error (operación idempotente).
5. WHEN se confirma un movimiento, THE Reorganization_Session SHALL actualizar el estado de esa sugerencia a "confirmed" en la sesión persistida.

### Requirement M.5: Ejecución en segundo plano (background job)

**User Story:** Como miembro de un warehouse, quiero que el análisis de reorganización se ejecute en segundo plano, para poder seguir usando la aplicación mientras se procesa.

#### Acceptance Criteria

1. WHEN un miembro lanza el análisis de reorganización, THE Reorganization_Worker SHALL ejecutar el análisis de forma asíncrona en un hilo separado sin bloquear la respuesta HTTP.
2. WHEN el análisis está en progreso, THE API SHALL devolver inmediatamente un identificador de sesión (session_id) con estado "running".
3. WHEN el análisis finaliza con éxito, THE Reorganization_Worker SHALL actualizar el estado de la sesión a "ready" y persistir las sugerencias generadas.
4. IF el análisis falla, THEN THE Reorganization_Worker SHALL actualizar el estado de la sesión a "error" con un mensaje descriptivo del fallo.
5. WHILE el análisis está en progreso, THE Frontend SHALL mostrar el estado de la operación en el área de "operaciones en progreso" del header de la aplicación.
6. WHEN el análisis finaliza (con éxito o error), THE Frontend SHALL actualizar el indicador del header y notificar al usuario mediante snackbar.

### Requirement M.6: Estado persistente y reanudable

**User Story:** Como miembro de un warehouse, quiero que mi sesión de reorganización persista entre visitas, para poder completar los movimientos físicos en múltiples sesiones sin perder el progreso.

#### Acceptance Criteria

1. THE Reorganization_Session SHALL persistir en base de datos con los campos: session_id, warehouse_id, created_by, status, y la lista de sugerencias con su estado individual (pending, confirmed, dismissed).
2. WHEN un miembro retoma una sesión existente en estado "ready", THE API SHALL devolver la sesión con todas las sugerencias y sus estados actuales.
3. WHEN un miembro descarta una sugerencia individual, THE Reorganization_Session SHALL actualizar el estado de esa sugerencia a "dismissed" sin afectar las demás.
4. WHEN todas las sugerencias de una sesión están en estado "confirmed" o "dismissed", THE Reorganization_Session SHALL actualizar el estado de la sesión a "completed".
5. WHEN un miembro lanza un nuevo análisis y ya existe una sesión en estado "ready" o "running" para ese warehouse, THE API SHALL devolver la sesión existente sin lanzar un nuevo análisis.
6. WHEN un miembro solicita forzar un nuevo análisis descartando la sesión anterior, THE Reorganization_Service SHALL crear una nueva sesión y archivar la anterior con estado "archived".

### Requirement M.7: UX optimizada para esfuerzo mínimo

**User Story:** Como miembro de un warehouse, quiero que las sugerencias estén agrupadas por caja origen para poder hacer todos los movimientos de una caja de una vez, minimizando los desplazamientos físicos.

#### Acceptance Criteria

1. THE Frontend SHALL agrupar las sugerencias de reorganización por caja origen, mostrando todas las sugerencias de una misma caja origen bajo un mismo encabezado de grupo.
2. WHEN se muestran las sugerencias agrupadas, THE Frontend SHALL mostrar para cada grupo el nombre de la caja origen y el número de movimientos pendientes en ese grupo.
3. WHEN se muestran las sugerencias agrupadas, THE Frontend SHALL ordenar los grupos priorizando aquellos que comparten caja destino con otros grupos, para minimizar desplazamientos.
4. THE Frontend SHALL mostrar un botón "Confirmar cambio" individual por cada sugerencia que invoque la confirmación del movimiento virtual al ser pulsado.
5. WHEN una sugerencia es confirmada o descartada, THE Frontend SHALL actualizar visualmente su estado de forma inmediata sin recargar toda la lista.

### Requirement M.8: Módulo independiente en sidenav

**User Story:** Como miembro de un warehouse, quiero acceder a la reorganización desde el menú lateral de la aplicación, para poder encontrarla fácilmente como una sección propia.

#### Acceptance Criteria

1. THE Frontend SHALL incluir una entrada "Reorganización" en el sidenav de la aplicación con icono representativo, accesible desde cualquier vista de la app.
2. THE Frontend SHALL implementar la vista de reorganización como un módulo con ruta lazy-loaded en `/app/reorganization`.
3. WHEN el usuario navega a `/app/reorganization` y no existe sesión activa, THE Frontend SHALL mostrar el botón "Analizar reorganización" para lanzar un nuevo análisis.
4. WHEN el usuario navega a `/app/reorganization` y existe una sesión en estado "ready" o "running", THE Frontend SHALL mostrar directamente el estado de esa sesión sin requerir acción adicional.

---

## EPIC L — PWA instalable

WHEN la app se carga en un navegador compatible THE SYSTEM SHALL registrar el Service Worker solo en builds production.
WHEN el SW detecta una nueva versión disponible THE SYSTEM SHALL mostrar snackbar con la versión nueva y acción "Actualizar".
WHEN el usuario aplica la actualización THE SYSTEM SHALL recargar y mostrar snackbar de éxito; si falla, mostrar snackbar de error.
WHEN el navegador soporta beforeinstallprompt THE SYSTEM SHALL mostrar CTA "Instalar app" en shell y Settings.
WHEN la app se ejecuta en iOS/Safari THE SYSTEM SHALL mostrar guía manual (Compartir → Añadir a pantalla de inicio).
