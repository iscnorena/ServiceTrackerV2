# ServiceTracker V2 — Plan de Desarrollo

## 1. Contexto y objetivo

Reconstrucción moderna de `ServiceTrackerHotel` (proyecto original en PHP puro), un sistema de
seguimiento de requerimientos/tickets de huéspedes en hotelería. El objetivo de esta V2 es doble:

1. **Portafolio técnico**: demostrar dominio de un stack moderno full-stack (Next.js + TypeScript),
   incluyendo diseño de un sistema **multi-propiedad** (un corporativo con varios hoteles).
2. **Demo viva**: desplegado en Vercel con URL pública, para mostrar en entrevistas sin necesidad
   de que el reclutador clone o corra nada localmente.

El caso de uso está basado en experiencia real del autor como IT Systems Manager en hotelería
(Park Royal Beach Acapulco, Holiday Inn Resort Acapulco, Crowne Plaza Acapulco), y en un escenario
realista de operación a nivel corporativo: un mismo grupo hotelero opera varias propiedades, y hay
personal que trabaja en una sola propiedad (ej. mantenimiento de un hotel específico) y personal
que supervisa varias propiedades a la vez (ej. un gerente corporativo de mantenimiento que necesita
ver patrones — como qué insumo se repite más — a través de todos los hoteles del grupo).

---

## 2. Stack técnico

| Capa | Tecnología | Notas |
|---|---|---|
| Framework | **Next.js 15 (App Router)** | Frontend + backend en un solo repo/deploy |
| Lenguaje | **TypeScript** | Tipado end-to-end |
| ORM | **Prisma** | Schema-first, migraciones versionadas |
| Base de datos | **PostgreSQL** (Neon o Vercel Postgres) | Free tier suficiente para demo |
| Autenticación | **NextAuth.js** — Credentials Provider (email/password) + Google Provider | Login dual: cualquiera de los dos métodos activa el mismo `User`/rol |
| Backend logic | **Server Actions** | En vez de API REST tradicional |
| UI | **Tailwind CSS + shadcn/ui** | Componentes accesibles, look profesional rápido |
| Hosting | **Vercel** | Deploy automático en cada push a `main` |
| PDF (impresión de QR y reportes) | **@react-pdf/renderer** | Genera el PDF del QR por habitación y de los reportes exportables |
| Excel (reportes) | **SheetJS (xlsx)** | Exporta los mismos datos filtrados del dashboard a `.xlsx` |
| Pagos y licenciamiento | **Stripe** (Checkout/Customer Portal + Billing por cantidad) | Cobro real por hotel, con `quantity`-based subscriptions (ver sección 4.6) |
| Correo transaccional | **Resend** | Invitaciones, recuperación de contraseña, recordatorios de prueba/pago (ver sección 4.7) |
| Monitoreo de errores | **Sentry** | Alertas de errores en producción — crítico con Stripe, cron jobs y multi-tenancy en juego |
| Contenido legal editable | **react-markdown** | Renderiza el Markdown de `LegalDocument` en las páginas públicas de términos/privacidad |
| Internacionalización (i18n) | **next-intl** | Rutas por locale (`/es/...`, `/en/...`), archivos de traducción por idioma, extensible a futuro sin tocar código |
| Notificaciones (opcional / fase 2) | WebSockets vía Pusher o Ably | Actualización de tickets en tiempo real |

---

## 2.1 Convenciones de idioma en el código

Regla simple para evitar mezclas inconsistentes a lo largo del proyecto:

| Qué | Idioma |
|---|---|
| Código: nombres de variables, funciones, componentes, archivos, carpetas | **Inglés** |
| Base de datos: nombres de tablas, columnas, enums (ya reflejado en el modelo de datos) | **Inglés** |
| Comentarios dentro del código | **Español** está bien |
| Documentación (README, ADRs, mapa de sitio, manual de usuario, etc. — sección 5, Fase 4) | **Español** |
| Contenido visible para el usuario final (UI) | Vía `next-intl` — español e inglés, no hardcodeado en ningún idioma (ver sección 4 y notas de i18n) |

> Ejemplo concreto: la tabla se llama `tickets` con columnas `status`, `priority`, `hotel_id`
> (inglés); el código que la consulta puede tener un comentario como `// obtiene los tickets
> vencidos de SLA` (español está bien); y el botón que el usuario ve dice "Vencido" o "Overdue"
> según su idioma activo (vía traducción, no hardcodeado en el componente).

---

## 3. Modelo de datos (borrador inicial)

**Decisión clave de diseño**: un huésped (titular) puede reservar varias habitaciones a su nombre
(ej. un grupo o evento), pero cada habitación puede tener una persona de contacto distinta (el
"titular" no necesariamente está físicamente en cada cuarto). Mantenimiento/recepción debe poder
ver y dirigirse al contacto real de esa habitación específica, no siempre al titular de la reserva.

Por eso se separan `Guest` (titular) de `RoomStay` (la ocupación puntual de una habitación dentro
de una reserva, con su propio contacto).

**Decisión clave de diseño #2**: los "departamentos" (antes categorías fijas del ticket) y los
"roles" (antes enum cerrado) se separan en dos conceptos independientes:

- **Nivel de permisos** (`STAFF | ADMIN | SUPERADMIN`) — define qué puede hacer alguien en el
  sistema, no en qué área trabaja. Un supervisor de recepción o de teléfonos puede recibir nivel
  `ADMIN` sin dejar de pertenecer a su departamento.
- **Departamento** — ya no es un enum fijo (`RECEPCION | MANTENIMIENTO | GERENCIA`), sino un
  catálogo dinámico gestionable desde el sistema (ver sección 4.1). Así se pueden agregar nuevos
  departamentos (ej. "Teléfonos", "Amenidades", "Seguridad") sin tocar código.

**Decisión clave de diseño #3**: el sistema pasa a ser un **producto SaaS multi-cliente real**: no
un solo corporativo con varias propiedades, sino **varios corporativos distintos** (clientes que
pagan la licencia) compartiendo la misma instalación y base de datos, completamente aislados entre
sí. Se agrega un nivel por encima de `Hotel`: `Organization` (el cliente/corporativo que contrató
el servicio). Sigue siendo **multi-tenancy a nivel de fila** (row-level): una sola base de datos,
donde `Organization` y `Hotel` (y todo lo que ya colgaba de `Hotel`) llevan el identificador que
los aísla — a diferencia del modelo *database-per-tenant* que se está definiendo para SBC V3.

> Por qué row-level sigue siendo la elección correcta aquí (y no database-per-tenant como SBC V3):
> SBC V3 opera en un sector (fianzas) con requisitos de aislamiento de datos más estrictos y un
> volumen de clientes probablemente menor; ServiceTracker V2 es un SaaS operacional (tickets,
> habitaciones) donde row-level con buen scoping es el patrón estándar de la industria (así operan
> Notion, Linear, la mayoría de SaaS B2B), y es mucho más simple de desplegar en un entorno
> serverless como Vercel. Tener ambos casos ya pensados y justificados es un buen punto para
> explicar en entrevista: la elección de patrón de multi-tenancy depende del contexto, no es un
> default único.

> Riesgo a vigilar con este modelo: si una consulta olvida filtrar por `hotelId`/`organizationId`,
> se puede filtrar información entre hoteles O ENTRE CLIENTES DISTINTOS — esto último es mucho más
> grave (fuga de datos entre empresas que ni se conocen entre sí). Ver nota para Claude Code sobre
> el helper centralizado de scoping.

**Decisión clave de diseño #4**: el sistema es multilenguaje desde el diseño (español e inglés al
inicio, extensible a más idiomas después). Esto tiene una implicación directa en el modelo de
datos: **todos los enums usan códigos neutrales en inglés** (`PENDING`, `HIGH`, `RESOLVED`, etc.)
en vez de texto en español. La traducción a cualquier idioma vive únicamente en la capa visual
(archivos de mensajes de `next-intl`), nunca en el dato guardado. Si un enum se guardara como
`"PENDIENTE"`, agregar inglés obligaría a traducir literalmente lo ya almacenado — un error común
que se evita resolviéndolo desde el diseño inicial, no después.

> Importante: esto aplica a **enums de sistema** (status, priority, etc.), NO a contenido
> generado por el usuario como el `name` de un `Department` o `SupplyItem` — esos campos siguen
> siendo texto libre en el idioma que el staff de cada hotel prefiera capturar, y no se traducen
> automáticamente (traducir contenido dinámico generado por usuarios está fuera de alcance).

**Decisión clave de diseño #5**: modelo de licenciamiento y precio. Con lo que confirmaste, quedan
estos supuestos concretos — márcalos si algo no es lo que querías:

- **Precio plano por hotel** (no por niveles/planes), configurable desde un panel — un solo número
  (`pricePerHotelMonthly`) que aplica igual a cualquier hotel de cualquier cliente.
- **Prueba gratuita restringida**: 14 días por defecto (ajustable desde el mismo panel), y durante
  la prueba la organización solo puede dar de alta **1 hotel** (también ajustable). Así se puede
  usar el sistema de verdad, pero para operar más de una propiedad hay que pagar — que es
  justamente la fricción que buscabas para incentivar la compra.
- **Facturación por cantidad ("quantity-based") en Stripe**: en vez de crear una suscripción de
  Stripe por cada hotel, cada `Organization` tiene **una sola suscripción** en Stripe con
  `quantity` = número de hoteles con licencia activa. Al agregar o quitar un hotel, se actualiza la
  cantidad en Stripe (con prorrateo automático que Stripe calcula solo). Es el patrón estándar para
  "precio por unidad/asiento" y evita manejar N suscripciones sueltas por cliente.
- **Precio congelado por cliente ("grandfathering")**: si cambias `pricePerHotelMonthly` desde el
  panel, el nuevo precio aplica a clientes nuevos — a los que ya están pagando no se les sube el
  precio de golpe (se guarda el precio con el que se suscribieron). Es la práctica estándar en SaaS
  para no generar mal ambiente con clientes existentes cuando ajustas tu tabla de precios.

