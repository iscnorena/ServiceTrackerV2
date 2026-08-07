# ServiceTracker V2

Sistema SaaS multi-cliente de seguimiento de requerimientos (tickets) para grupos hoteleros.
Reconstrucción moderna de `ServiceTrackerHotel`, un proyecto original en PHP puro, sobre un stack
Next.js 15 + TypeScript + Prisma.

El caso de uso viene de experiencia real en operación hotelera: un mismo corporativo opera varias
propiedades, hay personal que trabaja en un solo hotel y personal que supervisa varios a la vez, y
el corporativo necesita detectar patrones cruzando todas sus propiedades (por ejemplo, qué insumo se
repone constantemente) para decidir compras en volumen.

> **Estado**: en desarrollo. El plan completo por fases está en [`docs/PLAN.md`](docs/PLAN.md).
> La documentación final (mapa de sitio, matriz de permisos, ERD, ADRs) es la Fase 4 del plan.

## Qué demuestra este proyecto

- **Multi-tenancy row-level real**: varios corporativos distintos comparten instalación y base de
  datos, completamente aislados entre sí. Todo el acceso a datos pasa por un helper central de
  scoping (`src/lib/hotel-scope.ts`) en vez de construir los filtros a mano en cada consulta.
- **Modelo de permisos en dos ejes**: nivel dentro de un hotel (`STAFF`/`ADMIN`) separado del
  alcance corporativo (`CORPORATE_ADMIN`/`SUPERADMIN`), más un permiso sensible otorgable
  (`canDeleteTickets`) resuelto en un solo lugar (`src/lib/auth/can.ts`).
- **Internacionalización desde el diseño**: los enums se guardan en inglés neutral y la traducción
  vive solo en la capa visual, así que agregar un idioma es crear un archivo de mensajes y
  registrar el locale — sin tocar componentes ni lógica de negocio.
- **Licenciamiento por cantidad**: una sola suscripción de Stripe por organización con
  `quantity` = hoteles con licencia activa.

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 |
| Lenguaje | TypeScript |
| ORM / BD | Prisma 7 + PostgreSQL |
| Autenticación | NextAuth v5 (credenciales + Google) |
| UI | Tailwind CSS v4 + shadcn/ui |
| i18n | next-intl (`es` / `en`) |
| Pagos | Stripe (suscripción por cantidad) |
| Correo | Resend |

## Correr en local

Requiere Node 20+ y un PostgreSQL accesible.

```bash
# 1. Base de datos (o usa la tuya y ajusta DATABASE_URL)
docker run -d --name st2-postgres \
  -e POSTGRES_USER=st2 -e POSTGRES_PASSWORD=st2pass -e POSTGRES_DB=servicetracker \
  -p 55432:5432 postgres:16-alpine

# 2. Variables de entorno
cp .env.example .env   # ajusta DATABASE_URL y genera AUTH_SECRET

# 3. Dependencias, migraciones y datos de demo
npm install
npm run db:migrate
npm run db:seed

# 4. Arrancar
npm run dev
```

`AUTH_SECRET` se genera con `openssl rand -base64 32`.

Las llaves de Stripe, Resend y Google son opcionales en desarrollo: si faltan, el provider de
Google no se registra, los correos se imprimen en consola en vez de enviarse, y las pantallas de
facturación indican que Stripe no está configurado.

## Credenciales de demo

El seed crea dos organizaciones cliente distintas para poder demostrar el aislamiento entre ellas.
Todos los usuarios usan la contraseña `Demo1234!`.

| Rol | Correo | Contexto |
|---|---|---|
| `PLATFORM_OWNER` | `owner@servicetracker.demo` | Opera la plataforma; sin acceso a datos de clientes |
| `SUPERADMIN` | `superadmin@pacifico.demo` | Organización pagando, 3 hoteles |
| `CORPORATE_ADMIN` | `corporativo@pacifico.demo` | Ve los 3 hoteles; con permiso de borrado otorgado |
| `ADMIN` | `admin1@pacifico.demo` | Un solo hotel; **sin** permiso de borrado |
| `ADMIN` multi-hotel | `regional@pacifico.demo` | 2 de los 3 hoteles, sin ser corporativo |
| `STAFF` | `staff1@pacifico.demo` | Mantenimiento de un hotel |
| `SUPERADMIN` | `superadmin@costa.demo` | Otra organización, en periodo de prueba |

## Convenciones

Código, nombres de tabla y columnas en inglés; comentarios y documentación en español; texto visible
para el usuario siempre vía claves de traducción, nunca escrito directo en los componentes.
