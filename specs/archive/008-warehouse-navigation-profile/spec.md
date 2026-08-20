# Feature Specification: Navegación por warehouses y perfil de usuario

**Feature Branch**: `002-warehouse-navigation-profile`

**Created**: 2026-08-20

**Status**: Draft

**Input**: Integrar warehouses en el layout de la aplicación, establecer un warehouse predeterminado para la entrada directa, restringir creación e invitaciones por rol, añadir perfil de usuario con información PWA adaptada al rol, mostrar resúmenes útiles por warehouse y mejorar el scroll móvil mediante acciones compactas.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Entrar directamente al warehouse predeterminado (Priority: P1)

Como usuario con acceso a uno o más warehouses, quiero elegir uno como predeterminado para entrar directamente en su área de trabajo al autenticarme, sin pasar cada vez por el listado.

**Why this priority**: El warehouse activo determina todas las operaciones de inventario y la entrada directa elimina una fricción diaria.

**Independent Test**: Un usuario marca un warehouse como predeterminado, cierra sesión, vuelve a autenticarse y llega a Inicio operando sobre ese warehouse.

**Acceptance Scenarios**:

1. **Given** un usuario con un warehouse predeterminado accesible, **When** inicia sesión sin un destino explícito, **Then** entra en Inicio con ese warehouse activo.
2. **Given** un usuario con varios warehouses, **When** abre uno distinto desde la vista de warehouses, **Then** opera sobre el elegido sin cambiar por ello su warehouse predeterminado.
3. **Given** un usuario cuyo warehouse predeterminado dejó de ser accesible, **When** entra en la aplicación, **Then** el sistema selecciona otro warehouse accesible, lo guarda como nuevo predeterminado y muestra una explicación no bloqueante.
4. **Given** un usuario sin warehouses, **When** entra en la aplicación, **Then** accede a la vista de warehouses dentro del layout habitual y puede crear su primer warehouse.

---

### User Story 2 - Cambiar y comprender mis warehouses (Priority: P1)

Como miembro, quiero consultar y cambiar de warehouse dentro del layout habitual, viendo suficiente contexto para escoger el espacio correcto.

**Why this priority**: Los contribuidores necesitan cambiar entre espacios invitados sin acceder a configuración administrativa.

**Independent Test**: Un contribuidor con dos membresías abre la vista integrada, consulta sus resúmenes y cambia del warehouse activo a otro.

**Acceptance Scenarios**:

1. **Given** un usuario autenticado, **When** abre la vista de warehouses, **Then** conserva header, navegación y layout de la aplicación.
2. **Given** un warehouse accesible, **When** se muestra en el listado, **Then** aparecen su rol, estado predeterminado, artículos activos, unidades de stock, cajas activas, lotes abiertos y miembros con acceso.
3. **Given** un contribuidor, **When** consulta un warehouse, **Then** puede abrirlo o marcarlo como predeterminado, pero no puede crearlo, eliminarlo ni enviar invitaciones.
4. **Given** un administrador del warehouse, **When** consulta sus acciones, **Then** puede invitar miembros y eliminar ese warehouse sujeto a las protecciones existentes.

---

### User Story 3 - Crear warehouses con autorización coherente (Priority: P1)

Como usuario autorizado, quiero crear warehouses sin permitir que una cuenta exclusivamente contribuidora amplíe espacios fuera de sus invitaciones.

**Why this priority**: Es un límite de autorización que debe cumplirse tanto visualmente como ante llamadas directas.

**Independent Test**: Se verifican tres cuentas: sin membresías, con al menos una administración y con membresías exclusivamente de contribuidor.

**Acceptance Scenarios**:

1. **Given** un usuario sin ninguna membresía, **When** crea su primer warehouse, **Then** se convierte en Administrador, el warehouse queda predeterminado y se abre para operar.
2. **Given** un usuario Administrador de al menos un warehouse, **When** crea otro, **Then** se convierte en Administrador del nuevo warehouse.
3. **Given** un usuario con una o más membresías y todas son de Contribuidor, **When** intenta crear un warehouse desde cualquier cliente, **Then** la operación se rechaza y sus datos no cambian.
4. **Given** un Contribuidor del warehouse activo, **When** usa la aplicación, **Then** no ve acciones para invitar, eliminar el warehouse o cambiar su configuración.

