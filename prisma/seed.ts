import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

/// Seed de demo. Todo es ficticio a propósito: no se usan datos reales de ningún
/// hotel ni huésped. Crea dos clientes distintos (uno pagando, uno en prueba)
/// para poder demostrar en vivo tanto el aislamiento entre organizaciones como
/// el que hay entre hoteles de una misma organización.

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DEMO_PASSWORD = "Demo1234!";

function normalize(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function slug(length = 10): string {
  const alphabet = "23456789abcdefghijkmnpqrstuvwxyz";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60 * 1000);
}

const DEPARTMENT_TEMPLATES = [
  { name: "Recepción", defaultSlaMinutes: 30, affectsRoomStatus: false },
  { name: "Mantenimiento", defaultSlaMinutes: 60, affectsRoomStatus: true },
  { name: "Ama de llaves", defaultSlaMinutes: 45, affectsRoomStatus: false },
  { name: "Amenidades", defaultSlaMinutes: null, affectsRoomStatus: false },
];

const SUPPLY_TEMPLATES = [
  ["Pilas AA", "Baterías AA", "Pilas AA"],
  ["Control remoto TV", "Control de TV", "Control remoto"],
  ["Foco baño", "Foco de baño", "Focos baño"],
  ["Toallas de baño", "Toallas", "Toalla de baño"],
];

const TICKET_TEMPLATES = [
  { title: "Aire acondicionado no enfría", description: "El huésped reporta que el A/C está encendido pero no baja la temperatura.", department: "Mantenimiento", priority: "HIGH" as const },
  { title: "Control de TV sin pilas", description: "No responde el control; se revisa si es batería o el aparato.", department: "Mantenimiento", priority: "MEDIUM" as const },
  { title: "Solicitud de toallas extra", description: "Piden dos toallas de baño adicionales.", department: "Ama de llaves", priority: "LOW" as const },
  { title: "Fuga en regadera", description: "Gotea de forma constante, se escucha desde el pasillo.", department: "Mantenimiento", priority: "HIGH" as const },
  { title: "Cambio de almohadas", description: "Solicitan almohadas hipoalergénicas.", department: "Amenidades", priority: "LOW" as const },
  { title: "Caja fuerte bloqueada", description: "No acepta el código configurado al check-in.", department: "Recepción", priority: "HIGH" as const },
  { title: "Foco fundido en baño", description: "Se reporta el foco del tocador sin funcionar.", department: "Mantenimiento", priority: "MEDIUM" as const },
  { title: "Wi-Fi intermitente", description: "La señal se cae cada pocos minutos en el cuarto.", department: "Mantenimiento", priority: "MEDIUM" as const },
];

async function main() {
  console.log("Limpiando datos previos…");
  await prisma.$transaction([
    prisma.ticketSupplyUsage.deleteMany(),
    prisma.ticketAttachment.deleteMany(),
    prisma.ticketComment.deleteMany(),
    prisma.ticketActivity.deleteMany(),
    prisma.ticket.deleteMany(),
    prisma.recurringTicketTemplate.deleteMany(),
    prisma.shiftNote.deleteMany(),
    prisma.supplyItem.deleteMany(),
    prisma.roomStay.deleteMany(),
    prisma.reservation.deleteMany(),
    prisma.guest.deleteMany(),
    prisma.room.deleteMany(),
    prisma.userHotelAccess.deleteMany(),
    prisma.department.deleteMany(),
    prisma.authToken.deleteMany(),
    prisma.account.deleteMany(),
    prisma.session.deleteMany(),
    prisma.legalDocument.deleteMany(),
    prisma.platformConfig.deleteMany(),
    prisma.user.deleteMany(),
    prisma.hotel.deleteMany(),
    prisma.organization.deleteMany(),
    prisma.processedStripeEvent.deleteMany(),
  ]);

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const platformOwner = await prisma.user.create({
    data: {
      name: "Christopher Noreña",
      email: "owner@servicetracker.demo",
      passwordHash,
      isPlatformOwner: true,
      status: "ACTIVE",
      preferredLocale: "es",
    },
  });

  await prisma.platformConfig.create({
    data: {
      pricePerHotelMonthly: 1499,
      currency: "MXN",
      trialDays: 14,
      trialHotelLimit: 1,
      updatedById: platformOwner.id,
    },
  });

  await seedLegalDocuments(platformOwner.id);

  // Cliente 1: pagando, con tres propiedades — es el que luce la vista corporativa.
  const grupoPacifico = await prisma.organization.create({
    data: {
      name: "Grupo Hotelero Pacífico",
      subscriptionStatus: "ACTIVE",
      pricePerHotelSnapshot: 1499,
      currencySnapshot: "MXN",
      stripeCustomerId: "cus_demo_pacifico",
      stripeSubscriptionId: "sub_demo_pacifico",
    },
  });

  // Cliente 2: en prueba y con un solo hotel — muestra el límite del trial.
  const hotelesCosta = await prisma.organization.create({
    data: {
      name: "Hoteles Costa Azul",
      subscriptionStatus: "TRIALING",
      trialEndsAt: daysFromNow(9),
    },
  });

  await seedOrganization(grupoPacifico.id, "pacifico", [
    { name: "Playa Dorada Acapulco", address: "Costera Miguel Alemán 1500, Acapulco" },
    { name: "Playa Dorada Ixtapa", address: "Blvd. Paseo Ixtapa s/n, Ixtapa" },
    { name: "Playa Dorada Huatulco", address: "Bahía de Tangolunda, Huatulco" },
  ]);

  await seedOrganization(hotelesCosta.id, "costa", [
    { name: "Costa Azul Centro", address: "Av. Cuauhtémoc 220, Acapulco" },
  ]);

  console.log("\nListo. Credenciales de demo (contraseña: %s)", DEMO_PASSWORD);
  console.log("  PLATFORM_OWNER   owner@servicetracker.demo");
  console.log("  SUPERADMIN       superadmin@pacifico.demo      (org ACTIVE, 3 hoteles)");
  console.log("  CORPORATE_ADMIN  corporativo@pacifico.demo     (org ACTIVE, 3 hoteles)");
  console.log("  ADMIN            admin1@pacifico.demo          (un solo hotel)");
  console.log("  ADMIN multi      regional@pacifico.demo        (2 hoteles)");
  console.log("  STAFF            staff1@pacifico.demo          (Mantenimiento)");
  console.log("  SUPERADMIN       superadmin@costa.demo         (org TRIALING, 1 hotel)");
}