### `Organization` (Cliente/corporativo que contrató la licencia)
- id
- name
- stripeCustomerId (nullable — se llena cuando la organización configura su método de pago)
- stripeSubscriptionId (nullable — la suscripción única de Stripe, con `quantity` = hoteles con
  licencia activa)
- subscriptionStatus: enum `TRIALING | ACTIVE | PAST_DUE | CANCELLED | EXPIRED`
- trialEndsAt (nullable, datetime) — se calcula al crear la organización, a partir de
  `PlatformConfig.trialDays`
- pricePerHotelSnapshot (decimal, nullable) — precio congelado para este cliente al momento de
  empezar a pagar (ver nota de "grandfathering" arriba)
- createdAt

### `PlatformConfig` (Configuración de precios — un solo registro, editable por `PLATFORM_OWNER`)
- id (siempre existe un único registro)
- pricePerHotelMonthly (decimal)
- currency (string, ej. `"MXN"`, `"USD"`)
- trialDays (int, default 14)
- trialHotelLimit (int, default 1) — cuántos hoteles puede dar de alta una organización mientras
  está en prueba
- updatedById → relación con `User`
- updatedAt

> Este es el "panel de configuración" que pediste: `PLATFORM_OWNER` edita estos valores desde una
> pantalla simple, y afectan a las organizaciones nuevas de inmediato — sin tocar código ni hacer
> deploy.

### `LegalDocument` (Términos y condiciones / Aviso de privacidad — editables, versionados)
- id
- type: enum `TERMS | PRIVACY`
- locale (string, ej. `"es"`, `"en"`) — un documento por idioma, ya que el sitio es multilenguaje
- format: enum `TEXT | PDF`
- content (nullable — texto en Markdown, solo si `format = TEXT`)
- fileUrl (nullable — URL en Vercel Blob, solo si `format = PDF`)
- version (int, autoincremental por combinación de `type` + `locale`)
- publishedById → relación con `User` (siempre `PLATFORM_OWNER`)
- publishedAt
- createdAt

> **Publicar una edición nunca sobreescribe la anterior** — cada cambio crea un registro nuevo con
> `version + 1`. Solo la versión más reciente por `type`+`locale` se muestra en el sitio, pero las
> anteriores quedan guardadas (útil si algún día hace falta demostrar qué términos estaban
> vigentes en una fecha específica — práctica estándar para este tipo de documento).
> `PLATFORM_OWNER` puede editar el texto directo (Markdown con vista previa) o subir un PDF que
> reemplaza el contenido — ambos formatos conviven en la misma tabla, solo cambia `format`.
> Fuera de alcance para el MVP: forzar a los usuarios a re-aceptar términos cuando cambian (flujo
> típico de "hemos actualizado nuestros términos, acepta para continuar") — se documenta como
> mejora futura, por ahora basta con mostrar la fecha de "última actualización".

### `Hotel` (Propiedad)
- id
- organizationId → relación con `Organization` (a qué cliente pertenece este hotel)
- billingStatus: enum `ACTIVE | SUSPENDED` (default `ACTIVE`) — un hotel suspendido no cuenta en
  la facturación ni es operable (se conservan sus datos, no se elimina); útil si un cliente cierra
  temporalmente una propiedad
- name
- address (opcional)
- timezone (opcional, útil si los hoteles están en zonas horarias distintas)
- createdAt

### `User` (Staff — identidad global, no atada a un solo hotel)
- id
- name
- email
- passwordHash (nullable si el usuario solo usa login con Google)
- organizationId → relación con `Organization` (nullable — `null` únicamente para cuentas
  `PLATFORM_OWNER`, que no pertenecen a ningún cliente; obligatorio para todos los demás)
- isPlatformOwner (boolean, default `false`) — cuenta del equipo que opera la plataforma (tú),
  NO un cliente. Ver nota de separación de acceso más abajo
- corporateRole: enum `NONE | CORPORATE_ADMIN | SUPERADMIN` (default `NONE`) — alcance DENTRO de
  su propia `Organization`, nunca cruza a otros clientes
- canDeleteTickets (boolean, default `false`) — permiso explícito, solo relevante si
  `corporateRole = CORPORATE_ADMIN` (ver nota de eliminación de tickets abajo)
- preferredLocale (string, ej. `"es"`, `"en"`, nullable) — si no está definido, se usa el idioma
  detectado del navegador; si el usuario elige uno explícitamente, se respeta ese
- status: enum `INVITED | ACTIVE | DISABLED` (default `ACTIVE` si se crea directo, `INVITED` si
  se crea vía invitación hasta que la acepte) — permite desactivar a alguien sin borrar su
  historial (tickets que creó, comentarios, etc. se conservan)
- createdAt

> Un `User` con `corporateRole = NONE` solo tiene acceso a los hoteles donde tenga un registro en
> `UserHotelAccess` (ver abajo) — este es el caso normal de staff de una sola propiedad.
> Un `User` con `corporateRole = CORPORATE_ADMIN` ve y administra **todos los hoteles de SU
> `Organization`** automáticamente, incluyendo los que se den de alta después — este es el caso
> del gerente que supervisa varias propiedades del MISMO cliente (ej. mantenimiento corporativo).
> No requiere que se le asigne hotel por hotel manualmente. **Nunca** ve hoteles de otras
> organizaciones (otros clientes), sin importar el rol.
> `SUPERADMIN` tiene todo lo de `CORPORATE_ADMIN` (dentro de su misma `Organization`) + eliminar
> tickets a nivel de cualquier hotel de su cliente + gestión completa de usuarios, hoteles y
> facturación de su propia organización.
>
> `isPlatformOwner = true` es un caso completamente aparte: son cuentas del equipo que opera la
> plataforma (no un cliente). Por defecto **NO** tienen acceso a los datos operativos de ningún
> cliente (tickets, huéspedes, insumos, etc.) — solo a la gestión de `Organization` y
> `PlatformConfig` (facturación, planes, soporte). Esta separación es intencional: un proveedor de
> SaaS multi-cliente no debería tener acceso casual a los datos operativos de sus clientes por
> defecto, solo a lo necesario para operar el negocio de licenciamiento.

### `AuthToken` (Invitaciones y recuperación de contraseña)
- id
- userId → relación con `User`
- type: enum `INVITE | PASSWORD_RESET`
- token (string único, se guarda **hasheado**, nunca en texto plano)
- expiresAt (ej. 7 días para `INVITE`, 1 hora para `PASSWORD_RESET`)
- usedAt (nullable — se marca al usarse, para que no pueda reutilizarse)
- createdAt

> Flujo de invitación: `ADMIN`/`SUPERADMIN`/`CORPORATE_ADMIN` da de alta un `User` con
> `status = INVITED` y `passwordHash = null`, se genera un `AuthToken` tipo `INVITE`, y se envía
> un correo con el link. Al aceptar, el usuario define su propia contraseña y `status` pasa a
> `ACTIVE`. Nadie asigna contraseñas a nombre de otra persona — es mejor práctica de seguridad y
> es el patrón esperado en cualquier SaaS moderno.
> Flujo de "olvidé mi contraseña": se genera un `AuthToken` tipo `PASSWORD_RESET` (vida corta,
> 1 hora), se envía por correo, y al usarse queda invalidado (`usedAt`) para que el link no sirva
> dos veces.

### `UserHotelAccess` (Acceso de un usuario a un hotel específico)
- id
- userId → relación con `User`
- hotelId → relación con `Hotel`
- permissionLevel: enum `STAFF | ADMIN` — nivel dentro de ESE hotel (no aplica para usuarios
  `CORPORATE_ADMIN`/`SUPERADMIN`, que ya tienen acceso total sin necesidad de esta tabla)
- departmentId → relación con `Department` (nullable; el departamento de ese usuario dentro de ese
  hotel específico, ya que los departamentos también están escopados por hotel)
- canDeleteTickets (boolean, default `false`) — permiso explícito, solo relevante si
  `permissionLevel = ADMIN` (un `STAFF` nunca puede eliminar tickets, sin excepción)
- createdAt

> Un usuario puede tener varios registros en esta tabla si trabaja/supervisa más de un hotel sin
> ser `CORPORATE_ADMIN` (ej. un supervisor regional de solo 2 de los 10 hoteles del grupo) — el
> diseño no obliga a elegir entre "un hotel" o "todos", da flexibilidad intermedia también.
> **Ejemplo real**: un gerente de mantenimiento que atiende 3 hoteles pequeños y cercanos tendría
> `permissionLevel = ADMIN` en 3 registros de `UserHotelAccess` (uno por hotel), sin necesitar
> `corporateRole = CORPORATE_ADMIN` — porque no supervisa TODO el corporativo, solo esas 3
> propiedades específicas.

### `Department` (Departamento — catálogo dinámico, escopado por hotel)
- id
- hotelId → relación con `Hotel` (cada hotel administra sus propios departamentos)
- name (ej. "Recepción", "Mantenimiento", "Teléfonos", "Amenidades")
- defaultSlaMinutes (nullable — tiempo esperado de resolución para tickets de este departamento;
  ver sección de SLA más abajo)
- affectsRoomStatus (boolean, default `false`) — si es `true`, abrir/resolver un ticket de este
  departamento actualiza automáticamente `Room.status` (ej. Mantenimiento sí lo afecta, Amenidades no)
- createdAt
- createdById → relación con `User` (quién lo dio de alta, para trazabilidad)

> Reemplaza tanto el rol fijo "Recepción/Mantenimiento" como la categoría fija del ticket
> (`LIMPIEZA | MANTENIMIENTO | AMENIDADES | OTRO`). Un `ADMIN` o `SUPERADMIN` puede crear nuevos
> departamentos desde el panel; en cuanto se crean, aparecen automáticamente como opción al
> asignar staff o al categorizar un ticket, sin necesidad de deploy ni migración.

### `Guest` (Titular de la reserva)
- id
- name
- email (opcional)
- phone (opcional)
- createdAt

