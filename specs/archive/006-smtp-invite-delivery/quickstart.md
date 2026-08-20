# Quickstart: validar SMTP e invitaciones

## Automated

```bash
cd backend
uv run pytest tests/test_slice6_settings_llm_smtp.py tests/test_slice5_invites_activity.py
uv run pytest

cd ../frontend
npm run test -- --configuration=ci
npm run build
```

Los tests SMTP sustituyen el transporte de red por un doble controlado; deben comprobar modos `starttls`/`ssl`, autenticación, mensajes y fallos sanitizados.

## Manual con servidor SMTP real

1. Configurar SMTP en Settings para un garaje y enviar un test a un buzón controlado.
2. Invitar un segundo correo y comprobar que la UI distingue “enviado” de “enlace creado sin envío”.
3. Abrir el enlace en una sesión privada, iniciar sesión y confirmar que se acepta y selecciona el garaje.
4. Repetir creando cuenta desde el flujo de invitación.
5. Probar credenciales SMTP inválidas: el test debe fallar y la invitación debe conservar su enlace manual.