async function seedLegalDocuments(publishedById: string) {
  const documents = [
    {
      type: "TERMS" as const,
      locale: "es",
      content: `# Términos y condiciones\n\n_Documento de demostración._\n\n## 1. Objeto\nServiceTracker es un servicio de software que permite a grupos hoteleros dar seguimiento a los requerimientos de sus huéspedes.\n\n## 2. Licencia\nEl servicio se licencia por propiedad (hotel) bajo suscripción mensual. Los precios vigentes se muestran al momento de contratar.\n\n## 3. Periodo de prueba\nLas organizaciones nuevas cuentan con un periodo de prueba gratuito. Durante la prueba se puede dar de alta un número limitado de propiedades.\n\n## 4. Cancelación\nLa suscripción puede cancelarse en cualquier momento. Al cancelar se restringe el acceso operativo, pero la información del cliente se conserva.`,
    },
    {
      type: "TERMS" as const,
      locale: "en",
      content: `# Terms and conditions\n\n_Demonstration document._\n\n## 1. Purpose\nServiceTracker is a software service that lets hotel groups track their guests' requests.\n\n## 2. License\nThe service is licensed per property (hotel) under a monthly subscription. Current prices are shown at checkout.\n\n## 3. Trial period\nNew organizations get a free trial period. During the trial a limited number of properties can be registered.\n\n## 4. Cancellation\nThe subscription can be cancelled at any time. Cancelling restricts operational access, but customer data is preserved.`,
    },
    {
      type: "PRIVACY" as const,
      locale: "es",
      content: `# Aviso de privacidad\n\n_Documento de demostración._\n\n## Datos que tratamos\nServiceTracker almacena datos de contacto de huéspedes (nombre y teléfono de contacto por habitación) capturados por el personal del hotel, así como datos de las cuentas del propio personal.\n\n## Finalidad\nLos datos se usan exclusivamente para operar el seguimiento de requerimientos dentro del hotel que los capturó.\n\n## Retención\nMientras la organización esté activa o en prueba, sus datos se conservan sin límite de tiempo. Si una organización permanece cancelada más de 90 días, sus datos quedan marcados como elegibles para eliminación definitiva.\n\n## Aislamiento entre clientes\nCada organización cliente opera de forma aislada: ningún usuario puede acceder a información de otra organización.`,
    },
    {
      type: "PRIVACY" as const,
      locale: "en",
      content: `# Privacy policy\n\n_Demonstration document._\n\n## Data we process\nServiceTracker stores guest contact data (name and per-room contact phone) captured by hotel staff, as well as staff account data.\n\n## Purpose\nData is used exclusively to operate request tracking within the hotel that captured it.\n\n## Retention\nWhile the organization is active or trialing, its data is kept indefinitely. If an organization stays cancelled for more than 90 days, its data becomes eligible for permanent deletion.\n\n## Isolation between customers\nEach client organization operates in isolation: no user can access another organization's information.`,
    },
  ];

  for (const document of documents) {
    await prisma.legalDocument.create({
      data: { ...document, format: "TEXT", version: 1, publishedById },
    });
  }
}

