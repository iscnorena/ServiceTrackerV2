/// Contenido inicial de los documentos legales, publicado como versión 1 desde
/// el seed. A partir de ahí se edita desde el panel de PLATFORM_OWNER, donde
/// cada publicación crea una versión nueva sin borrar las anteriores.
///
/// AVISO: este texto es una base redactada para el proyecto, no asesoría legal.
/// Antes de operar con clientes reales debe revisarlo un abogado, sobre todo lo
/// relativo a la LFPDPPP mexicana y al tratamiento de datos de huéspedes.

export type LegalSeedDocument = {
  type: "TERMS" | "PRIVACY";
  locale: string;
  content: string;
};

const TERMS_ES = `## 1. Qué es este servicio

ServiceTracker es un software en la nube que permite a grupos hoteleros registrar
y dar seguimiento a los requerimientos de sus huéspedes: reportes de
mantenimiento, solicitudes de limpieza, amenidades y similares.

El servicio se presta a **organizaciones** (grupos hoteleros), no a personas
físicas individuales. Quien contrata acepta estos términos en nombre de su
organización y declara tener facultades para hacerlo.

## 2. Cuentas y accesos

Cada persona que use el sistema tiene su propia cuenta. Las cuentas son
personales e intransferibles: compartir credenciales anula la trazabilidad de
quién hizo qué, que es una de las razones de ser del servicio.

El alta de usuarios es por invitación. Cada quien define su propia contraseña al
aceptarla; el servicio nunca asigna contraseñas a nombre de un tercero.

La organización es responsable de mantener actualizada la lista de personas con
acceso, y en particular de desactivar a quienes dejen de laborar con ella.

## 3. Licencia y precio

El servicio se licencia **por propiedad (hotel) activa**, bajo suscripción
mensual. El precio vigente se muestra al momento de contratar.

Al dar de alta o suspender una propiedad, el cobro se ajusta automáticamente y se
prorratea el periodo en curso.

**Precio congelado**: si la tarifa de lista cambia después de tu contratación,
conservas el precio con el que te suscribiste. Los ajustes de tarifa aplican a
contrataciones nuevas.

## 4. Periodo de prueba

Las organizaciones nuevas cuentan con un periodo de prueba gratuito, cuya
duración se indica al registrarse. Durante la prueba puede darse de alta un
número limitado de propiedades.

Al vencer la prueba sin contratar, el acceso operativo se restringe. **La
información no se elimina**: queda disponible al contratar.

## 5. Suspensión y cancelación

La suscripción puede cancelarse en cualquier momento desde el panel de
facturación. La cancelación surte efecto al término del periodo ya pagado; no hay
reembolsos por periodos parciales.

Al cancelar, el acceso operativo se restringe pero la información se conserva
conforme a la política de retención del aviso de privacidad.

El servicio puede suspender una cuenta por falta de pago, o por un uso que
comprometa la seguridad o la disponibilidad para otras organizaciones. En ambos
casos se notifica por correo antes de restringir el acceso, salvo que la
gravedad exija actuar de inmediato.

## 6. Datos de la organización

La información que captura cada organización —tickets, huéspedes, habitaciones,
insumos— **es suya**. El servicio la almacena y procesa únicamente para prestar
la funcionalidad contratada.

Las organizaciones cliente operan aisladas entre sí: ninguna puede acceder a
información de otra.

El personal que opera la plataforma **no tiene acceso a los datos operativos de
los clientes**. Su acceso se limita a la administración del licenciamiento:
cuentas, suscripciones y facturación. Un acceso excepcional a datos operativos
—por ejemplo para diagnosticar una falla reportada— requiere autorización
expresa de la organización afectada.

## 7. Disponibilidad

El servicio se presta "tal cual", con el compromiso de mantenerlo operando de
forma razonable. No se garantiza disponibilidad ininterrumpida: puede haber
mantenimientos programados, y fallas de proveedores de infraestructura fuera de
control directo.

Este servicio **no sustituye** los sistemas críticos del hotel. En particular, no
es un sistema de gestión hotelera (PMS) ni un sistema de seguridad, y no debe
usarse como único medio para reportar emergencias.

## 8. Responsabilidad

La responsabilidad del servicio se limita al monto pagado por la organización en
los tres meses previos al hecho que la origine.

No se responde por lucro cesante, pérdida de oportunidades comerciales, ni daños
indirectos derivados del uso o de la imposibilidad de uso del servicio.

## 9. Cambios a estos términos

Estos términos pueden actualizarse. Cada publicación genera una versión nueva y
las anteriores se conservan. La fecha de última actualización aparece al inicio
de esta página.

Los cambios sustanciales se notifican por correo a las personas con rol de
administración de cada organización, con al menos 30 días de anticipación.

## 10. Contacto

Para cualquier duda sobre estos términos, escribe a la dirección de contacto
publicada en el sitio.`;