### `Reservation` (Reserva)
- id
- hotelId → relación con `Hotel`
- guestId → relación con `Guest` (el titular que reservó)
- checkIn
- checkOut
- notes (opcional, ej. "evento corporativo", "grupo familiar")
- createdAt

### `Room` (Habitación)
- id
- hotelId → relación con `Hotel`
- number
- floor
- status: enum `AVAILABLE | OCCUPIED | MAINTENANCE`
- qrSlug (string único, ej. un UUID corto) — usado para generar la URL fija del código QR de esa
  habitación (ver mejora de QR más abajo)

### `RoomStay` (Ocupación de habitación dentro de una reserva)
- id
- reservationId → relación con `Reservation`
- roomId → relación con `Room`
- contactName (persona de contacto física en esa habitación; puede ser el mismo titular u otra persona)
- contactPhone (opcional)
- checkIn (puede diferir del checkIn general de la reserva)
- checkOut (puede diferir del checkOut general de la reserva)

> Este es el registro clave para mantenimiento: cuando alguien de mantto entra a la habitación 305,
> el sistema le muestra el `contactName`/`contactPhone` de ESE cuarto, no el nombre del titular que
> hizo la reserva completa.

### `Ticket` (Requerimiento)
- id
- hotelId → relación con `Hotel` (denormalizado directo en el ticket, no solo inferido vía
  `Department`/`RoomStay`, para que los reportes y el scoping de queries sean simples y rápidos)
- title
- description
- departmentId → relación con `Department` (reemplaza el enum fijo `category`)
- status: enum `PENDING | IN_PROGRESS | RESOLVED | CANCELLED`
- priority: enum `LOW | MEDIUM | HIGH`
- roomStayId → relación con `RoomStay` (así el ticket hereda automáticamente el contacto correcto)
- assignedToId → relación con `User` (staff asignado)
- slaDueAt (nullable, datetime) — calculado al crear el ticket a partir de `Department.defaultSlaMinutes`
  y la prioridad (ver sección de SLA más abajo)
- source: enum `STAFF | GUEST` — quién originó el ticket (staff desde el dashboard, o el huésped
  directamente vía QR sin login)
- createdAt
- resolvedAt (nullable)
- deletedAt (nullable — ver nota de eliminación abajo)

> Nota para Claude Code: este modelo es un punto de partida. Validar relaciones (1:N, N:M) y
> ajustar según necesidades reales del flujo de trabajo antes de generar el `schema.prisma` final.
> Punto crítico: `Ticket` se relaciona con `RoomStay`, NO directamente con `Guest`, para que el
> contacto mostrado en cada ticket sea siempre el de la habitación correspondiente.
>
> **Eliminación de tickets**: a diferencia de la V1 (donde no se permitía borrar), en V2 se permite
> eliminar tickets, pero con un modelo de permiso explícito y otorgable, no solo por nivel fijo:
> - `SUPERADMIN` siempre puede eliminar tickets, en cualquier hotel — no requiere flag adicional.
> - `CORPORATE_ADMIN` y `ADMIN` **no pueden por defecto**. Solo pueden si `SUPERADMIN` les activa
>   explícitamente `canDeleteTickets = true` (en `User` para `CORPORATE_ADMIN`, en
>   `UserHotelAccess` para `ADMIN` de un hotel específico).
> - `STAFF` nunca puede eliminar tickets, sin excepción — no tiene ni la opción de que se le otorgue.
> Este patrón de "permiso explícito otorgable" (en vez de solo niveles fijos) queda documentado
> aquí como precedente por si más adelante se necesita otorgar de forma similar otros permisos
> sensibles sin tener que rediseñar la jerarquía completa.
> Recomendación técnica: implementar **soft delete** (`deletedAt`)
> en vez de borrado físico — el ticket desaparece de los listados pero queda en la base de datos
> para trazabilidad/auditoría. Si el usuario prefiere borrado físico real, se puede quitar
> `deletedAt` y hacer `DELETE` directo, pero se pierde el rastro de qué se eliminó y cuándo.

### `TicketActivity` (Historial de actividad — auditoría automática)
- id
- ticketId → relación con `Ticket`
- userId → relación con `User` (quién hizo la acción)
- action: enum `CREATED | REASSIGNED | STATUS_CHANGED | COMMENTED | ATTACHED | DELETED`
- detail (texto libre, ej. "Status changed from PENDING to IN_PROGRESS")
- createdAt

> Se genera automáticamente desde cada Server Action relevante (no es algo que el usuario llene a
> mano) — cada vez que se reasigna, cambia estatus, comenta o adjunta algo a un ticket, se crea un
> registro aquí. Es lo que alimenta el timeline visual del ticket.

### `TicketComment` (Comentarios/notas internas)
- id
- ticketId → relación con `Ticket`
- userId → relación con `User` (autor)
- message
- createdAt

> Nunca visible para el huésped — son notas de staff a staff (ej. "falta refacción, se pide mañana").

### `TicketAttachment` (Fotos adjuntas)
- id
- ticketId → relación con `Ticket`
- uploadedById → relación con `User`
- url (almacenado en Vercel Blob Storage o UploadThing, no en la base de datos)
- type: enum `BEFORE | AFTER | OTHER` — para distinguir foto del problema vs. foto de "resuelto"
- createdAt

### `RecurringTicketTemplate` (Plantilla de tickets recurrentes — mantenimiento preventivo)
- id
- hotelId → relación con `Hotel`
- title
- description
- departmentId → relación con `Department`
- roomId → relación con `Room` (opcional: puede ser una plantilla general sin cuarto fijo)
- frequency: enum `DAILY | WEEKLY | MONTHLY`
- nextRunAt (datetime — cuándo debe generarse el próximo ticket real)
- active (boolean)
- createdById → relación con `User`

> Un cron job (Vercel Cron) revisa periódicamente las plantillas con `nextRunAt <= now()` y
> `active = true`, crea un `Ticket` real a partir de la plantilla, y recalcula `nextRunAt` según
> `frequency`. Útil para checklist preventivo (ej. "revisión de A/C" cada mes), no solo tickets
> reactivos.

### `SupplyItem` (Insumo — catálogo por hotel, NO global)
- id
- hotelId → relación con `Hotel` (cada hotel administra su propio catálogo de insumos, sin
  compartirlo con otras propiedades)
- name (ej. "Pilas AA", "Control remoto TV", "Foco baño")
- createdById → relación con `User`
- createdAt

### `TicketSupplyUsage` (Insumos usados/reportados en un ticket)
- id
- ticketId → relación con `Ticket`
- supplyItemId → relación con `SupplyItem`
- quantity (int, default 1)
- createdAt