async function seedOrganization(
  organizationId: string,
  prefix: string,
  hotelSpecs: { name: string; address: string }[],
) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const superadmin = await prisma.user.create({
    data: {
      name: `Superadmin ${prefix}`,
      email: `superadmin@${prefix}.demo`,
      passwordHash,
      organizationId,
      corporateRole: "SUPERADMIN",
      status: "ACTIVE",
      preferredLocale: "es",
    },
  });

  await prisma.user.create({
    data: {
      name: `Gerente corporativo ${prefix}`,
      email: `corporativo@${prefix}.demo`,
      passwordHash,
      organizationId,
      corporateRole: "CORPORATE_ADMIN",
      // Permiso otorgable ya concedido, para demostrar el caso "sí puede borrar".
      canDeleteTickets: true,
      status: "ACTIVE",
      preferredLocale: "es",
    },
  });

  const hotels = [];
  for (const spec of hotelSpecs) {
    const hotel = await prisma.hotel.create({
      data: {
        organizationId,
        name: spec.name,
        address: spec.address,
        timezone: "America/Mexico_City",
      },
    });
    hotels.push(hotel);
  }

  // ADMIN de varias propiedades sin ser corporativo: el caso intermedio del
  // gerente que atiende 2 hoteles cercanos pero no todo el grupo.
  const regional =
    hotels.length > 1
      ? await prisma.user.create({
          data: {
            name: `Gerente regional ${prefix}`,
            email: `regional@${prefix}.demo`,
            passwordHash,
            organizationId,
            status: "ACTIVE",
            preferredLocale: "es",
          },
        })
      : null;

  for (const [index, hotel] of hotels.entries()) {
    const departments = [];
    for (const template of DEPARTMENT_TEMPLATES) {
      departments.push(
        await prisma.department.create({
          data: { ...template, hotelId: hotel.id, createdById: superadmin.id },
        }),
      );
    }

    const maintenance = departments.find((d) => d.name === "Mantenimiento")!;
    const reception = departments.find((d) => d.name === "Recepción")!;

    const admin = await prisma.user.create({
      data: {
        name: `Admin ${hotel.name}`,
        email: `admin${index + 1}@${prefix}.demo`,
        passwordHash,
        organizationId,
        status: "ACTIVE",
        preferredLocale: "es",
        hotelAccess: {
          create: {
            hotelId: hotel.id,
            permissionLevel: "ADMIN",
            departmentId: reception.id,
            // Este ADMIN no recibe el permiso: demuestra el caso "no puede borrar".
            canDeleteTickets: false,
          },
        },
      },
    });

    const staff = await prisma.user.create({
      data: {
        name: `Staff mantto ${hotel.name}`,
        email: `staff${index + 1}@${prefix}.demo`,
        passwordHash,
        organizationId,
        status: "ACTIVE",
        preferredLocale: "es",
        hotelAccess: {
          create: {
            hotelId: hotel.id,
            permissionLevel: "STAFF",
            departmentId: maintenance.id,
          },
        },
      },
    });

    if (regional && index < 2) {
      await prisma.userHotelAccess.create({
        data: {
          userId: regional.id,
          hotelId: hotel.id,
          permissionLevel: "ADMIN",
          canDeleteTickets: true,
        },
      });
    }

    // Cada hotel nombra sus insumos a su manera: es justo lo que obliga a
    // normalizar el nombre en el reporte corporativo cruzado.
    const supplies = [];
    for (const variants of SUPPLY_TEMPLATES) {
      const name = variants[index % variants.length];
      supplies.push(
        await prisma.supplyItem.create({
          data: {
            hotelId: hotel.id,
            name,
            normalizedName: normalize(name),
            createdById: admin.id,
          },
        }),
      );
    }

    const rooms = [];
    for (let floor = 1; floor <= 3; floor++) {
      for (let n = 1; n <= 6; n++) {
        rooms.push(
          await prisma.room.create({
            data: {
              hotelId: hotel.id,
              number: `${floor}${String(n).padStart(2, "0")}`,
              floor: String(floor),
              qrSlug: slug(),
            },
          }),
        );
      }
    }

    const guestNames = [
      "María Fernanda Ruiz",
      "Jorge Alberto Peña",
      "Claudia Serrano",
      "Grupo Constructora Vega",
    ];

    const roomStays = [];
    for (const [guestIndex, guestName] of guestNames.entries()) {
      const guest = await prisma.guest.create({
        data: {
          hotelId: hotel.id,
          name: guestName,
          email: `huesped${guestIndex + 1}@ejemplo.demo`,
          phone: `+52 744 100 ${String(1000 + guestIndex)}`,
        },
      });

      // El último "huésped" es un grupo corporativo con varias habitaciones a su
      // nombre, cada una con un contacto distinto — el caso que motivó separar
      // Guest de RoomStay.
      const isGroup = guestIndex === guestNames.length - 1;
      const assigned = isGroup
        ? rooms.slice(guestIndex * 2, guestIndex * 2 + 3)
        : [rooms[guestIndex * 2]];

      const checkIn = daysFromNow(-1);
      const checkOut = daysFromNow(3);

      const reservation = await prisma.reservation.create({
        data: {
          hotelId: hotel.id,
          guestId: guest.id,
          checkIn,
          checkOut,
          notes: isGroup ? "Evento corporativo — tres habitaciones" : null,
          roomStays: {
            create: assigned.map((room, roomIndex) => ({
              roomId: room.id,
              contactName: isGroup
                ? ["Ing. Raúl Vega", "Lic. Ana Torres", "Sr. Pablo Méndez"][roomIndex]
                : guestName,
              contactPhone: `+52 744 200 ${String(2000 + guestIndex * 3 + roomIndex)}`,
              checkIn,
              checkOut,
            })),
          },
        },
        include: { roomStays: true },
      });

      roomStays.push(...reservation.roomStays);
      for (const room of assigned) {
        await prisma.room.update({
          where: { id: room.id },
          data: { status: "OCCUPIED" },
        });
      }
    }

    // Tickets en distintos estados y con SLA ya vencido en algunos, para que el
    // dashboard se vea vivo desde el primer login de la demo.
    for (const [ticketIndex, template] of TICKET_TEMPLATES.entries()) {
      const department = departments.find((d) => d.name === template.department)!;
      const stay = roomStays[ticketIndex % roomStays.length];
      const createdAt = minutesAgo((ticketIndex + 1) * 95);

      const status =
        ticketIndex % 4 === 0
          ? "RESOLVED"
          : ticketIndex % 3 === 0
            ? "IN_PROGRESS"
            : "PENDING";

      const multiplier =
        template.priority === "HIGH" ? 1 : template.priority === "MEDIUM" ? 2 : 4;
      const slaDueAt = department.defaultSlaMinutes
        ? new Date(
            createdAt.getTime() + department.defaultSlaMinutes * multiplier * 60_000,
          )
        : null;

      const ticket = await prisma.ticket.create({
        data: {
          hotelId: hotel.id,
          title: template.title,
          description: template.description,
          departmentId: department.id,
          priority: template.priority,
          status,
          roomStayId: stay.id,
          assignedToId: ticketIndex % 3 === 1 ? null : staff.id,
          createdById: ticketIndex % 5 === 0 ? null : admin.id,
          source: ticketIndex % 5 === 0 ? "GUEST" : "STAFF",
          guestCategory: ticketIndex % 5 === 0 ? "BROKEN" : null,
          slaDueAt,
          createdAt,
          resolvedAt: status === "RESOLVED" ? minutesAgo(ticketIndex * 40) : null,
        },
      });

      await prisma.ticketActivity.create({
        data: {
          ticketId: ticket.id,
          userId: ticketIndex % 5 === 0 ? null : admin.id,
          action: "CREATED",
          createdAt,
        },
      });

      if (status === "RESOLVED") {
        await prisma.ticketActivity.create({
          data: {
            ticketId: ticket.id,
            userId: staff.id,
            action: "STATUS_CHANGED",
            detail: "PENDING → RESOLVED",
          },
        });
        await prisma.ticketComment.create({
          data: {
            ticketId: ticket.id,
            userId: staff.id,
            message: "Atendido en sitio. Se verificó con el huésped antes de cerrar.",
          },
        });
        await prisma.ticketSupplyUsage.create({
          data: {
            ticketId: ticket.id,
            supplyItemId: supplies[ticketIndex % supplies.length].id,
            quantity: 1 + (ticketIndex % 3),
          },
        });
      }
    }

    await prisma.shiftNote.create({
      data: {
        hotelId: hotel.id,
        departmentId: maintenance.id,
        authorId: staff.id,
        content:
          "Habitación 210 pidió toallas extra, aún no se les lleva. Pendiente refacción de regadera del 305.",
      },
    });

    await prisma.recurringTicketTemplate.create({
      data: {
        hotelId: hotel.id,
        title: "Revisión mensual de aires acondicionados",
        description: "Checklist preventivo: filtros, drenaje y termostato.",
        departmentId: maintenance.id,
        priority: "MEDIUM",
        frequency: "MONTHLY",
        nextRunAt: daysFromNow(1),
        createdById: admin.id,
      },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
