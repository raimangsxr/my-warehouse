# Change 006 — SMTP e invitaciones fiables

## Summary

Sustituir la prueba SMTP simulada por un envío real, enviar por correo los enlaces de invitación cuando SMTP esté disponible y conservar correctamente el enlace de invitación a través de login/registro.

## Scope

- Resultado real del test SMTP, sin exponer secretos.
- Entrega del correo de invitación con fallback al enlace manual.
- Contrato de respuesta que diferencia invitación creada de correo enviado.
- Retorno post-autenticación y validación del destinatario al aceptar.
- Pruebas backend y frontend de los flujos afectados.

## Out of Scope

- Colas de correo, reintentos y seguimiento de rebotes.
- Recuperación de contraseña por correo.
- Plantillas HTML configurables o internacionalización del correo.

## Governing Contract

- `specs/contracts/app/contract.md`

## Validation Targets

```bash
cd backend && uv run pytest
cd frontend && npm run test -- --configuration=ci
cd frontend && npm run build
```