---

### User Story 4 - Gestionar mi perfil (Priority: P2)

Como usuario autenticado, quiero acceder a mi perfil desde el header para consultar mi cuenta, actualizar mi nombre y cambiar mi contraseña sin depender de la configuración de un warehouse.

**Why this priority**: La identidad y seguridad de la cuenta pertenecen al usuario, no a la configuración del espacio activo.

**Independent Test**: Un contribuidor abre su perfil, cambia el nombre visible y la contraseña, manteniendo el email como dato de solo lectura.

**Acceptance Scenarios**:

1. **Given** cualquier usuario autenticado, **When** activa su identidad en el header, **Then** puede abrir Perfil y cerrar sesión.
2. **Given** un usuario en Perfil, **When** guarda un nombre visible válido, **Then** el nuevo nombre aparece en su perfil y en las vistas de miembros posteriores.
3. **Given** un usuario en Perfil, **When** consulta su email, **Then** puede verlo pero no modificarlo.
4. **Given** un usuario en Perfil, **When** cambia correctamente su contraseña, **Then** las demás sesiones quedan invalidadas conforme al comportamiento de seguridad existente.

---

### User Story 5 - Consultar y actualizar la aplicación con el detalle adecuado (Priority: P2)

Como usuario, quiero comprobar si la aplicación está actualizada con información comprensible y, si soy administrador del warehouse activo, acceder además al diagnóstico completo.

**Why this priority**: Todos necesitan una actualización segura, pero el detalle técnico solo aporta valor operativo a administradores.

**Independent Test**: Se compara Perfil con un warehouse activo de Contribuidor y con uno de Administrador.

**Acceptance Scenarios**:

1. **Given** un usuario que no es Administrador del warehouse activo, **When** abre la sección de aplicación de su perfil, **Then** solo ve si está instalada, versión instalada, nueva versión detectada y última comprobación.
2. **Given** un Administrador del warehouse activo, **When** abre la misma sección, **Then** ve además toda la información diagnóstica PWA disponible actualmente.
3. **Given** cualquier usuario autenticado, **When** solicita buscar actualizaciones, **Then** recibe un resultado comprensible y puede instalar o aplicar una actualización cuando esté disponible.
4. **Given** un usuario sin warehouse activo, **When** consulta Perfil, **Then** ve el resumen no administrativo.

---

### User Story 6 - Desplazarse con seguridad por artículos en móvil (Priority: P2)

Como usuario móvil, quiero iniciar el desplazamiento vertical incluso sobre los controles de una tarjeta sin activar accidentalmente una operación.

**Why this priority**: El bloqueo percibido y las acciones accidentales degradan una de las pantallas de uso más frecuente.

**Independent Test**: En un dispositivo táctil, se inicia un gesto vertical sobre favorito, stock y el menú de una tarjeta; la lista se desplaza y no se ejecutan acciones.

**Acceptance Scenarios**:

1. **Given** una tarjeta de artículo en móvil, **When** el dedo se desplaza verticalmente desde una acción, **Then** la página hace scroll y no se ejecuta esa acción.
2. **Given** una tarjeta de artículo en móvil, **When** el usuario hace un tap sin desplazamiento apreciable, **Then** la acción seleccionada se ejecuta una sola vez.
3. **Given** una tarjeta de artículo en móvil, **When** se renderizan sus acciones, **Then** stock y favorito permanecen visibles y editar, reprocesar y borrar se agrupan en un menú compacto.
4. **Given** un usuario de teclado o lector de pantalla, **When** usa las acciones, **Then** conserva nombres accesibles, foco visible y activación por teclado.

### Edge Cases