> Cuando el staff resuelve un ticket, puede etiquetar qué insumo estuvo involucrado (ej. "se
> repusieron 2 pilas AA porque el huésped se las llevó" o "control remoto no encendía, se cambió
> por uno nuevo"). Esto es lo que permite, a nivel corporativo, detectar patrones como "en los
> últimos 3 meses se repusieron 340 pilas AA entre todos los hoteles" → decisión de comprar en
> volumen en vez de por hotel individual.
>
> **Nota importante sobre el catálogo por hotel (no global)**: como cada hotel nombra sus insumos
> libremente, el mismo insumo puede llamarse "Pilas AA" en un hotel y "Baterías AA" en otro. Para
> que el reporte corporativo agrupe correctamente, la consulta de agregación debe normalizar el
> texto (minúsculas, sin acentos, sin espacios extra) al comparar nombres entre hoteles — no va a
> ser una coincidencia exacta perfecta como sí lo sería con un catálogo compartido. Si en el uso
> real esto genera demasiado ruido (nombres muy distintos para lo mismo), la solución futura sería
> introducir un catálogo global opcional con "alias" por hotel — pero eso queda fuera de alcance
> de este proyecto.

### `ShiftNote` (Notas de cambio de turno)
- id
- hotelId → relación con `Hotel`
- departmentId → relación con `Department` (opcional: puede ser una nota general, no atada a depto)
- authorId → relación con `User`
- content
- createdAt

> Espacio simple donde el staff saliente deja contexto para el que entra (ej. "habitación 210
> pidió toallas extra, aún no se les lleva"). No está atado a un ticket específico — es contexto
> operativo general del turno.

---

## 4. Roles y permisos

### 4.1 Niveles de permiso (jerárquicos)

**Escopados a un hotel específico** (vía `UserHotelAccess`):

| Nivel | Puede |
|---|---|
| **STAFF** | Ver y actualizar tickets de su(s) departamento(s) dentro de SU hotel, cambiar estatus, agregar notas. No puede crear departamentos ni eliminar tickets (sin excepción, no otorgable). |
| **ADMIN** | Todo lo de STAFF + crear/editar departamentos, ver y reasignar tickets de cualquier departamento **dentro de SU hotel**, ver dashboard de métricas de ese hotel, dar de alta nuevos usuarios STAFF para ese hotel. **No elimina tickets por defecto** — solo si `SUPERADMIN` le otorga `canDeleteTickets = true` para ese hotel. Cualquier supervisor local (de recepción, teléfonos, mantenimiento, etc.) puede tener este nivel — no está atado a un departamento específico. |

**Corporativos** (vía `User.corporateRole`, ven todos los hoteles de SU organización automáticamente):

| Nivel | Puede |
|---|---|
| **CORPORATE_ADMIN** | Todo lo de ADMIN, pero a través de **todos los hoteles de SU organización** simultáneamente, incluyendo hoteles que se den de alta después. Ve dashboards y reportes agregados cruzando propiedades del mismo cliente (ej. insumos más recurrentes). **No elimina tickets por defecto** — mismo mecanismo otorgable que ADMIN, vía `canDeleteTickets = true` en su `User`. Es el nivel del gerente que supervisa varias propiedades del mismo corporativo. |
| **SUPERADMIN** | Todo lo de CORPORATE_ADMIN + **eliminar tickets siempre, en cualquier hotel de SU organización** (no requiere que se le otorgue nada), promover/degradar usuarios de su organización, otorgar/revocar `canDeleteTickets`, dar de alta nuevos hoteles **de su organización**, gestionar la suscripción/facturación de su organización. Nunca ve ni administra datos de otras organizaciones. |

**Plataforma** (vía `User.isPlatformOwner`, fuera de cualquier organización):

| Nivel | Puede |
|---|---|
| **PLATFORM_OWNER** | Administra el negocio de licenciamiento: ver/crear/suspender `Organization`, editar `PlatformConfig` (precio, días de prueba, límite de hoteles en prueba), ver métricas de ingresos (MRR estimado, clientes activos/en prueba/vencidos). **No tiene acceso por defecto** a los datos operativos de ningún cliente (tickets, huéspedes, insumos) — ver nota de separación de acceso en la sección 3. |

> Nota: "Gerencia" ya no es un rol por sí mismo — puede ser `ADMIN` (de un solo hotel),
> `CORPORATE_ADMIN` (varios/todos los hoteles de su organización) o `SUPERADMIN`, según el alcance
> real de su puesto. El sistema no asume que solo gerencia puede administrar: cualquier supervisor
> de cualquier departamento puede recibir nivel `ADMIN` en su hotel si el negocio lo decide.
> `PLATFORM_OWNER` es un rol completamente distinto — es quien opera el producto, no un cliente.

### 4.2 Catálogos dinámicos (gestionables desde `ADMIN`)

En vez de valores fijos "quemados" en el código, los siguientes catálogos viven en la base de
datos y se administran desde el sistema (un `ADMIN` o `SUPERADMIN` los crea, edita o desactiva
desde un panel simple tipo tabla + formulario):

- **Departamentos** (`Department`) — ej. Recepción, Mantenimiento, Teléfonos, Amenidades. En
  cuanto se crea uno nuevo, aparece automáticamente en: el selector de categoría al crear un
  ticket, el selector de departamento al dar de alta un `User`, y los filtros del dashboard.

Catálogos candidatos para fases futuras (no obligatorio en Fase 1, pero el diseño debe dejar la
puerta abierta): tipos de habitación, prioridades personalizadas, motivos de cancelación. El
`status` del ticket (`PENDING | IN_PROGRESS | RESOLVED | CANCELLED`) se recomienda **mantenerlo
fijo** (no dinámico) porque controla lógica de negocio (columnas del Kanban, reglas de
notificación) — convertirlo en catálogo dinámico complica el código sin beneficio claro en esta
etapa.

### 4.3 Reglas de negocio complementarias

**SLA (tiempo de resolución esperado)**
- Cada `Department` puede tener un `defaultSlaMinutes` configurado por un `ADMIN`.
- Al crear un `Ticket`, se calcula `slaDueAt = createdAt + defaultSlaMinutes`, ajustado por
  prioridad con un multiplicador fijo: `HIGH` → sin ajuste, `MEDIUM` → x2, `LOW` → x4. (Ejemplo:
  si Mantenimiento tiene SLA base de 30 min, un ticket `HIGH` vence en 30 min, uno `MEDIUM` en 60,
  uno `LOW` en 120.)
- Si `Department.defaultSlaMinutes` es `null`, el ticket no tiene SLA (no se le aplican alertas).
- En el dashboard, un ticket con `slaDueAt` vencido y `status` distinto de `RESOLVED`/`CANCELLED`
  se resalta visualmente (ej. borde rojo) como alerta de SLA incumplido.

**Auto-actualización de estatus de habitación**
- Si `Department.affectsRoomStatus = true`: al crear un ticket para esa habitación, `Room.status`
  cambia a `MAINTENANCE`. Al resolver el ticket (`status = RESOLVED`), `Room.status` regresa a
  `OCCUPIED` (o `AVAILABLE` si ya no hay una `RoomStay` activa para esa habitación).
- Si hay varios tickets abiertos simultáneos para la misma habitación, el estatus solo debe
  regresar a la normalidad cuando **todos** los tickets con `affectsRoomStatus` estén resueltos.

**QR por habitación**
- Cada `Room` tiene un `qrSlug` único que arma una URL fija tipo `/qr/{qrSlug}`.
- Esa URL abre un **formulario público, sin login**, donde el huésped puede:
  - Describir el problema en texto libre
  - Elegir de forma simple una categoría amplia (ej. "Limpieza", "Algo no funciona", "Otro") —
    NO se le pide elegir `Department` técnico ni `priority`; eso lo interpreta/ajusta el staff al
    revisarlo
- El ticket se crea con `source = GUEST`, `roomStayId` ya resuelto por el `qrSlug` (no hace falta
  que el huésped indique su habitación, ya se sabe por el QR que escaneó), `priority` por defecto
  en `MEDIUM`, y el `departmentId` se asigna a un departamento genérico de "Recepción" o similar
  para que un humano lo reclasifique si aplica.
- **Prevención de abuso**: como es una URL pública sin autenticación, aplicar rate-limiting básico
  por IP (ej. máximo N tickets por minuto) — este es el control principal, siempre activo.
  Adicionalmente, el formulario solo acepta envíos si `Room.status = OCCUPIED` **según el dato
  interno del propio sistema** (alimentado por `Reservation`/`RoomStay`, no por ningún PMS externo).
  > **Limitación conocida**: en un hotel real, recepción probablemente ya hace el check-in en un
  > PMS externo (ej. Opera, TCA FrontInsist), y no va a duplicar esa captura en ServiceTracker V2.
  > Esto significa que `Room.status` interno puede desincronizarse de la ocupación real si el
  > staff no mantiene `Reservation`/`RoomStay` actualizados. Para efectos de portafolio/demo esto
  > no es un problema (los datos son ficticios y controlados), pero en un despliegue real la
  > solución correcta sería una integración con el PMS del hotel — usando el mismo **patrón
  > adapter** ya definido para las afianzadoras en SBC V3 — para que `Room.status` se sincronice
  > automáticamente en vez de depender de captura manual duplicada. Esto queda fuera del alcance
  > de Fase 1/2/3 de este proyecto, pero vale la pena mencionarlo en el README o en entrevista como
  > una decisión de arquitectura consciente, no un descuido.
- **Visibilidad en el dashboard**: los tickets con `source = GUEST` se resaltan de forma distinta
  (ej. un ícono o etiqueta "Reportado por huésped") para que el staff sepa que no vino de un
  compañero, sino directo del cliente — suele ameritar atención más rápida.
- El QR se genera con una librería como `qrcode` (npm) y se puede **descargar como PDF listo para
  imprimir** desde el panel de administración de habitaciones (botón "Imprimir QR" por cuarto).
- El PDF incluye, debajo del código QR:
  - El número de habitación (para identificarlo fácilmente al despegar/pegar en el cuarto correcto)
  - La URL completa en texto plano (ej. `servicetracker.app/qr/a1b2c3`) — así, si el QR no
    escanea por mala calidad de impresión, doblez, o desgaste, el staff o el huésped puede
    teclear la URL manualmente desde su celular
- Opcional/útil para el flujo real del hotel: un botón de **"Imprimir todos"** que genere un solo
  PDF con el QR de todas las habitaciones activas, uno por página, para no tener que exportar
  cuarto por cuarto al hacer la instalación inicial.

### 4.4 Dashboards por rol

Cada nivel de permiso ve un dashboard distinto al entrar al sistema, con la información que
realmente necesita para su trabajo diario — no una sola vista genérica con todo mezclado.

**STAFF** (un hotel)
- "Mis tickets" — asignados a mí o a mi departamento, priorizados por SLA más próximo a vencer
- Contador rápido por estatus (Pendiente / En proceso / Resuelto hoy)
- Últimas notas de cambio de turno de mi departamento
- Botón directo para crear un ticket nuevo

**ADMIN** (uno o varios hoteles específicos, vía `UserHotelAccess`)
- Todo lo de STAFF, con alcance a todos los departamentos de CADA hotel donde tenga acceso
- Si tiene acceso a **más de un** hotel (ej. el gerente de mantenimiento de 3 propiedades
  pequeñas), aparece un **selector de hotel** al iniciar sesión, más una **vista comparativa
  entre esos hoteles específicos** (no de todo el corporativo — solo los que tiene asignados):
  tickets por hotel, SLA comparado, e insumos recurrentes entre esas propiedades (ver 4.5,
  aplicable también aquí con el subconjunto de hoteles del usuario, no solo para `CORPORATE_ADMIN`)
- Si solo tiene acceso a un hotel, entra directo a ese hotel sin selector — no le agregamos un
  paso extra a quien de verdad solo trabaja en una propiedad
- Tickets sin asignar (pendientes de que alguien los tome)
- Tickets con SLA vencido, agrupados por departamento
- Accesos rápidos a gestión de Departamentos y de Usuarios STAFF de cada hotel que administra
- Gráfica simple de tickets por departamento (últimos 7/30 días)
- **Exportar reporte** (PDF/Excel) del set de tickets actualmente filtrado en su vista

**CORPORATE_ADMIN** (todos los hoteles)
- Selector de hotel para entrar al detalle de cualquier propiedad como si fuera `ADMIN` de esa
  propiedad específica
- Vista agregada cruzando **todas** las propiedades:
  - Tickets por hotel, por departamento, por estatus
  - Cumplimiento de SLA comparado entre hoteles (¿cuál propiedad resuelve más rápido/lento?)
  - **Reporte de insumos más recurrentes across todos los hoteles** (ver sección 4.5) — el
    caso de uso original: detectar que las pilas AA o los controles remotos se reponen
    constantemente en varias propiedades, para decidir compra en volumen a nivel corporativo
- **Exportar reporte** (PDF/Excel) agregado o filtrado por hotel/rango de fechas

**SUPERADMIN** (todos los hoteles)
- Todo lo de CORPORATE_ADMIN, más:
  - Alta de nuevos hoteles
  - Registro reciente de tickets eliminados en cualquier propiedad (quién, cuándo, cuál, en qué
    hotel) — visibilidad de auditoría
  - Usuarios activos por nivel de permiso y por hotel
  - Gestión completa de configuración del sistema

> La exportación reutiliza siempre los mismos filtros que el usuario ya tiene aplicados en su
> vista — así el reporte exportado coincide exactamente con lo que está viendo en pantalla, sin
> necesidad de un formulario de reporte aparte.

### 4.5 Reporte de insumos recurrentes (multi-hotel)

Este es el objetivo original de la "supermejora": darle a cualquiera con acceso a **más de un
hotel** — ya sea un `ADMIN` con 2-3 propiedades asignadas, o un `CORPORATE_ADMIN`/`SUPERADMIN` con
todas — la capacidad de detectar qué insumos se reponen constantemente entre esas propiedades,
para decisiones de compra en volumen.

- La consulta agrupa registros de `TicketSupplyUsage` **cruzando los hoteles a los que el usuario
  tiene acceso** (su subconjunto si es `ADMIN` multi-hotel, o todos si es `CORPORATE_ADMIN`/
  `SUPERADMIN`) por nombre de insumo normalizado (minúsculas, sin acentos), sumando `quantity`, en
  un rango de fechas elegible (ej. últimos 30/90 días).
- Resultado tipo: *"Pilas AA — 340 unidades repuestas en 5 de 8 hoteles en los últimos 90 días"*
  (o *"— 40 unidades repuestas en 2 de tus 3 hoteles"* para un `ADMIN` multi-hotel).
- Como el catálogo de insumos es por hotel (no compartido — ver nota en sección 3), esta
  agrupación por nombre normalizado es una aproximación razonable, no una coincidencia perfecta.
  Vale la pena mostrar en el reporte, junto al nombre agrupado, en qué hoteles apareció y con qué
  nombre exacto lo capturó cada uno — así quien lo revisa puede verificar visualmente que
  realmente se trata del mismo insumo antes de tomar una decisión de compra.
- Filtros útiles: por hotel (incluir/excluir, dentro de los que ya tiene acceso), por
  departamento, por rango de fechas, por cantidad mínima de repeticiones para considerarlo
  "recurrente".

### 4.6 Licenciamiento y facturación

**Alta de una organización nueva (signup)**
1. Alguien se registra como cliente nuevo → se crea `Organization` con `subscriptionStatus =
   TRIALING` y `trialEndsAt = now() + PlatformConfig.trialDays`.
2. Se crea su primer `User` con `corporateRole = SUPERADMIN` dentro de esa `Organization`.
3. Puede dar de alta hoteles libremente hasta el límite `PlatformConfig.trialHotelLimit` (ej. 1).
   Si intenta dar de alta uno más durante la prueba, el sistema bloquea la acción y muestra un
   mensaje de "actualiza tu plan para agregar más hoteles" con link a la pantalla de pago.

**Paso a pago**
1. Desde su panel, `SUPERADMIN` va a "Facturación" → Stripe Checkout (o Customer Portal) crea el
   `stripeCustomerId` y una **suscripción única** con un `Price` de Stripe configurado como
   "por unidad" (`pricePerHotelMonthly`), `quantity` = número de hoteles que quiere licenciar.
2. Al completarse el pago, un webhook de Stripe (`checkout.session.completed` /
   `customer.subscription.created`) actualiza `Organization.subscriptionStatus = ACTIVE`, guarda
   `stripeSubscriptionId` y congela `pricePerHotelSnapshot` con el precio vigente en ese momento.

**Agregar/quitar hoteles después de estar pagando**
- Al dar de alta un hotel nuevo (org ya `ACTIVE`), el sistema llama a la API de Stripe para subir
  el `quantity` de la suscripción en 1 — Stripe prorratea automáticamente el cobro del periodo
  actual.
- Al suspender un hotel (`Hotel.billingStatus = SUSPENDED`), se baja el `quantity` en 1.

**Ciclo de vida de la suscripción (webhooks de Stripe a escuchar)**
| Evento de Stripe | Efecto en `Organization` |
|---|---|
| `checkout.session.completed` | `subscriptionStatus = ACTIVE`, guarda IDs de Stripe |
| `invoice.payment_failed` | `subscriptionStatus = PAST_DUE` |
| `invoice.paid` (tras estar `PAST_DUE`) | `subscriptionStatus = ACTIVE` |
| `customer.subscription.deleted` | `subscriptionStatus = CANCELLED` |

**Qué pasa si no se paga / vence la prueba**
- Prueba vencida sin pago (`trialEndsAt` pasado y sigue `TRIALING`): un cron job (reutilizando la
  infraestructura de Vercel Cron ya definida) revisa periódicamente y cambia el estatus a
  `EXPIRED`. El acceso operativo se bloquea (o pasa a solo lectura, a definir en implementación) y
  se muestra la pantalla de "actualiza tu plan" en vez del dashboard normal.
- `PAST_DUE`/`CANCELLED`: mismo tratamiento — acceso restringido hasta resolver el pago, sin
  borrar datos (el cliente no pierde su información al dejar de pagar, solo el acceso).

**Panel de configuración de precios** (`PLATFORM_OWNER`)
- Pantalla simple para editar `PlatformConfig`: precio por hotel, moneda, días de prueba, límite
  de hoteles en prueba. Los cambios aplican a organizaciones nuevas de inmediato; los clientes ya
  activos conservan su `pricePerHotelSnapshot` (grandfathering, ver decisión de diseño #5).

### 4.7 Correos transaccionales

Lista cerrada de correos que el sistema envía (vía Resend), cada uno con su disparador:

| Correo | Disparador |
|---|---|
| Invitación a la plataforma | Se crea un `AuthToken` tipo `INVITE` (alta de usuario nuevo) |
| Recuperar contraseña | Usuario solicita "olvidé mi contraseña" |
| Prueba por vencer | Cron diario: `Organization.trialEndsAt` a 3 días o menos, sigue `TRIALING` |
| Prueba vencida | Cron diario: `Organization` pasa de `TRIALING` a `EXPIRED` |
| Pago fallido | Webhook de Stripe `invoice.payment_failed` → `Organization` pasa a `PAST_DUE` |
| Suscripción cancelada | Webhook de Stripe `customer.subscription.deleted` |

> Todos los correos se envían en el `preferredLocale` del destinatario (o español por defecto si
> no está definido) — reutilizando los mismos archivos de traducción de `next-intl`, no una
> plantilla de correo aparte por idioma desde cero.
> No se incluyen aquí notificaciones operativas por correo (ej. "se te asignó un ticket") — esas
> quedan como notificación en tiempo real dentro de la app (ya definida en Fase 2), no por correo,
> para no generar fatiga de notificaciones a operadores que revisan el sistema constantemente.

### 4.8 Documentos legales (términos y privacidad) y retención de datos

- El sistema guarda datos personales de huéspedes (`Guest.name`, `RoomStay.contactPhone`) de
  múltiples clientes distintos. Se documenta una política simple de retención:
  - Mientras una `Organization` esté `ACTIVE` o `TRIALING`, sus datos se conservan sin límite de
    tiempo (es información operativa que el cliente sigue usando).
  - Si una `Organization` queda `CANCELLED` y permanece así más de 90 días sin reactivarse, sus
    datos quedan marcados como elegibles para eliminación definitiva (la eliminación automática en
    sí es una mejora de fase futura — para el MVP basta con documentar la política y dejar el
    campo `Organization.subscriptionStatus`/fecha de cancelación como base para implementarla
    después).
- **Páginas públicas dinámicas** `/legal/terminos` y `/legal/privacidad` (enlazadas desde el
  registro y el footer): NO son texto fijo en el código — leen siempre la versión más reciente de
  `LegalDocument` para el `type` y `locale` correspondiente (ver entidad en sección 3). Si el
  documento es `format = PDF`, la página embebe/enlaza el PDF; si es `format = TEXT`, renderiza el
  Markdown guardado.
- **Panel de edición** (`PLATFORM_OWNER`, en `plataforma/legal`): permite escribir/editar el texto
  en Markdown con vista previa, o subir un PDF que reemplaza el contenido — cualquiera de las dos
  formas publica una nueva `version`, sin perder el historial de versiones anteriores.
- Escribir el contenido inicial (texto real de términos y privacidad) es un entregable de
  **documentación** (Fase 4) — la funcionalidad para poder editarlo se construye antes, en la fase
  de licenciamiento, porque es parte de la infraestructura de `PLATFORM_OWNER`.

---

## 5. Funcionalidades por fase

### Fase 1a — Núcleo (MVP mínimo funcional)
- [ ] Autenticación con NextAuth (email/password + Google)
- [ ] Flujo de alta de `Organization` nueva (signup) con `subscriptionStatus = TRIALING` y
      `trialEndsAt` calculado desde `PlatformConfig.trialDays`
- [ ] CRUD de Hoteles dentro de una `Organization` — exclusivo de `SUPERADMIN` de esa organización;
      **bloquear** la creación si la organización está en `TRIALING` y ya alcanzó
      `PlatformConfig.trialHotelLimit`, mostrando mensaje de upgrade
- [ ] Niveles de permiso: STAFF/ADMIN escopados por hotel (`UserHotelAccess`),
      CORPORATE_ADMIN/SUPERADMIN con alcance a todos los hoteles de SU organización
      (`User.corporateRole`), y `PLATFORM_OWNER` fuera de cualquier organización
- [ ] Panel de administración de Departamentos por hotel (crear/editar) — ADMIN de ese hotel,
      CORPORATE_ADMIN o SUPERADMIN de esa organización
- [ ] Al crear un Departamento, debe reflejarse automáticamente en selectores de tickets y usuarios
      de ESE hotel
- [ ] CRUD de tickets (crear, ver, editar estatus), mostrando siempre el contacto de la habitación (RoomStay)
- [ ] Eliminar ticket (soft delete) — `SUPERADMIN` siempre puede (dentro de su organización);
      `CORPORATE_ADMIN`/`ADMIN` solo si se les otorga `canDeleteTickets = true`; `STAFF` nunca.
      Panel de `SUPERADMIN` para otorgar/revocar este permiso a usuarios de su organización
- [ ] Alta de usuarios STAFF/ADMIN por hotel **vía invitación por correo** (no asignación directa
      de contraseña): se crea el `User` con `status = INVITED`, se envía `AuthToken` tipo `INVITE`
      por Resend, el usuario define su propia contraseña al aceptar. ADMIN invita STAFF en su
      hotel; solo SUPERADMIN (de esa organización) asigna CORPORATE_ADMIN o promueve a ADMIN
- [ ] Flujo de "olvidé mi contraseña" (`AuthToken` tipo `PASSWORD_RESET`, vida corta de 1 hora,
      un solo uso)
- [ ] CRUD de huéspedes (titulares) y reservas por hotel, con la posibilidad de agregar varias
      habitaciones por reserva
- [ ] Formulario para capturar el contacto (nombre/teléfono) por cada habitación dentro de una reserva
- [ ] CRUD básico de habitaciones por hotel
- [ ] Dashboard con tickets filtrados por estatus (Kanban simple: Pendiente / En proceso / Resuelto)
- [ ] Vista distinta según nivel de permiso, organización, hotel y departamento
- [ ] **Helper central de scoping** (`lib/hotel-scope.ts`): toda query que toque datos escopados
      por hotel/organización pasa por este helper — crítico ahora porque el error ya no es solo
      "fuga entre hoteles" sino "fuga entre clientes distintos"
- [ ] Internacionalización base con next-intl: rutas por locale (`/es/...`, `/en/...`),
      `messages/es.json` y `messages/en.json`, selector de idioma visible, y
      `User.preferredLocale` para recordar la preferencia de cada quien
- [ ] Seed de datos ficticios pero realistas para la demo: al menos 2 organizaciones distintas
      (una `TRIALING`, una `ACTIVE`), con 2-3 hoteles cada una, un `PLATFORM_OWNER`, y
      SUPERADMIN/CORPORATE_ADMIN/ADMIN/STAFF de ejemplo por organización

### Fase 1b — Licenciamiento y facturación (Stripe)
- [ ] Integración con Stripe: creación de `stripeCustomerId`, Checkout/Customer Portal para pasar
      de `TRIALING` a `ACTIVE`, con `quantity` = hoteles a licenciar (ver sección 4.6)
- [ ] Endpoint de webhooks de Stripe (`app/api/webhooks/stripe`) con verificación de firma,
      manejando al menos: `checkout.session.completed`, `invoice.payment_failed`, `invoice.paid`,
      `customer.subscription.deleted`
- [ ] Sincronización de `quantity` en Stripe al agregar/suspender un hotel de una organización ya
      `ACTIVE`
- [ ] Cron job que revisa `Organization` en `TRIALING` con `trialEndsAt` vencido y las pasa a
      `EXPIRED`, restringiendo acceso operativo
- [ ] Cron job diario que envía correo de "prueba por vencer" a organizaciones `TRIALING` con
      `trialEndsAt` a 3 días o menos (ver sección 4.7)
- [ ] Correos transaccionales de facturación vía Resend: prueba vencida, pago fallido, suscripción
      cancelada (disparados desde los webhooks/cron correspondientes, ver sección 4.7)
- [ ] Pantalla de "actualiza tu plan" cuando una organización está `TRIALING` en su límite,
      `PAST_DUE`, `CANCELLED` o `EXPIRED`
- [ ] Panel de `PLATFORM_OWNER`: editar `PlatformConfig` (precio, días de prueba, límite de
      hoteles en prueba), listar organizaciones con su estatus de suscripción
- [ ] Panel de `PLATFORM_OWNER` para `LegalDocument`: editor de Markdown con vista previa O carga
      de PDF, por tipo (`TERMS`/`PRIVACY`) y por idioma, publicando siempre una versión nueva sin
      perder el historial
- [ ] Páginas públicas dinámicas `/legal/terminos` y `/legal/privacidad` que leen la versión más
      reciente de `LegalDocument` (nunca texto fijo en el código)
- [ ] Seed/modo de prueba: forma de simular localmente los distintos estatus de suscripción sin
      depender de Stripe real en cada corrida de desarrollo (ej. usando Stripe CLI + eventos de
      prueba, o un modo "fake webhook" solo para desarrollo)

### Fase 1c — Mejoras al sistema de tickets (mismo release, después del núcleo)
- [ ] Historial de actividad por ticket (`TicketActivity`), generado automáticamente por cada acción
- [ ] Comentarios internos por ticket (`TicketComment`)
- [ ] Fotos adjuntas antes/después (`TicketAttachment`, vía Vercel Blob o UploadThing)
- [ ] SLA por departamento + resaltado visual de tickets vencidos
- [ ] Auto-actualización de `Room.status` para departamentos con `affectsRoomStatus = true`
- [ ] Tickets recurrentes/checklist preventivo (`RecurringTicketTemplate` + Vercel Cron)
- [ ] QR por habitación con formulario público (sin login) para que el huésped levante su propio
      ticket, con rate-limiting básico y distinción visual en el dashboard (`source = GUEST`)
- [ ] Descarga en PDF del QR por habitación (individual y "imprimir todos"), con número de cuarto
      y URL en texto plano como respaldo si el QR no escanea
- [ ] Notas de cambio de turno (`ShiftNote`)
- [ ] Catálogo de Insumos por hotel (`SupplyItem`) — ADMIN de cada hotel administra el suyo
- [ ] Al resolver un ticket, opción de etiquetar insumo(s) usado(s) y cantidad (`TicketSupplyUsage`)

### Fase 2 — Pulido y diferenciadores
- [ ] Dashboard diferenciado por rol (ver sección 4.4): STAFF, ADMIN, CORPORATE_ADMIN y SUPERADMIN
      ven vistas distintas al entrar, no una sola pantalla genérica
- [ ] Selector de hotel para cualquier usuario con acceso a más de un hotel (ADMIN multi-hotel,
      CORPORATE_ADMIN o SUPERADMIN), para entrar al detalle de una propiedad específica
- [ ] **Reporte de insumos recurrentes** cruzando los hoteles a los que cada usuario tiene acceso
      (ver sección 4.5), con normalización de nombres y desglose por hotel/nombre exacto capturado
- [ ] Notificaciones en tiempo real al cambiar estatus de un ticket
- [ ] Métricas/gráficas agregadas para ADMIN (su hotel) y CORPORATE_ADMIN/SUPERADMIN (comparativo
      entre hoteles): tiempo promedio de resolución, cumplimiento de SLA, tickets por departamento
- [ ] Exportar a PDF/Excel el set de tickets/métricas actualmente filtrado en el dashboard
- [ ] Modo oscuro
- [ ] Responsive completo (mobile-first, útil para staff con tablet/celular)
- [ ] **Accesibilidad (a11y)**: HTML semántico, navegación por teclado en formularios y tablas de
      tickets, contraste de color suficiente, y que el estado de SLA vencido no dependa solo del
      color (agregar ícono/texto, no solo borde rojo — para usuarios con daltonismo)
- [ ] Integración de Sentry: captura de errores en producción tanto en cliente como en Server
      Actions/webhooks, con alertas — importante dado que hay Stripe, cron jobs, y multi-tenancy
      donde un error silencioso puede ser costoso

### Fase 3 — Suite de pruebas automatizadas (obligatoria, previa a documentación)

No es opcional: se hace **antes** de escribir la documentación final, porque parte de esa
documentación (cobertura, cómo correr las pruebas) depende de que la suite ya exista.

- [ ] **Tests unitarios** (Vitest) sobre lógica de negocio pura, sin tocar base de datos:
  - Cálculo de `slaDueAt` y detección de SLA vencido (`lib/sla.ts`)
  - Helper de permisos `lib/auth/can.ts` (qué puede hacer cada `permissionLevel`)
  - Lógica de auto-actualización de `Room.status`
- [ ] **Tests de integración** sobre Server Actions críticos (usando una base de datos de prueba,
  ej. SQLite en memoria o un contenedor Postgres de test):
  - Crear/reasignar/eliminar ticket respetando permisos por nivel
  - Crear departamento y verificar que aparece en selectores dependientes
  - Creación de ticket vía QR (`source = GUEST`) con rate-limiting
- [ ] **Tests end-to-end** (Playwright) sobre los flujos principales de usuario:
  - Login (email/password y Google)
  - Un STAFF crea y resuelve un ticket
  - Un huésped reporta un ticket vía QR sin login
  - Un SUPERADMIN elimina un ticket (y un STAFF/ADMIN NO puede)
  - Un ADMIN crea un departamento nuevo y aparece disponible al crear un ticket
- [ ] Meta de cobertura mínima razonable (ej. 70%+ en `lib/` y `actions/`) — no es necesario
  perseguir 100%, pero sí cubrir la lógica de negocio y los flujos de permisos
- [ ] CI en GitHub Actions: correr toda la suite automáticamente en cada push/PR a `main` — esto
  también es una señal fuerte de profesionalismo en el repo para quien lo revise

### Fase 4 — Documentación del proyecto (entrega final)

Documentar es la última fase, pero **no opcional**: un portafolio sin documentación clara pierde
gran parte de su valor frente a un reclutador o cliente. Entregables mínimos:

- [ ] **README completo**: qué es el proyecto, problema que resuelve, stack, cómo instalarlo
  localmente, link a la demo en vivo, credenciales de prueba por rol, capturas de pantalla
- [ ] **Mapa de sitio (site map)**: todas las rutas de la aplicación, agrupadas por público/staff,
  indicando qué nivel de permiso necesita cada una (`STAFF`/`ADMIN` de hotel específico,
  `CORPORATE_ADMIN`/`SUPERADMIN` de una organización, o `PLATFORM_OWNER`), o si es pública
  (ej. `/qr/[slug]`) — mismo tipo de entregable que ya generaste para la auditoría de SBC
- [ ] **Matriz de permisos**: tabla cruzada de acciones del sistema (crear ticket, eliminar
  ticket, crear departamento, promover usuario, dar de alta hotel, editar precio, etc.) contra
  los cinco niveles de permiso (`STAFF`/`ADMIN`/`CORPORATE_ADMIN`/`SUPERADMIN`/`PLATFORM_OWNER`)
- [ ] **Diagrama entidad-relación (ERD)** del modelo de datos completo (se puede generar
  automáticamente desde `schema.prisma` con `prisma-erd-generator`)
- [ ] **Diagrama de arquitectura**: cómo se conectan Next.js, la base de datos, el storage de
  fotos, el cron job de tickets recurrentes, Stripe (webhooks + Checkout), y los providers de
  autenticación
- [ ] **Registro de decisiones de arquitectura (ADRs)**: documento corto por cada decisión
  importante ya tomada en este plan y el porqué (ej. "por qué Next.js full-stack en vez de
  Laravel+React", "por qué soft delete en tickets", "por qué el `status` del ticket es fijo y no
  un catálogo dinámico", "por qué los enums se guardan en inglés neutral para soportar i18n",
  "por qué row-level multi-tenancy y no database-per-tenant como en SBC V3", "por qué facturación
  por cantidad en una sola suscripción de Stripe en vez de una suscripción por hotel") — muy útil
  para defender decisiones en entrevista técnica
- [ ] **Manual de usuario breve por rol**: una guía corta (puede ser una sola página por rol) de
  cómo usar el sistema desde la perspectiva de Recepción, Mantenimiento y Admin/Superadmin
- [ ] **Contenido real de Términos y Aviso de Privacidad**: redactar el texto (o preparar el PDF)
  y publicarlo como primera `version` de `LegalDocument` para `TERMS` y `PRIVACY`, en español e
  inglés — la funcionalidad para editarlos ya se construyó en Fase 1b, aquí solo falta el
  contenido real, incluyendo la política de retención definida en la sección 4.8
- [ ] **Changelog**: registro simple de qué se entregó en cada fase (1a, 1b, 2, 3)

---

## 6. Estructura de carpetas propuesta

```
service-tracker-v2/
├── messages/                    # archivos de traducción de next-intl
│   ├── es.json                  # español (idioma base)
│   ├── en.json                  # inglés
│   └── (agregar nuevos idiomas aquí a futuro, sin tocar código)
├── app/
│   ├── [locale]/                # next-intl: TODO el árbol de rutas vive bajo el locale activo
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   ├── invite/[token]/         # aceptar invitación y definir contraseña
│   │   │   └── reset-password/[token]/ # flujo de "olvidé mi contraseña"
│   │   ├── legal/
│   │   │   ├── privacidad/             # página pública dinámica, lee LegalDocument (sección 4.8)
│   │   │   └── terminos/               # página pública dinámica, lee LegalDocument (sección 4.8)
│   │   ├── (dashboard)/
│   │   │   ├── [hotelId]/                  # contexto de un hotel específico (STAFF/ADMIN operan aquí)
│   │   │   │   ├── tickets/
│   │   │   │   ├── huespedes/
│   │   │   │   ├── habitaciones/
│   │   │   │   ├── admin/
│   │   │   │   │   ├── departamentos/      # ADMIN de ese hotel, CORPORATE_ADMIN o SUPERADMIN
│   │   │   │   │   ├── usuarios/
│   │   │   │   │   ├── insumos/            # catálogo SupplyItem de ese hotel
│   │   │   │   │   └── recurrentes/        # plantillas de tickets recurrentes
│   │   │   │   └── reportes/
│   │   │   └── corporativo/                # solo CORPORATE_ADMIN / SUPERADMIN (de su organización)
│   │   │       ├── hoteles/                # alta y administración de propiedades
│   │   │       ├── insumos-recurrentes/    # reporte cruzado (sección 4.5)
│   │   │       ├── usuarios/               # asignación de CORPORATE_ADMIN, promociones
│   │   │       └── facturacion/            # pantalla de pago/upgrade (Stripe Checkout/Portal)
│   │   │   └── plataforma/                 # solo PLATFORM_OWNER — fuera de cualquier organización
│   │   │       ├── organizaciones/         # listado y estatus de todos los clientes
│   │   │       ├── configuracion/          # editar PlatformConfig (precio, prueba, límites)
│   │   │       └── legal/                  # editor/carga de LegalDocument (términos, privacidad)
│   │   └── layout.tsx
│   ├── qr/
│   │   └── [qrSlug]/               # formulario público sin login (fuera de [locale]: usa el idioma
│   │                                # del navegador del huésped directamente, sin selector)
│   ├── api/
│   │   ├── auth/[...nextauth]/
│   │   ├── webhooks/
│   │   │   └── stripe/              # recibe y valida eventos de Stripe (sección 4.6)
│   │   └── cron/
│   │       ├── recurring-tickets/  # job periódico (Vercel Cron)
│   │       ├── expire-trials/      # revisa Organization.trialEndsAt vencidos
│   │       └── trial-reminders/    # envía correo de "prueba por vencer" (sección 4.7)
│   └── layout.tsx
├── components/
│   ├── ui/                     # shadcn components
│   └── tickets/
│       ├── ticket-timeline.tsx     # TicketActivity
│       ├── ticket-comments.tsx     # TicketComment
│       └── ticket-attachments.tsx  # TicketAttachment
├── lib/
│   ├── prisma.ts
│   ├── auth.ts
│   ├── hotel-scope.ts           # helper central de scoping por hotelId/organizationId
│   ├── stripe.ts                # cliente de Stripe + helpers de suscripción
│   ├── email.ts                 # cliente de Resend + plantillas de correo (sección 4.7)
│   ├── i18n.ts                  # config de next-intl: locales soportados, default, detección
│   ├── sla.ts                  # cálculo de slaDueAt y detección de vencidos
│   └── actions/                # server actions
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── vercel.json                 # config de Vercel Cron
├── .env.example
└── README.md
```

---

## 7. Plan de despliegue

### 7.1 Estrategia de hosting: Hobby para demo/portafolio, Pro cuando haya venta real

**Decisión**: mientras el proyecto sea una demo de portafolio sin clientes reales pagando, se
despliega en **Vercel Hobby (gratis)**. El plan Pro ($20 USD/mes) se activa recién cuando exista
un cliente real dispuesto a pagar — no antes.

Esto es válido porque el plan Hobby prohíbe uso *comercial/generador de ingresos*, no prohíbe que
el código tenga la capacidad de cobrar. Mientras Stripe esté configurado en **modo test** (sin
dinero real moviéndose, sin promoción activa, sin clientes reales) el proyecto sigue siendo, en la
práctica, una demo personal — el mismo tratamiento que cualquier prototipo de SaaS antes de tener
su primer cliente.

> **Regla dura, no negociable**: en el momento en que exista un primer cliente real pagando (Stripe
> en modo live, dinero real), hay que migrar a Pro de inmediato. No es solo un tema de términos de
> servicio — técnicamente Hobby no alcanza para operar en serio (ver limitación de cron abajo).

**Implicación técnica del cron en Hobby**: en Vercel Hobby, los cron jobs corren **como máximo una
vez al día** (no cada hora como se planteó originalmente). Se ajustan ambos jobs a esa cadencia:
- `recurring-tickets`: revisa una vez al día qué plantillas (`RecurringTicketTemplate`) tienen
  `nextRunAt` vencido — es suficiente, ya que la frecuencia mínima de una plantilla es diaria de
  todos modos (`DAILY | WEEKLY | MONTHLY`).
- `expire-trials`: revisa una vez al día qué organizaciones tienen `trialEndsAt` vencido — un
  vencimiento de prueba no necesita precisión de minutos, un día de margen es aceptable.

Ningún otro requisito del plan depende de cron más frecuente que diario, así que Hobby no limita
ninguna funcionalidad — solo la puntualidad exacta de estos dos jobs, que no es crítica.

### 7.2 Pasos de despliegue

1. Repo en GitHub (público) → conectado a Vercel (deploy automático), team en plan **Hobby**
2. Base de datos en Neon (free tier: 0.5 GB almacenamiento, 100 horas-CU/mes por proyecto)
3. Variables de entorno en Vercel: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`,
   `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` (el Price de Stripe configurado
   como "por unidad" para el cobro por hotel) — **todas apuntando a las llaves de test de Stripe**
   mientras se esté en Hobby/demo
4. Configurar el endpoint de webhook en el dashboard de Stripe (modo test) apuntando a
   `https://<dominio>/api/webhooks/stripe`
5. Seed de datos ficticios corrido una vez en producción (vía script o Prisma Studio)
6. README con link en vivo, capturas, y credenciales de demo por rol — incluyendo un usuario
   `PLATFORM_OWNER`, uno `SUPERADMIN` de una organización `ACTIVE`, y uno de una organización
   `TRIALING`, para que el reclutador vea de inmediato tanto la operación normal como el
   diferenciador de negocio (licenciamiento multi-cliente)

### 7.3 Costos estimados

**Fase demo/portafolio (Hobby, sin clientes reales):**

| Componente | Costo |
|---|---|
| Vercel Hobby | $0 |
| Neon (free tier) | $0 (hasta 0.5 GB y 100 horas-CU/mes) |
| Vercel Blob (free tier de Hobby) | $0 (hasta 1 GB almacenamiento, 10 GB transferencia/mes) |
| Stripe en modo test | $0 (no hay cobros reales) |
| Resend (correo transaccional) | $0 en su free tier (volumen bajo, suficiente para demo) |
| Sentry (monitoreo de errores) | $0 en su free tier (volumen bajo, suficiente para demo) |
| Dominio propio (opcional) | ~$12-15 USD/año |
| **Total mensual** | **$0** (o ~$1/mes si se cuenta el dominio prorrateado) |

**Cuando exista el primer cliente real pagando (migración obligatoria a Pro):**

| Componente | Costo |
|---|---|
| Vercel Pro | $20 USD/mes (incluye $20 de crédito de uso) |
| Neon (si se excede el free tier) | $0.106/hora-CU + $0.35/GB-mes de almacenamiento, sin mínimo |
| Vercel Blob (más allá del crédito de Pro) | $0.023/GB-mes almacenamiento + $0.05/GB transferencia |
| Resend / Sentry (si se excede el free tier) | Variable según volumen — revisar precios vigentes al momento |
| Stripe (variable, % sobre ingresos, no costo fijo) | 3.6% + $3 MXN por cargo nacional; +1.5% tarjeta internacional; +2% si hay conversión de moneda |
| **Total fijo estimado a escala pequeña** | **~$25-40 USD/mes**, más el % de Stripe sobre lo facturado |

> Nota: estos precios son de agosto 2026 y los proveedores los cambian con cierta frecuencia —
> conviene verificar las páginas oficiales de precios antes de presupuestar en serio.

---

## 8. Notas para Claude Code al iniciar desarrollo

- Priorizar Fase 1 completa y funcional antes de tocar Fase 2.
- **Idioma del código**: todo el código (variables, funciones, componentes, archivos, nombres de
  tabla/columna en la base de datos) va en inglés — ver sección 2.1. Comentarios en español están
  bien. Nunca mezclar (ej. una columna `estado` junto a `status`, o un componente `TicketCard`
  junto a otro `TarjetaTicket`).
- No usar datos reales de ningún cliente/hotel — todo el seed debe ser ficticio.
- Mantener el código simple y legible por encima de "clever" — este proyecto se va a mostrar en
  entrevistas, así que la claridad del código importa tanto como que funcione.
- Confirmar el modelo de datos final (sección 3) antes de generar migraciones definitivas.
- Usar Server Actions de Next.js en vez de crear una API REST separada, salvo que se justifique
  un endpoint público (ej. webhook).
- **Autenticación**: implementar NextAuth con dos providers activos simultáneamente:
  - `CredentialsProvider` para login con email/password (password hasheado con bcrypt,
    validado contra `User.passwordHash`).
  - `GoogleProvider` como alternativa de login rápido (requiere `GOOGLE_CLIENT_ID` y
    `GOOGLE_CLIENT_SECRET` en variables de entorno).
  - Si un usuario entra por primera vez con Google y su email coincide con un `User` ya
    existente (creado por un admin con rol asignado), debe vincularse a esa cuenta en vez de
    crear un usuario duplicado sin rol.
  - Si el email de Google no existe en la base, definir política: ¿se crea un `User` nuevo sin
    rol asignado (pendiente de aprobación por gerencia), o se rechaza el login? Recomendado:
    crear sin rol y bloquear acceso al dashboard hasta que gerencia le asigne uno — evita logins
    no autorizados con cualquier cuenta de Google.
- **Jerarquía de permisos**: implementar un helper central (ej. `lib/auth/can.ts`) que reciba el
  `User` actual y, según el caso, valide `UserHotelAccess.permissionLevel` para acciones escopadas
  a un hotel, o `User.corporateRole` para acciones que requieren alcance corporativo (crear hotel,
  eliminar ticket, promover usuario, ver reporte cruzado de insumos). No confiar solo en ocultar
  botones en la UI — la validación real debe estar en el servidor, ya que los Server Actions son
  el equivalente a endpoints.
- **Hotel scoping (crítico)**: dado que es multi-tenancy row-level, TODA query que lea/escriba
  datos de `Ticket`, `Room`, `Department`, `Reservation`, `SupplyItem`, etc. debe pasar por el
  helper central `lib/hotel-scope.ts`, que agrega automáticamente el filtro `hotelId` correcto
  según el contexto del usuario (su hotel actual si es STAFF/ADMIN, o el hotel seleccionado en el
  selector si es CORPORATE_ADMIN/SUPERADMIN). Nunca construir estas queries "a mano" en cada
  Server Action individual — es la fuente de bugs de fuga de datos entre hoteles más probable en
  este tipo de arquitectura.
- **Permiso otorgable `canDeleteTickets`**: el helper `lib/auth/can.ts` debe resolver la lógica
  completa en un solo lugar: `SUPERADMIN` → siempre `true`; `CORPORATE_ADMIN` → revisar
  `User.canDeleteTickets`; `ADMIN` → revisar `UserHotelAccess.canDeleteTickets` del hotel en
  contexto; `STAFF` → siempre `false`, sin excepción. Incluir en la UI de administración de
  usuarios (solo visible/editable por `SUPERADMIN`) un toggle explícito para otorgar/revocar este
  permiso, con confirmación, ya que es una acción destructiva sensible.
- **Internacionalización (i18n)**: implementar con `next-intl` desde el arranque del proyecto, no
  como algo que se agrega después — mover toda ruta bajo `app/[locale]/` implica reestructurar el
  proyecto entero si se hace tarde. Reglas clave:
  - Ningún texto de interfaz debe quedar hardcodeado en componentes — todo pasa por claves de
    traducción (`useTranslations()` de next-intl), desde el primer componente que se escriba.
  - Los enums de negocio (`Ticket.status`, `Ticket.priority`, `Room.status`, etc.) se guardan en
    inglés neutral en la base de datos; la traducción a español/inglés ocurre solo al mostrarlos,
    mapeando cada valor de enum a una clave de `messages/{locale}.json`.
  - Agregar un idioma nuevo a futuro debe significar únicamente: crear `messages/{nuevo}.json` y
    registrar el locale en `lib/i18n.ts` — cero cambios en componentes o lógica de negocio. Si
    agregar un idioma requiere tocar componentes, algo se hardcodeó y hay que corregirlo.
  - La ruta pública `/qr/[qrSlug]` (fuera de `[locale]`) puede detectar el idioma del navegador
    del huésped directamente sin selector visible, para no agregarle fricción a un formulario que
    debe ser lo más simple posible.
- **Seed inicial**: el script de seed debe crear al menos 2 `Organization` distintas (una
  `TRIALING`, una `ACTIVE`), 2-3 `Hotel` por organización, un usuario `PLATFORM_OWNER`, y por cada
  organización un `SUPERADMIN`, un `CORPORATE_ADMIN`, y `ADMIN`/`STAFF` por hotel vía
  `UserHotelAccess` — para poder demostrar en la demo tanto el aislamiento entre clientes como
  entre hoteles del mismo cliente, y la vista corporativa cruzada.
- **Fotos adjuntas**: usar Vercel Blob Storage (free tier de Hobby: 1 GB almacenamiento, 10 GB
  transferencia/mes — suficiente para la demo; monitorear si se acerca al límite). No guardar
  archivos binarios en la base de datos — solo la URL en `TicketAttachment`.
- **Tickets recurrentes**: el cron job (`app/api/cron/recurring-tickets`) se configura en
  `vercel.json` con cadencia **diaria** (`0 6 * * *` o similar) — es el máximo que permite Vercel
  Hobby, y es suficiente porque ninguna plantilla corre con más frecuencia que diaria (ver sección
  7.1). Debe ser idempotente: si el cron corre dos veces seguidas por algún reintento, no debe
  crear tickets duplicados para la misma `nextRunAt`.
- **SLA**: centralizar el cálculo de `slaDueAt` y la lógica de "vencido" en `lib/sla.ts`, para no
  duplicar la fórmula (departamento + multiplicador de prioridad) en varios componentes.
- **Ruta pública `/qr/[qrSlug]`**: es la única parte del sistema sin autenticación. Tratarla como
  superficie pública: validar `qrSlug` contra la base antes de mostrar nada, aplicar rate-limiting
  (ej. con `@upstash/ratelimit` o similar) en el Server Action que crea el ticket, y nunca exponer
  información de otras habitaciones/huéspedes en esa vista — solo el formulario de reporte.
- **Webhook de Stripe (`app/api/webhooks/stripe`)**: SIEMPRE verificar la firma del webhook
  (`stripe.webhooks.constructEvent` con `STRIPE_WEBHOOK_SECRET`) antes de procesar cualquier
  evento — nunca confiar en el payload sin verificar, ya que es un endpoint público. Manejar cada
  tipo de evento de forma idempotente (Stripe puede reenviar el mismo evento más de una vez): usar
  el `event.id` para detectar y descartar duplicados antes de aplicar cambios en `Organization`.
- **Aislamiento multi-cliente**: dado que ahora `Organization` es el límite de aislamiento más
  crítico del sistema (más grave que el aislamiento entre hoteles), cualquier Server Action que
  toque `Hotel`, `Ticket`, `User`, etc. debe validar primero que el recurso pertenece a la
  `Organization` del usuario autenticado, vía el helper `lib/hotel-scope.ts`, antes de cualquier
  otra lógica de permisos.
- **Tokens de `AuthToken`**: nunca guardar el token en texto plano — hashearlo (ej. SHA-256) antes
  de guardarlo, igual que una contraseña, y comparar el hash al validar. El link que se envía por
  correo lleva el token en texto plano, pero la base de datos nunca lo tiene así. Invalidar
  siempre el token anterior al generar uno nuevo del mismo tipo para el mismo usuario (ej. si pide
  "olvidé mi contraseña" dos veces, el primer link ya no debe funcionar).
- **Correos (`lib/email.ts`)**: centralizar el envío y las plantillas ahí, reutilizando las claves
  de traducción de `next-intl` para el idioma del destinatario (ver sección 4.7). No enviar correos
  reales de prueba a direcciones ficticias del seed — usar el modo sandbox/test de Resend durante
  desarrollo.
- **Accesibilidad**: cualquier indicador de estado que use color (SLA vencido, ticket de huésped,
  etc.) debe ir acompañado de texto o ícono, nunca depender solo del color. Usar los componentes
  de shadcn/ui tal cual (ya vienen con buen soporte de teclado/ARIA) en vez de reconstruirlos desde
  cero, salvo que el diseño lo requiera explícitamente.
- **`LegalDocument`**: cada publicación crea un registro nuevo (`version + 1`), nunca se actualiza
  un registro existente — son inmutables una vez publicados, por trazabilidad legal. Si se sube un
  PDF, validar tipo MIME (`application/pdf`) y un límite de tamaño razonable (ej. 5MB) antes de
  subirlo a Vercel Blob; nunca confiar en la extensión del archivo para decidir el tipo.
- **Orden de fases obligatorio**: no saltar a Fase 4 (Documentación) sin haber completado Fase 3
  (Suite de pruebas). La documentación depende de que exista una suite real que describir, y
  escribir tests después de "terminar" el proyecto casi nunca sucede en la práctica — por eso se
  fija como fase obligatoria y no opcional.
