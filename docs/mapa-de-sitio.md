# Mapa de sitio

Todas las rutas de la aplicación y el nivel de acceso que exige cada una.

Cada ruta de dashboard vive bajo `/{locale}/…` (`es` o `en`). La única excepción
es `/qr/{qrSlug}`, que queda fuera del árbol de locales a propósito: el huésped
que la abre no debería pasar por un selector de idioma antes de reportar algo.

**Convención de respuesta**: quien no tiene acceso recibe **404**, no 403. Un 403
confirmaría que el recurso existe, y entre organizaciones distintas eso ya es
información que no debería salir.

---

## Público (sin sesión)

| Ruta | Qué es |
|---|---|
| `/{locale}/login` | Correo y contraseña, o Google si está configurado |
| `/{locale}/signup` | Alta de una organización nueva, arranca en periodo de prueba |
| `/{locale}/forgot-password` | Solicitar link de recuperación |
| `/{locale}/reset-password/{token}` | Definir contraseña nueva. Token de un solo uso, 1 hora |
| `/{locale}/invite/{token}` | Aceptar invitación y definir contraseña. Token de 7 días |
| `/{locale}/legal/terminos` · `/terms` | Términos vigentes, leídos de `LegalDocument` |
| `/{locale}/legal/privacidad` · `/privacy` | Aviso de privacidad vigente |
| `/qr/{qrSlug}` | **Formulario del huésped.** Sin locale, sin sesión, sin selector |

---

## Contexto de hotel — `/{locale}/{hotelId}/…`

Exige acceso a ESE hotel, suscripción vigente del cliente y que la propiedad no
esté suspendida. Las tres se validan en `[hotelId]/layout.tsx`.

| Ruta | Nivel mínimo | Notas |
|---|---|---|
| `/{hotelId}` | `STAFF` | Dashboard. Un STAFF ve su cola; un ADMIN además ve sin asignar y SLA vencido por departamento |
| `/{hotelId}/tickets` | `STAFF` | Kanban. Un STAFF solo ve su departamento y lo asignado a él |
| `/{hotelId}/tickets/nuevo` | `STAFF` | A un STAFF se le fija su departamento y no puede asignar a otros |
| `/{hotelId}/tickets/{ticketId}` | `STAFF` | 404 si el ticket no es de su departamento ni está asignado a él |
| `/{hotelId}/huespedes` | `STAFF` | Huéspedes y reservas, con contacto por habitación |
| `/{hotelId}/habitaciones` | `STAFF` | Ver siempre; crear y editar solo `ADMIN` |
| `/{hotelId}/habitaciones/imprimir` | `STAFF` | Hoja de QR, una por página. `?room=` para una sola |
| `/{hotelId}/notas` | `STAFF` | Notas de cambio de turno |
| `/{hotelId}/reportes` | `STAFF` | Métricas y exportación. Con varios hoteles aparece el comparativo |
| `/{hotelId}/admin/departamentos` | `ADMIN` | Catálogo dinámico del hotel |
| `/{hotelId}/admin/usuarios` | `ADMIN` | Invitar y ajustar acceso. El toggle de borrado solo lo ve `SUPERADMIN` |
| `/{hotelId}/admin/insumos` | `ADMIN` | Catálogo de insumos del hotel |
| `/{hotelId}/admin/recurrentes` | `ADMIN` | Plantillas de mantenimiento preventivo |

---

## Corporativo — `/{locale}/corporativo/…`

Exige `corporateRole` distinto de `NONE`. Validado en `corporativo/layout.tsx`.

| Ruta | Nivel mínimo | Notas |
|---|---|---|
| `/corporativo/hoteles` | `CORPORATE_ADMIN` | Ver todos. Crear y suspender solo `SUPERADMIN` |
| `/corporativo/usuarios` | `SUPERADMIN` | Promover, otorgar borrado, desactivar cuentas |
| `/corporativo/insumos-recurrentes` | **Cualquiera con más de un hotel** | También un `ADMIN` de 2 propiedades, no solo corporativos |
| `/corporativo/facturacion` | `SUPERADMIN` | Stripe Checkout y Customer Portal |

---

## Plataforma — `/{locale}/plataforma/…`

Exige `isPlatformOwner`. Validado en `plataforma/layout.tsx`. **Sin acceso a los
datos operativos de ningún cliente**: solo al negocio de licenciamiento.

| Ruta | Qué permite |
|---|---|
| `/plataforma/organizaciones` | Clientes, estatus de suscripción y MRR estimado |
| `/plataforma/configuracion` | Precio por hotel, moneda, días y límite de prueba |
| `/plataforma/legal` | Editor de términos y privacidad, versionado por idioma |

---

## Selector de hotel

| Ruta | Cuándo aparece |
|---|---|
| `/{locale}` | Entrada. Redirige según el rol y cuántos hoteles tenga |
| `/{locale}/hoteles` | Solo si tiene acceso a más de una propiedad |

Con un solo hotel se entra directo: no se agrega un paso a quien de verdad
trabaja en una sola propiedad.

---

## API

| Ruta | Protección |
|---|---|
| `POST /api/auth/[...nextauth]` | NextAuth |
| `POST /api/webhooks/stripe` | Firma de Stripe sobre el cuerpo crudo + idempotencia por `event.id` |
| `GET /api/cron/recurring-tickets` | `Authorization: Bearer $CRON_SECRET` |
| `GET /api/cron/expire-trials` | Igual |
| `GET /api/cron/trial-reminders` | Igual |
| `GET /api/export/tickets` | Sesión + acceso al hotel; respeta la visibilidad por departamento |
| `GET /api/export/supplies` | Sesión + acceso a más de un hotel |