const TERMS_EN = `## 1. What this service is

ServiceTracker is cloud software that lets hotel groups log and track their
guests' requests: maintenance reports, housekeeping requests, amenities and the
like.

The service is provided to **organizations** (hotel groups), not to individual
consumers. Whoever subscribes accepts these terms on behalf of their organization
and represents that they are authorized to do so.

## 2. Accounts and access

Everyone using the system has their own account. Accounts are personal and
non-transferable: sharing credentials destroys the traceability of who did what,
which is one of the reasons this service exists.

Users are added by invitation. Each person sets their own password when accepting
it; the service never assigns passwords on someone else's behalf.

The organization is responsible for keeping its list of users current, and in
particular for deactivating people who no longer work with it.

## 3. License and pricing

The service is licensed **per active property (hotel)**, on a monthly
subscription. The current price is shown at checkout.

Adding or suspending a property adjusts the charge automatically and prorates the
current period.

**Price lock**: if the list price changes after you subscribe, you keep the price
you subscribed at. Rate changes apply to new subscriptions.

## 4. Trial period

New organizations get a free trial period, whose length is shown at signup.
During the trial a limited number of properties can be registered.

If the trial ends without a subscription, operational access is restricted.
**Data is not deleted**: it becomes available again upon subscribing.

## 5. Suspension and cancellation

The subscription can be cancelled at any time from the billing panel.
Cancellation takes effect at the end of the period already paid for; there are no
refunds for partial periods.

On cancellation, operational access is restricted but data is retained according
to the retention policy in the privacy notice.

The service may suspend an account for non-payment, or for usage that compromises
security or availability for other organizations. In both cases notice is sent by
email before restricting access, unless severity requires acting immediately.

## 6. Organization data

The information each organization captures —tickets, guests, rooms, supplies— **is
theirs**. The service stores and processes it solely to provide the contracted
functionality.

Client organizations operate in isolation from each other: none can access
another's information.

Platform staff **have no access to clients' operational data**. Their access is
limited to licensing administration: accounts, subscriptions and billing.
Exceptional access to operational data —for instance to diagnose a reported
fault— requires express authorization from the affected organization.

## 7. Availability

The service is provided "as is", with a commitment to keep it reasonably
operational. Uninterrupted availability is not guaranteed: there may be scheduled
maintenance, and infrastructure provider failures outside direct control.

This service **does not replace** the hotel's critical systems. In particular it
is neither a property management system (PMS) nor a security system, and must not
be used as the sole means of reporting emergencies.

## 8. Liability

Liability is limited to the amount paid by the organization in the three months
preceding the event giving rise to the claim.

No liability is accepted for lost profits, lost business opportunities, or
indirect damages arising from use or inability to use the service.

## 9. Changes to these terms

These terms may be updated. Each publication creates a new version and previous
ones are retained. The last-updated date appears at the top of this page.

Material changes are notified by email to the people holding administrative roles
in each organization, at least 30 days in advance.

## 10. Contact

For any question about these terms, write to the contact address published on the
site.`;

