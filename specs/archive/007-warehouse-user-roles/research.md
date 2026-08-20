# Research: Roles de usuario por warehouse

## Decisiones

### Rol persistido como cadena validada

**Decisión**: usar `administrator` y `contributor` en columnas `String`, con validación tipada en los schemas.

**Motivo**: funciona igual en PostgreSQL y SQLite, permite una migración reversible sencilla y evita acoplar Alembic a enums nativos. El conjunto sigue siendo cerrado en API y lógica de dominio.

**Alternativas descartadas**: enum nativo de PostgreSQL (complica SQLite y downgrade); tabla dinámica de roles/permisos (fuera de alcance).

### Autorización centralizada por membresía

**Decisión**: conservar el dependency de membresía para operaciones comunes y añadir uno de Administrador reutilizable.

**Motivo**: el código ya usa dependencias FastAPI por warehouse; extender ese patrón reduce duplicación y asegura que una llamada directa recibe `403`.

**Alternativas descartadas**: confiar en guards Angular; permisos globales en usuario; checks dispersos por endpoint.

### Protección transaccional del último Administrador

**Decisión**: bloquear las membresías del warehouse antes de contar administradores y modificar un rol. Rechazar con `409 Conflict` una degradación que dejaría cero.

**Motivo**: serializa cambios concurrentes en PostgreSQL y conserva la regla de dominio. SQLite serializa escrituras y tolera `FOR UPDATE` como no-op.

**Alternativas descartadas**: validar solo en frontend; contar sin bloqueo, vulnerable a degradaciones concurrentes.

### Rol fijado al crear invitación

**Decisión**: guardar el rol en `warehouse_invites`, con `contributor` por defecto, y copiarlo al aceptar.

**Motivo**: evita parámetros manipulables en aceptación y permite auditar qué acceso se ofreció.

**Alternativas descartadas**: resolver rol al aceptar; guardar el rol solo en el enlace.

### Estado de permisos en Angular

**Decisión**: incluir `role` en cada warehouse listado y mantener en `WarehouseService` el rol del warehouse seleccionado. Un guard vuelve a consultar/listar antes de entrar en rutas administrativas.

**Motivo**: permite actualización inmediata al cambiar de warehouse y revalidación tras recarga o degradación. El backend sigue siendo autoridad ante datos obsoletos.

**Alternativas descartadas**: derivar permisos desde `created_by`; rol global en `AuthService`; duplicar consultas en cada componente.

### Alcance de Settings y auxiliares

**Decisión**: SMTP, LLM, contraseña desde Settings, PWA, sync, export e import son Administrador-only. La recuperación pública de contraseña no cambia.

**Motivo**: decisión explícita de producto documentada en FR-020.

## Riesgos y mitigaciones

- **Membresía antigua sin creador asociado**: el backfill asigna Administrador solo cuando `memberships.user_id = warehouses.created_by`; datos no creadores reciben Contribuidor. Se valida que cada warehouse con membresías conserva admin antes de finalizar migración.
- **Rol de UI obsoleto**: guards revalidan y todo endpoint administrativo comprueba backend.
- **Invitación creada antes de perder privilegios**: el rol ya fijado se conserva; aceptar no requiere que el invitador siga siendo admin, igual que la validez del token existente.
- **Trabajo offline de un usuario degradado**: sync queda reservado a Administradores; el servidor rechaza la sincronización posterior sin aplicar cambios parciales.