- El predeterminado apunta a un warehouse eliminado o del que el usuario ya no es miembro.
- Dos clientes cambian el warehouse predeterminado del mismo usuario; prevalece la última actualización aceptada y ambos convergen al recargar.
- La lista contiene un único warehouse: puede ser activo y predeterminado simultáneamente sin acciones ambiguas.
- Un usuario exclusivamente contribuidor pierde su última membresía y queda sin warehouses: recupera la posibilidad de crear el primero.
- Un usuario Administrador de un warehouse y Contribuidor de otro ve permisos según el warehouse objetivo, no según una condición global, salvo para crear uno nuevo.
- Un administrador consulta la PWA mientras opera como Contribuidor en el warehouse activo: recibe el resumen normal hasta cambiar a uno donde sea Administrador.
- Las métricas ignoran entidades en papelera y no cuentan lotes finalizados como abiertos.
- La comprobación de actualización falla o el dispositivo no soporta instalación: Perfil lo explica sin bloquear el resto de la cuenta.
- Un gesto comienza en el icono interno, ripple o área ampliada de un botón: se comporta igual que si comenzara sobre el botón.
- El menú móvil se cierra durante un cambio de viewport sin ejecutar su acción seleccionada.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La vista de warehouses MUST residir dentro del layout autenticado habitual y estar disponible aunque no exista un warehouse activo.
- **FR-002**: Perfil MUST residir dentro del layout autenticado habitual y estar disponible aunque no exista un warehouse activo.
- **FR-003**: El sistema MUST mantener separados el warehouse activo de la sesión y el warehouse predeterminado persistente del usuario.
- **FR-004**: Cada usuario MUST poder marcar como predeterminado cualquier warehouse del que sea miembro.
- **FR-005**: El sistema MUST impedir que un usuario establezca como predeterminado un warehouse inaccesible.
- **FR-006**: Tras una autenticación sin redirección explícita, el sistema MUST activar el warehouse predeterminado y entrar en Inicio.
- **FR-007**: Si no existe un predeterminado válido pero hay warehouses accesibles, el sistema MUST elegir de forma determinista el más antiguo por fecha de membresía, persistirlo como predeterminado y entrar en Inicio.
- **FR-008**: Si no hay warehouses accesibles, el sistema MUST dirigir a la vista integrada de warehouses.
- **FR-009**: Abrir o cambiar al warehouse activo MUST NOT cambiar el predeterminado salvo acción explícita del usuario.
- **FR-010**: Al aceptar una invitación, el sistema MUST abrir el warehouse invitado; solo lo convertirá en predeterminado si el usuario no tenía uno válido.
- **FR-011**: Un usuario sin membresías MUST poder crear su primer warehouse.
- **FR-012**: Un usuario con membresías MUST poder crear otro warehouse únicamente si es Administrador de al menos uno.
- **FR-013**: Un usuario con membresías exclusivamente de Contribuidor MUST recibir una denegación al intentar crear un warehouse, incluida una llamada directa fuera de la UI.
- **FR-014**: Solo un Administrador del warehouse objetivo MUST poder invitar, eliminar, cambiar configuración o gestionar roles y miembros de ese warehouse.
- **FR-015**: Cada tarjeta de warehouse MUST mostrar nombre, rol del usuario, estado activo/predeterminado, artículos activos, unidades actuales de stock, cajas activas, lotes abiertos y cantidad de miembros.
- **FR-016**: La vista MUST permitir consultar quién tiene acceso: todos los miembros ven nombre visible y rol; solo un Administrador del warehouse objetivo ve además el email.
- **FR-017**: Las métricas de artículos y cajas MUST excluir entidades eliminadas; lotes abiertos MUST incluir estados no terminales y excluir lotes completados o eliminados.
- **FR-018**: Los resúmenes MUST estar autorizados por membresía y no revelar datos de warehouses inaccesibles.
- **FR-019**: El header MUST mostrar una identidad de usuario reconocible y un menú con Perfil y Cerrar sesión.
- **FR-020**: Perfil MUST permitir editar el nombre visible con un máximo de 120 caracteres y MUST mostrar el email como solo lectura.
- **FR-021**: Perfil MUST alojar el cambio de contraseña existente y esta función MUST dejar de depender del acceso a Settings.
- **FR-022**: Todos los usuarios MUST poder comprobar actualizaciones e instalar o aplicar una actualización cuando el dispositivo lo permita.
- **FR-023**: Para usuarios no administradores del warehouse activo, Perfil MUST limitar la información PWA visible a: instalada o no, versión instalada, nueva versión detectada y última comprobación.
- **FR-024**: Para Administradores del warehouse activo, Perfil MUST mostrar además todo el diagnóstico PWA ya disponible en la aplicación.
- **FR-025**: La configuración del warehouse MUST dejar de contener datos personales y cambio de contraseña, sin eliminar las funciones administrativas propias del warehouse.
- **FR-026**: En tarjetas móviles de artículos, stock y favorito MUST permanecer visibles, mientras editar, reprocesar y borrar MUST estar en un menú de más acciones.
- **FR-027**: Las superficies interactivas de las tarjetas móviles MUST permitir desplazamiento vertical nativo desde cualquier punto.
- **FR-028**: Un movimiento táctil que supere el umbral de intención de tap MUST cancelar la activación de la acción iniciada.
- **FR-029**: Las acciones táctiles MUST conservar activación por teclado, foco visible, etiquetas accesibles y una única ejecución por tap válido.
- **FR-030**: El comportamiento compacto y seguro MUST aplicarse a todas las vistas móviles que reutilicen la tarjeta de artículo, incluida Inicio y detalle de caja.
- **FR-031**: Los errores al cargar predeterminado, resúmenes, perfil o actualización MUST presentarse sin dejar al usuario atrapado en una ruta inaccesible.