const PRIVACY_ES = `## 1. Quién trata los datos

ServiceTracker opera como **encargado del tratamiento** de los datos que cada
organización cliente captura en el sistema. La organización hotelera es la
responsable frente a sus huéspedes; nosotros procesamos esa información
únicamente para prestarle el servicio.

## 2. Qué datos se tratan

**De huéspedes**, capturados por el personal del hotel:

- Nombre del titular de la reserva
- Nombre y teléfono de contacto **por habitación** — que puede ser una persona
  distinta del titular
- Fechas de estancia y habitación asignada
- El contenido de los reportes que el propio huésped envíe por el código QR

**Del personal del hotel**, para operar sus cuentas:

- Nombre, correo electrónico e idioma preferido
- Contraseña, almacenada siempre cifrada con bcrypt — nunca en texto legible
- Departamento, nivel de acceso y propiedades asignadas
- Registro de acciones sobre tickets: quién creó, reasignó, resolvió o eliminó
  cada uno, y cuándo

**De la ruta pública del código QR**: se guarda el **hash** de la dirección IP de
origen, no la dirección. Sirve únicamente para limitar el abuso del formulario y
no permite identificar a nadie ni reconstruir la IP original.

**No se tratan** datos de tarjetas ni de medios de pago. Los pagos los procesa
Stripe directamente; el sistema solo guarda el identificador de cliente que
Stripe le devuelve.

## 3. Para qué se usan

Exclusivamente para operar el seguimiento de requerimientos dentro del hotel que
los capturó:

- Mostrar al personal a quién dirigirse en cada habitación
- Medir tiempos de atención y cumplimiento de SLA
- Generar reportes agregados de consumo de insumos
- Enviar correos operativos de cuenta: invitación, recuperación de contraseña y
  avisos de facturación

**No se usan** para publicidad, ni se venden, ni se comparten con terceros
distintos de los proveedores de infraestructura listados abajo.

## 4. Con quién se comparten

| Proveedor | Para qué | Qué recibe |
|---|---|---|
| Neon / Vercel Postgres | Base de datos | Toda la información del sistema |
| Vercel | Alojamiento de la aplicación | Tráfico y registros técnicos |
| Vercel Blob | Fotos adjuntas a tickets | Solo las imágenes |
| Resend | Correo transaccional | Nombre y correo del destinatario |
| Stripe | Cobro de la suscripción | Datos de facturación de la organización |
| Google | Inicio de sesión opcional | Correo del usuario que lo elija |

## 5. Aislamiento entre clientes

Cada organización opera completamente aislada. Ningún usuario puede acceder a
información de otra organización, y el aislamiento se valida en el servidor en
cada consulta, no solo ocultando opciones en la interfaz.

El personal que opera la plataforma no tiene acceso a los datos operativos de los
clientes.

## 6. Cuánto tiempo se conservan

- Mientras la organización esté **activa o en periodo de prueba**, sus datos se
  conservan sin límite de tiempo: es información operativa que sigue usando.
- Si una organización permanece **cancelada más de 90 días** sin reactivarse, sus
  datos quedan marcados como elegibles para eliminación definitiva.
- El historial de acciones sobre tickets se conserva junto con el ticket, aunque
  la persona que las hizo haya sido desactivada. Desactivar una cuenta impide
  entrar al sistema; no borra el rastro de lo que esa persona hizo.
- Los registros de la ruta pública del QR se depuran a las 24 horas.

## 7. Derechos de las personas

Un huésped que quiera ejercer sus derechos de acceso, rectificación, cancelación
u oposición debe dirigirse **al hotel** donde se hospedó: es quien es responsable
de sus datos y quien los capturó.

El hotel puede atender esas solicitudes directamente desde el sistema, y contar
con nuestro apoyo técnico si necesita localizar o eliminar información concreta.

El personal con cuenta en el sistema puede consultar y corregir sus propios datos
desde su perfil, o solicitarlo al administrador de su organización.

## 8. Seguridad

- Contraseñas cifradas con bcrypt, nunca almacenadas ni recuperables en claro
- Tokens de invitación y de recuperación guardados hasheados, de un solo uso y
  con vencimiento corto
- Todo el tráfico cifrado en tránsito (HTTPS)
- Acceso a datos validado en el servidor en cada consulta
- Los archivos adjuntos se validan por su tipo real, no por su extensión

Ningún sistema es invulnerable. Ante un incidente que afecte datos personales, se
notificará a las organizaciones afectadas sin demora indebida.

## 9. Cambios a este aviso

Este aviso puede actualizarse. Cada publicación genera una versión nueva y las
anteriores se conservan. La fecha de última actualización aparece al inicio de
esta página.

## 10. Contacto

Para dudas sobre este aviso, escribe a la dirección de contacto publicada en el
sitio. Si eres huésped de un hotel que usa ServiceTracker, dirígete primero al
hotel.`;

