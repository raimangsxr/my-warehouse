# Data Model: Entrega SMTP e invitaciones fiables

No se requieren tablas ni migraciones nuevas.

## SMTPSetting (existente)

- `warehouse_id`: identifica el garaje y actúa como clave primaria.
- `host`, `port`: destino SMTP.
- `username`, `password_encrypted`: credenciales opcionales; la contraseña permanece cifrada en reposo.
- `encryption_mode`: `starttls`, `ssl` o `none`.
- `from_address`, `from_name`: identidad del remitente.
- `updated_by`: usuario que modificó la configuración.

Validación de envío: host, puerto y remitente son obligatorios; si hay usuario configurado debe existir una contraseña descifrable. Los secretos no salen del backend.

## WarehouseInvite (existente)

- `warehouse_id`, `invited_by`, `invitee_email` normalizado.
- `token_hash`: solo se persiste el hash; el token claro existe en la respuesta/enlace inicial.
- `expires_at`, `accepted_at`: instantes comparados en UTC.

Transiciones:

```text
creada → aceptada
creada → caducada (derivada de expires_at)
```

El estado de entrega de email es efímero y pertenece a la respuesta de creación; no se persiste porque este cambio no incorpora cola ni reintentos.

## Destino post-autenticación (estado de navegación)

- `redirect`: ruta relativa completa, por ejemplo `/invites/<token>`.
- Se propaga como query param entre invitación, login y signup.
- Se consume después de autenticación y no se almacena como estado duradero.