### Key Entities

- **Preferencia de warehouse del usuario**: Relaciona un usuario con un warehouse predeterminado opcional del que debe ser miembro.
- **Warehouse resumido**: Warehouse accesible junto con rol, estado activo/predeterminado y métricas operativas agregadas.
- **Miembro visible**: Identidad y rol de una persona con acceso; el email se expone solo a administradores del warehouse objetivo.
- **Perfil de usuario**: Email inmutable desde la interfaz y nombre visible editable, independiente del warehouse activo.
- **Estado de aplicación instalada**: Estado de instalación, versión actual, versión detectada, última comprobación y diagnóstico adicional condicionado al rol del warehouse activo.
- **Intención táctil**: Distinción entre tap válido y gesto desplazado para evitar acciones accidentales sin impedir scroll vertical.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un usuario con predeterminado válido llega a Inicio en un único flujo posterior a la autenticación y sin visitar manualmente la lista de warehouses.
- **SC-002**: El 100% de intentos directos de creación por usuarios exclusivamente contribuidores son rechazados sin crear datos parciales.
- **SC-003**: Un usuario puede cambiar de warehouse activo o predeterminado desde la vista integrada en un máximo de dos acciones explícitas.
- **SC-004**: Las métricas y miembros de cada warehouse visible se presentan en una única carga de la vista y coinciden con sus datos activos.
- **SC-005**: Cualquier usuario puede abrir Perfil, cambiar su nombre o iniciar un cambio de contraseña sin ser Administrador y sin entrar en Settings.
- **SC-006**: Una comprobación de actualización presenta exactamente los cuatro campos simplificados a un usuario no administrador y el diagnóstico completo a un administrador del warehouse activo.
- **SC-007**: En pruebas táctiles sobre todos los controles de tarjeta, 100 de 100 gestos verticales de al menos 12 píxeles desplazan la vista sin ejecutar una acción.
- **SC-008**: En pruebas táctiles y de teclado, cada tap o activación válida ejecuta exactamente una acción y todas las operaciones conservan un nombre accesible.
- **SC-009**: Las rutas integradas de Warehouses y Perfil son utilizables con viewport móvil de 320 píxeles sin scroll horizontal de página.

## Assumptions

- El rol Administrador sigue siendo por warehouse; para crear un recurso nuevo se autoriza a quien administra al menos un warehouse existente, además de la excepción de arranque sin membresías.
- El predeterminado es una preferencia de cuenta sincronizada entre dispositivos; la selección activa puede seguir siendo local a la sesión/dispositivo.
- Abrir un warehouse no equivale a marcarlo como predeterminado.
- El nombre visible es el único dato personal editable en este alcance; el cambio de email queda fuera.
- El nivel de detalle PWA depende del rol en el warehouse activo, no de roles que el usuario tenga en otros warehouses.
- Las métricas son informativas y se calculan sobre el estado actual; no se incorporan gráficas históricas ni analítica temporal.
- La gestión de miembros y roles existente continúa en su módulo administrativo; la vista de warehouses ofrece contexto y acceso, no duplica toda la edición de permisos.
- El rediseño táctil agrupa acciones secundarias, pero no elimina ninguna capacidad existente ni cambia sus permisos.
