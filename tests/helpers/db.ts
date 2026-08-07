import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

/// Utilidades para armar escenarios de prueba contra la base de test.
///
/// Cada test construye el mínimo que necesita en vez de reutilizar un seed
/// compartido: así queda explícito en el propio test qué situación se está
/// probando, y un cambio en el seed de demo no rompe la suite.

export async function resetDatabase(): Promise<void> {
  // El orden importa por las llaves foráneas; TRUNCATE ... CASCADE lo resuelve
  // de una vez y es mucho más rápido que borrar tabla por tabla.
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      ticket_supply_usage, ticket_attachments, ticket_comments, ticket_activities,
      tickets, recurring_ticket_templates, shift_notes, supply_items,
      room_stays, reservations, guests, rooms, user_hotel_access, departments,
      auth_tokens, accounts, sessions, legal_documents, platform_config,
      guest_report_attempts, processed_stripe_events,
      users, hotels, organizations
    RESTART IDENTITY CASCADE
  `);
}

export type Scenario = Awaited<ReturnType<typeof createScenario>>;

/// Escenario base: dos organizaciones distintas, para que cualquier test pueda
/// comprobar que no se cruzan datos entre clientes.
export async function createScenario() {
  const passwordHash = await bcrypt.hash("Test1234!", 4);

  await prisma.platformConfig.create({
    data: {
      pricePerHotelMonthly: 1000,
      currency: "MXN",
      trialDays: 14,
      trialHotelLimit: 1,
    },
  });

  const platformOwner = await prisma.user.create({
    data: {
      name: "Platform Owner",
      email: "owner@platform.test",
      passwordHash,
      isPlatformOwner: true,
    },
  });

  const orgA = await prisma.organization.create({
    data: { name: "Org A", subscriptionStatus: "ACTIVE" },
  });
  const orgB = await prisma.organization.create({
    data: { name: "Org B", subscriptionStatus: "ACTIVE" },
  });

  const hotelA1 = await prisma.hotel.create({
    data: { organizationId: orgA.id, name: "Hotel A1" },
  });
  const hotelA2 = await prisma.hotel.create({
    data: { organizationId: orgA.id, name: "Hotel A2" },
  });
  const hotelB1 = await prisma.hotel.create({
    data: { organizationId: orgB.id, name: "Hotel B1" },
  });

  const maintenance = await prisma.department.create({
    data: {
      hotelId: hotelA1.id,
      name: "Mantenimiento",
      defaultSlaMinutes: 30,
      affectsRoomStatus: true,
    },
  });
  const reception = await prisma.department.create({
    data: { hotelId: hotelA1.id, name: "Recepción", defaultSlaMinutes: 60 },
  });
  // Cada hotel necesita al menos un departamento: es el requisito mínimo para
  // poder abrir un ticket, y varios tests lo dan por hecho.
  const maintenanceA2 = await prisma.department.create({
    data: { hotelId: hotelA2.id, name: "Mantenimiento", defaultSlaMinutes: 30 },
  });
  const departmentB = await prisma.department.create({
    data: { hotelId: hotelB1.id, name: "Mantenimiento", defaultSlaMinutes: 30 },
  });

  const superadminA = await prisma.user.create({
    data: {
      name: "Superadmin A",
      email: "superadmin@a.test",
      passwordHash,
      organizationId: orgA.id,
      corporateRole: "SUPERADMIN",
    },
  });

  const corporateA = await prisma.user.create({
    data: {
      name: "Corporate A",
      email: "corporate@a.test",
      passwordHash,
      organizationId: orgA.id,
      corporateRole: "CORPORATE_ADMIN",
    },
  });

  const adminA1 = await prisma.user.create({
    data: {
      name: "Admin A1",
      email: "admin@a1.test",
      passwordHash,
      organizationId: orgA.id,
      hotelAccess: {
        create: { hotelId: hotelA1.id, permissionLevel: "ADMIN" },
      },
    },
  });

  const staffA1 = await prisma.user.create({
    data: {
      name: "Staff A1",
      email: "staff@a1.test",
      passwordHash,
      organizationId: orgA.id,
      hotelAccess: {
        create: {
          hotelId: hotelA1.id,
          permissionLevel: "STAFF",
          departmentId: maintenance.id,
        },
      },
    },
  });

  const superadminB = await prisma.user.create({
    data: {
      name: "Superadmin B",
      email: "superadmin@b.test",
      passwordHash,
      organizationId: orgB.id,
      corporateRole: "SUPERADMIN",
    },
  });

  const room = await prisma.room.create({
    data: { hotelId: hotelA1.id, number: "101", qrSlug: "testslug01" },
  });

  const guest = await prisma.guest.create({
    data: { hotelId: hotelA1.id, name: "Huésped de prueba" },
  });

  const now = new Date();
  const reservation = await prisma.reservation.create({
    data: {
      hotelId: hotelA1.id,
      guestId: guest.id,
      checkIn: new Date(now.getTime() - 86_400_000),
      checkOut: new Date(now.getTime() + 86_400_000),
      roomStays: {
        create: {
          roomId: room.id,
          contactName: "Contacto 101",
          contactPhone: "+52 744 000 0000",
          checkIn: new Date(now.getTime() - 86_400_000),
          checkOut: new Date(now.getTime() + 86_400_000),
        },
      },
    },
    include: { roomStays: true },
  });

  return {
    platformOwner,
    orgA,
    orgB,
    hotelA1,
    hotelA2,
    hotelB1,
    maintenance,
    maintenanceA2,
    reception,
    departmentB,
    superadminA,
    corporateA,
    adminA1,
    staffA1,
    superadminB,
    room,
    guest,
    roomStay: reservation.roomStays[0],
  };
}