const PRIVACY_EN = `## 1. Who processes the data

ServiceTracker acts as a **data processor** for the information each client
organization captures in the system. The hotel organization is the controller
towards its guests; we process that information solely to provide them the
service.

## 2. What data is processed

**About guests**, captured by hotel staff:

- Name of the booking holder
- Contact name and phone **per room** — which may be someone other than the
  booking holder
- Stay dates and assigned room
- The content of any report the guest submits through the QR code

**About hotel staff**, to operate their accounts:

- Name, email address and preferred language
- Password, always stored hashed with bcrypt — never in readable form
- Department, access level and assigned properties
- A log of ticket actions: who created, reassigned, resolved or deleted each one,
  and when

**From the public QR route**: the **hash** of the originating IP address is
stored, not the address itself. It serves only to rate-limit abuse of the form
and cannot identify anyone or reconstruct the original IP.

**Not processed**: card or payment method data. Payments are handled directly by
Stripe; the system only stores the customer identifier Stripe returns.

## 3. What it is used for

Exclusively to operate request tracking within the hotel that captured it:

- Showing staff who to contact in each room
- Measuring response times and SLA compliance
- Producing aggregate supply consumption reports
- Sending operational account email: invitations, password recovery and billing
  notices

**Not used** for advertising, not sold, and not shared with third parties other
than the infrastructure providers listed below.

## 4. Who it is shared with

| Provider | Purpose | What it receives |
|---|---|---|
| Neon / Vercel Postgres | Database | All system information |
| Vercel | Application hosting | Traffic and technical logs |
| Vercel Blob | Ticket photo attachments | Images only |
| Resend | Transactional email | Recipient name and email |
| Stripe | Subscription billing | Organization billing data |
| Google | Optional sign-in | Email of users who choose it |

## 5. Isolation between clients

Each organization operates in complete isolation. No user can access another
organization's information, and isolation is enforced server-side on every query,
not merely by hiding options in the interface.

Platform staff have no access to clients' operational data.

## 6. How long it is retained

- While the organization is **active or trialing**, its data is retained
  indefinitely: it is operational information still in use.
- If an organization stays **cancelled for more than 90 days** without
  reactivating, its data becomes eligible for permanent deletion.
- Ticket action history is retained with the ticket, even if the person who
  performed the action has been deactivated. Deactivating an account prevents
  sign-in; it does not erase the record of what that person did.
- Public QR route logs are purged after 24 hours.

## 7. Individual rights

A guest wishing to exercise access, rectification, erasure or objection rights
should contact **the hotel** where they stayed: it is the controller of their data
and the party that captured it.

The hotel can handle those requests directly from the system, with our technical
support if it needs to locate or delete specific information.

Staff with an account can view and correct their own data from their profile, or
request it from their organization's administrator.

## 8. Security

- Passwords hashed with bcrypt, never stored or recoverable in clear text
- Invitation and recovery tokens stored hashed, single-use and short-lived
- All traffic encrypted in transit (HTTPS)
- Data access validated server-side on every query
- File attachments validated by actual type, not by extension

No system is invulnerable. In the event of an incident affecting personal data,
affected organizations will be notified without undue delay.

## 9. Changes to this notice

This notice may be updated. Each publication creates a new version and previous
ones are retained. The last-updated date appears at the top of this page.

## 10. Contact

For questions about this notice, write to the contact address published on the
site. If you are a guest of a hotel using ServiceTracker, please contact the
hotel first.`;

export const LEGAL_DOCUMENTS: LegalSeedDocument[] = [
  { type: "TERMS", locale: "es", content: TERMS_ES },
  { type: "TERMS", locale: "en", content: TERMS_EN },
  { type: "PRIVACY", locale: "es", content: PRIVACY_ES },
  { type: "PRIVACY", locale: "en", content: PRIVACY_EN },
];
