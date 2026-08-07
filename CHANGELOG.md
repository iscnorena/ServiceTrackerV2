# Changelog

Qué se entregó en cada fase del [plan](docs/PLAN.md). Las fases son las del plan
original, no versiones publicadas: el proyecto todavía no tiene un release
etiquetado.

---

## Fase 4 — Documentación

- **Modelo de datos** ([`docs/modelo-de-datos.md`](docs/modelo-de-datos.md))
  generado desde `schema.prisma` con `npm run docs:erd`. Se emite como Mermaid en
  Markdown en vez de una imagen: GitHub lo renderiza, y el diff muestra qué
  cambió del modelo en cada commit.
- **Mapa de sitio** con el nivel de acceso que exige cada ruta.
- **Matriz de permisos** cruzando 30 acciones contra los cinco niveles.
- **Diagrama de arquitectura** y cómo se degrada el sistema sin credenciales
  externas.
- **12 ADRs** con el porqué de cada decisión y qué se pierde con ella.
- **Manual de usuario** con una página por rol, incluida la del huésped.
- **Términos y aviso de privacidad reales** en español e inglés, publicados como
  versión 1 y editables desde el panel de plataforma.

## Fase 3 — Suite de pruebas

- **148 pruebas**: 39 unitarias, 87 de integración contra base de datos real y 22
  end-to-end en navegador contra el build de producción.
- **CI en GitHub Actions**: typecheck, lint, cobertura y E2E en cada push y PR a
  `main`, con Postgres como servicio.
- La suite **se niega a correr** si `DATABASE_URL` no apunta a una base con
  `_test` en el nombre: hace `TRUNCATE` de todas las tablas y sin esa salvaguarda
  un `.env.test` faltante se llevaría los datos de la demo.

Tres defectos que encontraron las pruebas:

- El menú de usuario tronaba al abrirlo — `DropdownMenuLabel` fuera de un
  `<Group>` lanzaba un error de Base UI y dejaba "Cerrar sesión" inalcanzable.
- Las pantallas de autenticación no tenían ningún encabezado: `CardTitle` de
  shadcn renderiza un `div`. Sin esto, login y registro quedaban sin esquema
  navegable para un lector de pantalla.
- El alfabeto de los slugs de QR excluía `0`/`o` y `1`/`l` pero dejaba la `i`,
  que se confunde con ambas — y la URL se imprime para teclearse a mano.

## Fase 2 — Diferenciadores

- **Reporte de insumos recurrentes** cruzando propiedades, el caso de uso que
  originó el proyecto. Disponible para cualquiera con más de un hotel, no solo
  para roles corporativos.
- **Métricas** por hotel y comparativo entre propiedades: cumplimiento de SLA,
  tiempo promedio de resolución, tickets por departamento.
- **Exportación a Excel** que reutiliza los filtros de la vista, incluida la
  visibilidad por departamento.
- **Modo oscuro** siguiendo la preferencia del sistema, y enlace de salto al
  contenido.

## Fase 1c — Operación

- **QR público** por habitación: el huésped reporta sin cuenta, con
  rate-limiting por origen respaldado en base de datos y validación de que la
  habitación esté ocupada.
- **Hoja imprimible de QR**, una por página, con la URL en texto plano como
  respaldo cuando el código no escanea.
- **Fotos antes/después** en Vercel Blob, validadas por tipo MIME real.
- **Plantillas de mantenimiento preventivo** materializadas por un cron diario
  idempotente.
- **Notas de cambio de turno**.

## Fase 1b — Licenciamiento

- **Stripe**: una suscripción por cliente con cantidad igual a los hoteles
  activos, Checkout, Customer Portal y precio congelado por cliente.
- **Webhooks** con verificación de firma sobre el cuerpo crudo e idempotencia por
  `event.id`, con reversión de la marca si el procesamiento falla.
- **Tres cron jobs diarios**: tickets recurrentes, expiración de pruebas y aviso
  de prueba por vencer.
- **Panel de plataforma**: organizaciones con MRR estimado, configuración de
  precios y editor versionado de documentos legales.
- **Páginas legales públicas** que leen la versión vigente de la base.

## Fase 1a — Núcleo

- Autenticación con correo y contraseña, y Google opcional.
- Alta de organización con periodo de prueba y límite de propiedades.
- Multi-tenancy row-level con `hotel-scope.ts` como punto único de aislamiento.
- Matriz de permisos en dos ejes, con borrado de tickets como permiso otorgable.
- Departamentos como catálogo dinámico por hotel, con SLA propio.
- Tickets con Kanban, historial de actividad, comentarios internos y borrado
  lógico.
- Huéspedes y reservas con **contacto por habitación**, no solo del titular.
- Habitaciones, insumos y usuarios por invitación.
- Internacionalización desde el arranque: español e inglés, enums neutrales.
- Seed con dos organizaciones cliente para demostrar el aislamiento en vivo.
