# Feature Specification: Entrega SMTP e invitaciones fiables

**Feature Branch**: `codex/006-smtp-invite-delivery`

**Created**: 2026-08-20

**Status**: Draft

**Input**: El SMTP configurado debe enviar correos reales tanto en la prueba como al invitar a una persona, y el enlace de invitación debe poder aceptarse correctamente después de iniciar sesión.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Comprobar la configuración SMTP (Priority: P1)

Como usuario que administra la aplicación, quiero enviar un correo de prueba real con la configuración SMTP guardada para confirmar que servidor, credenciales y remitente funcionan antes de depender de ellos.

**Why this priority**: Una prueba real es el diagnóstico básico para cualquier otro correo saliente y evita mostrar un éxito engañoso.

**Independent Test**: Se configura una cuenta SMTP accesible, se ejecuta la prueba y se verifica que el mensaje llega al buzón del usuario autenticado y que la interfaz informa del resultado real.

**Acceptance Scenarios**:

1. **Given** una configuración SMTP válida y una dirección de prueba, **When** el usuario solicita el correo de prueba, **Then** recibe un mensaje en esa dirección y ve una confirmación de envío.
2. **Given** una configuración SMTP incompleta o rechazada por el servidor, **When** el usuario solicita la prueba, **Then** no se muestra un falso éxito y recibe un error útil que no revela secretos.

---

### User Story 2 - Enviar una invitación por correo (Priority: P1)

Como miembro de un garaje, quiero que al invitar una dirección de correo la aplicación envíe el enlace de acceso a esa dirección para no tener que copiarlo por otro canal.

**Why this priority**: Es el flujo principal de colaboración y depende del SMTP que el usuario ha configurado explícitamente.

**Independent Test**: Se invita una dirección distinta con SMTP válido y se verifica que recibe exactamente un correo con un enlace utilizable para esa invitación.

**Acceptance Scenarios**:

1. **Given** un garaje y una configuración SMTP válida, **When** un miembro invita una dirección, **Then** se crea la invitación y se envía a esa dirección un correo con el enlace de aceptación.
2. **Given** que la entrega del correo falla, **When** se crea la invitación, **Then** la interfaz avisa claramente del fallo y mantiene disponible el enlace para compartirlo manualmente.
3. **Given** que SMTP no está configurado, **When** se crea la invitación, **Then** la invitación sigue disponible como enlace manual y la interfaz explica que no se envió correo.

---

### User Story 3 - Aceptar después de autenticarse (Priority: P1)

Como persona invitada, quiero abrir el enlace, iniciar sesión o crear una cuenta si hace falta y continuar automáticamente con la aceptación para entrar en el garaje sin perder el contexto.

**Why this priority**: Un correo entregado no aporta valor si la autenticación rompe el enlace y la invitación no puede aceptarse.

**Independent Test**: Con la sesión cerrada se abre un enlace válido, se inicia sesión con la dirección invitada y se comprueba que la invitación se acepta y el garaje queda seleccionado.

**Acceptance Scenarios**:

1. **Given** una invitación válida y una sesión cerrada, **When** la persona abre el enlace e inicia sesión con el correo invitado, **Then** vuelve al flujo de invitación, la acepta y entra en el garaje.
2. **Given** una invitación válida y una sesión ya iniciada con el correo invitado, **When** abre el enlace, **Then** la invitación se acepta sin requerir otro inicio de sesión.
3. **Given** una sesión con un correo distinto al invitado, **When** intenta aceptar, **Then** la aplicación rechaza la aceptación con un mensaje comprensible y no añade esa cuenta al garaje.
4. **Given** una invitación caducada, revocada o ya usada, **When** se intenta aceptar, **Then** la aplicación muestra el estado correcto y no crea membresías duplicadas.

### Edge Cases

- El servidor SMTP tarda demasiado, rechaza la autenticación, el destinatario o la conexión segura.
- La dirección invitada usa distintas mayúsculas/minúsculas respecto a la cuenta autenticada.
- El usuario recarga la página o completa un alta de cuenta durante el salto de autenticación.
- La invitación se acepta dos veces o el usuario ya pertenece al garaje.
- El enlace público de la aplicación no está configurado explícitamente en el entorno desplegado.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST enviar un correo real de prueba a la dirección indicada por el usuario usando la configuración SMTP guardada.
- **FR-002**: La prueba MUST reflejar el resultado real de la entrega al servidor SMTP y MUST NOT informar de éxito si la conexión o el envío fallan.
- **FR-003**: Los errores de correo MUST ser accionables y MUST NOT exponer contraseñas, secretos ni detalles internos sensibles.
- **FR-004**: Al crear una invitación, el sistema MUST intentar enviar un correo a la dirección invitada cuando SMTP esté configurado.
- **FR-005**: El correo de invitación MUST identificar el garaje e incluir un enlace único de aceptación basado en la URL pública configurada para la aplicación.
- **FR-006**: Un fallo o ausencia de SMTP MUST NOT invalidar una invitación creada; el enlace manual MUST seguir disponible y la respuesta MUST distinguir entre invitación creada y correo enviado.
- **FR-007**: El cliente MUST preservar el destino completo de la invitación durante login y registro, incluyendo su token, y retomarlo tras autenticar.
- **FR-008**: Solo una cuenta cuyo correo coincida de forma normalizada con el destinatario MUST poder aceptar la invitación.
- **FR-009**: Aceptar una invitación válida MUST crear como máximo una membresía, seleccionar el garaje y llevar al usuario a su contenido.
- **FR-010**: Las invitaciones caducadas, inválidas o ya consumidas MUST producir mensajes diferenciados y comprensibles.
- **FR-011**: La configuración SMTP y sus secretos MUST permanecer protegidos y nunca incluirse en respuestas de prueba, invitaciones ni registros de error.

### Key Entities

- **Configuración SMTP**: Ajustes protegidos del servidor de correo, remitente, seguridad, estado habilitado y credenciales.
- **Invitación de garaje**: Invitación única vinculada a un garaje, una dirección destinataria, un token, caducidad y estado de consumo.
- **Destino posterior a autenticación**: Ruta temporal segura que conserva el flujo de invitación mientras el usuario inicia sesión o se registra.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con una configuración válida, el 100% de las pruebas controladas entrega un correo al buzón objetivo y solo entonces muestra éxito.
- **SC-002**: El 100% de las invitaciones controladas con SMTP válido genera un único correo que contiene un enlace aceptable.
- **SC-003**: El 100% de los usuarios invitados que parten sin sesión pueden autenticarse y completar la aceptación sin volver a abrir ni copiar el enlace.
- **SC-004**: Ningún fallo de SMTP elimina la invitación o impide obtener su enlace manual.
- **SC-005**: Ninguna respuesta o mensaje de error de los escenarios de prueba contiene credenciales o secretos SMTP.

## Assumptions

- La configuración SMTP pertenece al garaje seleccionado, como en el comportamiento actual.
- El correo de prueba se envía a la dirección introducida en el campo de prueba existente.
- La invitación se crea aunque falle el envío para conservar el fallback de enlace manual existente.
- El envío se realiza durante la solicitud y devuelve un resultado explícito; colas, reintentos automáticos y seguimiento de rebotes quedan fuera de alcance.
- Recuperación de contraseña por SMTP queda fuera de este cambio.
