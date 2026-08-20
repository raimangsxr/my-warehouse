# Research: Entrega SMTP e invitaciones fiables

## Decisión 1 — Transporte SMTP

**Decision**: Usar `smtplib.SMTP` para `none`/`starttls`, `smtplib.SMTP_SSL` para `ssl`, `ssl.create_default_context()`, `EmailMessage` y un timeout de 10 segundos.

**Rationale**: Python ya incluye un cliente SMTP completo, el alcance es un envío síncrono por petición y no se justifica añadir dependencia ni infraestructura de cola. Un único servicio encapsula cifrado, autenticación, composición y sanitización de errores.

**Alternatives considered**: Proveedor HTTP externo (añade cuenta y dependencia); Celery/cola (mejor resiliencia pero fuera de alcance); envío directo en cada endpoint (duplicación y tests frágiles).

## Decisión 2 — Semántica de fallo al invitar

**Decision**: Persistir y confirmar la invitación antes del intento de correo. La API seguirá respondiendo 201 e incluirá `email_delivery_status` (`sent`, `not_configured`, `failed`, `not_requested`) y un mensaje no sensible.

**Rationale**: Mantiene el enlace manual existente y evita que un proveedor externo revierta una operación local válida. El estado explícito permite una UX honesta sin romper consumidores actuales, pues los campos existentes permanecen.

**Alternatives considered**: Transacción atómica con correo (imposible garantizar atomicidad externa y pierde el fallback); responder error HTTP tras crear (induce reintentos y duplicados); ocultar el fallo (falso éxito actual).

## Decisión 3 — Causa de la aceptación fallida

**Decision**: Reutilizar `app.utils.datetime.utcnow/ensure_utc` en invitaciones y comparar siempre instantes UTC conscientes de zona.

**Rationale**: El endpoint local define un `utcnow()` que elimina `tzinfo`, mientras `expires_at` usa `DateTime(timezone=True)`. PostgreSQL devuelve un valor consciente de zona y la comparación con un valor naive puede lanzar `TypeError`, convertido por la UI en “No se pudo aceptar”. Auth ya contiene el patrón correcto y probado para SQLite/PostgreSQL.

**Alternatives considered**: Comparación SQL en la consulta (válida pero dispersa la regla); quitar timezone del modelo (migración regresiva); capturar `TypeError` (oculta la causa).

## Decisión 4 — Continuidad de autenticación

**Decision**: Mantener `redirect` como ruta relativa completa, propagarlo en los enlaces login↔signup, y hacer que signup vuelva a ese destino tras el auto-login.

**Rationale**: El guard y login ya conservan el destino en la ruta directa. El hueco está al crear una cuenta o cambiar entre pantallas de autenticación, donde actualmente se pierde el token.

**Alternatives considered**: Guardar el token en localStorage (persistencia innecesaria de un secreto de enlace); aceptar sin autenticación (rompe identidad); pantalla intermedia separada (más complejidad).

## Decisión 5 — Seguridad y observabilidad

**Decision**: Devolver mensajes de entrega categóricos, registrar warehouse/invite y tipo de excepción sin credenciales ni texto remoto completo, y descifrar la contraseña solo dentro de la llamada de envío.

**Rationale**: Permite soporte operativo sin filtrar secretos ni respuestas potencialmente sensibles del servidor SMTP. Los endpoints mantienen membership/auth existentes.

**Alternatives considered**: Devolver el error SMTP literal (más diagnóstico pero riesgo de fuga); no registrar fallos (dificulta operaciones).
