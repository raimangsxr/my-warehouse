# HTTP API Delta: SMTP e invitaciones

## POST `/api/settings/smtp/test?warehouse_id={warehouse_id}`

Request:

```json
{ "to_email": "destino@example.com" }
```

- `200`: el servidor SMTP aceptó el mensaje. `{ "message": "Correo de prueba enviado a destino@example.com." }`
- `400`: configuración ausente, incompleta o inválida.
- `502`: conexión, autenticación o entrega SMTP fallida. El `detail` es genérico y no incluye secretos.

## POST `/api/warehouses/{warehouse_id}/invites`

Request:

```json
{ "email": "persona@example.com", "expires_in_hours": 72 }
```

Response `201` (campos existentes conservados):

```json
{
  "warehouse_id": "uuid",
  "invite_token": "token",
  "invite_url": "https://app.example/invites/token",
  "expires_at": "2026-08-23T12:00:00Z",
  "email_delivery_status": "sent",
  "email_delivery_message": "Invitación enviada por correo."
}
```

`email_delivery_status` puede ser:

- `sent`: el servidor SMTP aceptó el mensaje.
- `not_configured`: no existe configuración SMTP para el garaje.
- `failed`: el intento SMTP falló; la invitación y el enlace siguen válidos.
- `not_requested`: la invitación se creó sin destinatario.

## POST `/api/invites/{token}/accept`

El formato no cambia. La comparación de expiración usa UTC tanto con PostgreSQL como SQLite. Se mantienen:

- `200`: membresía creada o ya existente, invitación marcada aceptada.
- `403`: la cuenta autenticada no coincide con el email invitado.
- `404`: token inexistente.
- `400`: token caducado o ya consumido.

## Navigation contract

- Una visita sin sesión a `/invites/{token}` redirige a `/login?redirect=%2Finvites%2F{token}`.
- Los enlaces entre login y registro conservan `redirect`.
- Login y auto-login tras registro navegan a `redirect`; si no existe, conservan sus destinos actuales.
