# ServiceTracker V2

Sistema SaaS multi-cliente de seguimiento de requerimientos para grupos
hoteleros. Reconstrucción de `ServiceTrackerHotel` —un proyecto original en PHP
puro— sobre Next.js 15, TypeScript y Prisma.

El caso de uso viene de operación hotelera real: un corporativo opera varias
propiedades, hay personal que trabaja en un solo hotel y personal que supervisa
varios a la vez, y el corporativo necesita cruzar todas sus propiedades para
detectar qué insumo se repone constantemente y comprarlo en volumen.

[![CI](https://github.com/iscnorena/ServiceTrackerV2/actions/workflows/ci.yml/badge.svg)](https://github.com/iscnorena/ServiceTrackerV2/actions/workflows/ci.yml)

---

## Qué demuestra este proyecto

**Multi-tenancy row-level real.** Varios corporativos distintos comparten
instalación y base de datos, completamente aislados. Todo el acceso a datos pasa
por un punto único ([`lib/hotel-scope.ts`](src/lib/hotel-scope.ts)) en vez de
armar filtros a mano en cada consulta. Hay tests que intentan explícitamente leer
datos de otra organización y verifican que fallen.

**Permisos en dos ejes.** El nivel dentro de un hotel (`STAFF`/`ADMIN`) está
separado del alcance corporativo (`CORPORATE_ADMIN`/`SUPERADMIN`), más un permiso
sensible otorgable —eliminar tickets— resuelto en un solo archivo
([`lib/auth/can.ts`](src/lib/auth/can.ts)). Un `STAFF` nunca puede eliminar, y no
es algo que se le pueda conceder.

**Internacionalización desde el diseño.** Los enums se guardan en inglés neutral
y la traducción vive solo en la capa visual. Agregar un idioma es crear un JSON y
registrar el locale: cero cambios en componentes o lógica.

**Licenciamiento funcionando.** Una suscripción de Stripe por cliente con
cantidad igual a los hoteles activos, precio congelado por cliente, webhooks con
firma verificada e idempotencia, y tres cron jobs diarios.

**Una superficie pública tratada como tal.** El formulario del QR no pide cuenta:
valida el slug contra la base antes de mostrar nada, limita por origen guardando
el hash de la IP y no la IP, y nunca expone datos de otros huéspedes.

---

## Documentación

| Documento | Qué contiene |
|---|---|
| [Plan de desarrollo](docs/PLAN.md) | El plan original por fases |
| [Modelo de datos](docs/modelo-de-datos.md) | ERD generado desde el schema, 25 entidades |
| [Mapa de sitio](docs/mapa-de-sitio.md) | Todas las rutas y qué nivel exige cada una |
| [Matriz de permisos](docs/matriz-de-permisos.md) | 30 acciones contra los cinco niveles |
| [Arquitectura](docs/arquitectura.md) | Cómo se conectan las piezas |
| [Decisiones (ADRs)](docs/adr/) | 12 decisiones, su porqué y qué se pierde |
| [Manual de usuario](docs/manual-de-usuario.md) | Una página por rol |
| [Changelog](CHANGELOG.md) | Qué se entregó en cada fase |

---

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
| Archivos | Vercel Blob |
| Pruebas | Vitest + Playwright |

---

## Correr en local

Requiere Node 20+ y Docker (o un PostgreSQL propio).

```bash
# 1. Base de datos
docker run -d --name st2-postgres \
  -e POSTGRES_USER=st2 -e POSTGRES_PASSWORD=st2pass -e POSTGRES_DB=servicetracker \
  -p 55432:5432 postgres:16-alpine

# 2. Variables de entorno
cp .env.example .env
#    genera AUTH_SECRET con: openssl rand -base64 32

# 3. Dependencias, migraciones y datos de demo
npm install
npm run db:migrate
npm run db:seed

# 4. Arrancar
npm run dev
```

Las llaves de Stripe, Resend, Google y Blob son **opcionales**: sin ellas el
proyecto arranca y es usable. Cada pantalla afectada lo indica en vez de fallar
—ver la tabla de degradación en [arquitectura](docs/arquitectura.md).

### Correr las pruebas

```bash
docker exec st2-postgres psql -U st2 -d postgres -c "CREATE DATABASE servicetracker_test;"
cp .env.test.example .env.test
DATABASE_URL="postgresql://st2:st2pass@localhost:55432/servicetracker_test?schema=public" \
  npx prisma migrate deploy

npm test              # unitarias + integración
npm run test:coverage # con reporte de cobertura
npm run test:e2e      # end-to-end (requiere npm run build antes)
```

La suite se niega a arrancar si `DATABASE_URL` no apunta a una base con `_test`
en el nombre: hace `TRUNCATE` de todas las tablas antes de cada archivo.

---

## Credenciales de demo

El seed crea **dos organizaciones cliente distintas** para poder demostrar el
aislamiento entre ellas en vivo. Contraseña de todos: `Demo1234!`

| Rol | Correo | Contexto |
|---|---|---|
| `PLATFORM_OWNER` | `owner@servicetracker.demo` | Opera la plataforma; **sin** acceso a datos de clientes |
| `SUPERADMIN` | `superadmin@pacifico.demo` | Organización pagando, 3 hoteles |
| `CORPORATE_ADMIN` | `corporativo@pacifico.demo` | Ve los 3 hoteles; con borrado concedido |
| `ADMIN` | `admin1@pacifico.demo` | Un solo hotel; **sin** borrado |
| `ADMIN` multi-hotel | `regional@pacifico.demo` | 2 de los 3 hoteles, sin ser corporativo |
| `STAFF` | `staff1@pacifico.demo` | Mantenimiento de un hotel |
| `SUPERADMIN` | `superadmin@costa.demo` | **Otra** organización, en periodo de prueba |

### Qué vale la pena probar

1. Entra como `superadmin@costa.demo` e intenta abrir un hotel de Grupo Pacífico
   copiando su URL: responde **404**. Es el aislamiento entre clientes.
2. Entra como `corporativo@pacifico.demo` → **Corporativo → Insumos recurrentes**.
   Ahí está el caso de uso que originó el proyecto — y su limitación honesta:
   "Toallas de baño" y "Toallas grandes" aparecen separados porque ninguna
   normalización de texto puede saber que son lo mismo.
3. Entra como `admin1@pacifico.demo`, abre un ticket y busca el botón de
   eliminar: no está. Entra como `superadmin@pacifico.demo` al mismo ticket: sí
   está.
4. Ve a **Habitaciones → Imprimir todos los QR**, copia una de las direcciones y
   ábrela en una ventana privada. Es el formulario del huésped, sin cuenta.

---

## Convenciones

Código, tablas y columnas en **inglés**. Comentarios y documentación en
**español**. Texto visible para el usuario siempre vía claves de traducción,
nunca escrito directo en un componente.

Los comentarios explican **por qué**, no qué: lo que hace el código ya se lee en
el código.
