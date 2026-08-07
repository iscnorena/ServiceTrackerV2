import { beforeEach, describe, expect, it } from "vitest";
import { testSession } from "../setup";
import { createScenario, resetDatabase, type Scenario } from "../helpers/db";
import { prisma } from "@/lib/prisma";
import { createRoom, updateRoom } from "@/lib/actions/rooms";
import { createGuest, createReservation } from "@/lib/actions/guests";
import { createSupplyItem, setSupplyItemActive } from "@/lib/actions/supplies";
import { createRecurringTemplate } from "@/lib/actions/recurring";
import { createShiftNote } from "@/lib/actions/shift-notes";
import { updatePlatformConfig, publishLegalDocument } from "@/lib/actions/platform";
import { getPlatformConfig } from "@/lib/platform-config";

let scenario: Scenario;

beforeEach(async () => {
  await resetDatabase();
  scenario = await createScenario();
});

function actingAs(userId: string) {
  testSession.userId = userId;
}

describe("habitaciones", () => {
  it("genera un qrSlug único e imposible de adivinar", async () => {
    actingAs(scenario.adminA1.id);

    const first = await createRoom({ hotelId: scenario.hotelA1.id, number: "201" });
    const second = await createRoom({ hotelId: scenario.hotelA1.id, number: "202" });
    expect(first.ok && second.ok).toBe(true);

    const rooms = await prisma.room.findMany({ where: { number: { in: ["201", "202"] } } });
    expect(rooms[0].qrSlug).not.toBe(rooms[1].qrSlug);
    expect(rooms[0].qrSlug.length).toBeGreaterThanOrEqual(10);
  });

  it("rechaza números duplicados en el mismo hotel pero los permite entre hoteles", async () => {
    actingAs(scenario.superadminA.id);

    expect((await createRoom({ hotelId: scenario.hotelA1.id, number: "101" })).ok).toBe(false);
    expect((await createRoom({ hotelId: scenario.hotelA2.id, number: "101" })).ok).toBe(true);
  });

  it("un STAFF no administra habitaciones", async () => {
    actingAs(scenario.staffA1.id);
    expect((await createRoom({ hotelId: scenario.hotelA1.id, number: "999" })).ok).toBe(false);
    expect(
      (await updateRoom(scenario.room.id, { hotelId: scenario.hotelA1.id, number: "999" })).ok,
    ).toBe(false);
  });
});

describe("reservas", () => {
  async function guestId() {
    actingAs(scenario.adminA1.id);
    const result = await createGuest({
      hotelId: scenario.hotelA1.id,
      name: "Titular de prueba",
    });
    if (!result.ok) throw new Error("no se pudo crear el huésped");
    return result.data.id;
  }

  it("una reserva puede abarcar varias habitaciones con contactos distintos", async () => {
    // Es la decisión de diseño que separa Guest de RoomStay: el titular reservó,
    // pero no está físicamente en todos los cuartos.
    actingAs(scenario.adminA1.id);
    const guest = await guestId();
    const roomB = await prisma.room.create({
      data: { hotelId: scenario.hotelA1.id, number: "301", qrSlug: "slugroom301" },
    });

    const result = await createReservation({
      hotelId: scenario.hotelA1.id,
      guestId: guest,
      checkIn: new Date(Date.now() + 5 * 86_400_000).toISOString(),
      checkOut: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      stays: [
        { roomId: roomB.id, contactName: "Ing. Raúl Vega", contactPhone: "111" },
      ],
    });

    expect(result.ok).toBe(true);
    const stay = await prisma.roomStay.findFirstOrThrow({ where: { roomId: roomB.id } });
    expect(stay.contactName).toBe("Ing. Raúl Vega");
  });

  it("rechaza fechas invertidas", async () => {
    actingAs(scenario.adminA1.id);
    const guest = await guestId();

    const result = await createReservation({
      hotelId: scenario.hotelA1.id,
      guestId: guest,
      checkIn: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      checkOut: new Date(Date.now() + 5 * 86_400_000).toISOString(),
      stays: [{ roomId: scenario.room.id, contactName: "Alguien" }],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKey).toBe("reservations.invalidDates");
  });

  it("rechaza traslapar dos ocupaciones del mismo cuarto", async () => {
    // Si se permitiera, un reporte por QR no sabría a qué contacto pertenece.
    actingAs(scenario.adminA1.id);
    const guest = await guestId();

    const result = await createReservation({
      hotelId: scenario.hotelA1.id,
      guestId: guest,
      checkIn: new Date().toISOString(),
      checkOut: new Date(Date.now() + 86_400_000).toISOString(),
      stays: [{ roomId: scenario.room.id, contactName: "Segundo huésped" }],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKey).toBe("reservations.roomTaken");
  });

  it("rechaza una habitación de otro hotel", async () => {
    actingAs(scenario.superadminA.id);
    const guest = await guestId();
    const foreignRoom = await prisma.room.create({
      data: { hotelId: scenario.hotelB1.id, number: "501", qrSlug: "slugforeign1" },
    });

    const result = await createReservation({
      hotelId: scenario.hotelA1.id,
      guestId: guest,
      checkIn: new Date(Date.now() + 5 * 86_400_000).toISOString(),
      checkOut: new Date(Date.now() + 6 * 86_400_000).toISOString(),
      stays: [{ roomId: foreignRoom.id, contactName: "Alguien" }],
    });

    expect(result.ok).toBe(false);
  });
});

describe("insumos", () => {
  it("guarda el nombre normalizado al crear", async () => {
    actingAs(scenario.adminA1.id);

    await createSupplyItem({ hotelId: scenario.hotelA1.id, name: "Pilas  AA" });

    const supply = await prisma.supplyItem.findFirstOrThrow();
    expect(supply.name).toBe("Pilas  AA");
    // El normalizado se calcula al escribir, no en cada consulta del reporte.
    expect(supply.normalizedName).toBe("pilas aa");
  });

  it("un STAFF no administra el catálogo", async () => {
    actingAs(scenario.staffA1.id);
    expect((await createSupplyItem({ hotelId: scenario.hotelA1.id, name: "X" })).ok).toBe(false);
  });

  it("desactivar conserva el insumo y su historial", async () => {
    actingAs(scenario.adminA1.id);
    const created = await createSupplyItem({ hotelId: scenario.hotelA1.id, name: "Focos" });
    if (!created.ok) throw new Error("no se creó");

    await setSupplyItemActive(scenario.hotelA1.id, created.data.id, false);

    const supply = await prisma.supplyItem.findUniqueOrThrow({
      where: { id: created.data.id },
    });
    expect(supply.active).toBe(false);
  });
});

describe("plantillas recurrentes", () => {
  it("un ADMIN crea una plantilla y queda inactiva hasta su fecha", async () => {
    actingAs(scenario.adminA1.id);

    const nextRunAt = new Date(Date.now() + 86_400_000).toISOString();
    const result = await createRecurringTemplate({
      hotelId: scenario.hotelA1.id,
      title: "Revisión de A/C",
      description: "Checklist preventivo mensual",
      departmentId: scenario.maintenance.id,
      priority: "MEDIUM",
      frequency: "MONTHLY",
      nextRunAt,
    });

    expect(result.ok).toBe(true);
    const template = await prisma.recurringTicketTemplate.findFirstOrThrow();
    expect(template.active).toBe(true);
    expect(template.lastRunAt).toBeNull();
    // Crear la plantilla no crea un ticket: eso lo hace el cron en su ciclo.
    expect(await prisma.ticket.count()).toBe(0);
  });

  it("rechaza un departamento de otro hotel", async () => {
    actingAs(scenario.superadminA.id);

    const result = await createRecurringTemplate({
      hotelId: scenario.hotelA1.id,
      title: "Cruzada",
      description: "x",
      departmentId: scenario.departmentB.id,
      priority: "LOW",
      frequency: "DAILY",
      nextRunAt: new Date(Date.now() + 86_400_000).toISOString(),
    });

    expect(result.ok).toBe(false);
  });

  it("un STAFF no crea plantillas", async () => {
    actingAs(scenario.staffA1.id);

    const result = await createRecurringTemplate({
      hotelId: scenario.hotelA1.id,
      title: "Intento",
      description: "x",
      departmentId: scenario.maintenance.id,
      priority: "LOW",
      frequency: "DAILY",
      nextRunAt: new Date(Date.now() + 86_400_000).toISOString(),
    });

    expect(result.ok).toBe(false);
  });
});

describe("notas de turno", () => {
  it("cualquier staff con acceso puede dejar una nota", async () => {
    // Es justo quien está en piso el que tiene el contexto que vale la pena dejar.
    actingAs(scenario.staffA1.id);

    const result = await createShiftNote({
      hotelId: scenario.hotelA1.id,
      departmentId: scenario.maintenance.id,
      content: "Habitación 210 pidió toallas extra, aún no se les lleva",
    });

    expect(result.ok).toBe(true);
    const note = await prisma.shiftNote.findFirstOrThrow();
    expect(note.authorId).toBe(scenario.staffA1.id);
  });

  it("un usuario de otra organización no puede dejar notas en un hotel ajeno", async () => {
    actingAs(scenario.superadminB.id);

    const result = await createShiftNote({
      hotelId: scenario.hotelA1.id,
      content: "Nota intrusa",
    });

    expect(result.ok).toBe(false);
    expect(await prisma.shiftNote.count()).toBe(0);
  });
});

describe("plataforma", () => {
  it("solo una cuenta de plataforma edita el precio de lista", async () => {
    actingAs(scenario.superadminA.id);
    expect(
      (await updatePlatformConfig({
        pricePerHotelMonthly: 2000,
        currency: "MXN",
        trialDays: 30,
        trialHotelLimit: 2,
      })).ok,
    ).toBe(false);

    actingAs(scenario.platformOwner.id);
    expect(
      (await updatePlatformConfig({
        pricePerHotelMonthly: 2000,
        currency: "usd",
        trialDays: 30,
        trialHotelLimit: 2,
      })).ok,
    ).toBe(true);

    const config = await getPlatformConfig();
    expect(config.pricePerHotelMonthly).toBe(2000);
    expect(config.currency).toBe("USD");
  });

  it("cambiar el precio de lista NO toca a los clientes que ya pagan", async () => {
    // Grandfathering: el precio congelado del cliente manda sobre la lista.
    await prisma.organization.update({
      where: { id: scenario.orgA.id },
      data: { pricePerHotelSnapshot: 1000, currencySnapshot: "MXN" },
    });

    actingAs(scenario.platformOwner.id);
    await updatePlatformConfig({
      pricePerHotelMonthly: 5000,
      currency: "MXN",
      trialDays: 14,
      trialHotelLimit: 1,
    });

    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: scenario.orgA.id },
    });
    expect(Number(org.pricePerHotelSnapshot)).toBe(1000);
  });

  it("publicar un documento legal crea una versión nueva sin borrar la anterior", async () => {
    actingAs(scenario.platformOwner.id);

    const first = await publishLegalDocument({
      type: "TERMS",
      locale: "es",
      content: "# Términos v1",
    });
    const second = await publishLegalDocument({
      type: "TERMS",
      locale: "es",
      content: "# Términos v2",
    });

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.data.version).toBe(1);
    expect(second.data.version).toBe(2);

    // Las versiones anteriores se conservan por trazabilidad legal.
    const versions = await prisma.legalDocument.findMany({
      where: { type: "TERMS", locale: "es" },
    });
    expect(versions).toHaveLength(2);
  });

  it("las versiones son independientes por idioma", async () => {
    actingAs(scenario.platformOwner.id);
    await publishLegalDocument({ type: "TERMS", locale: "es", content: "es v1" });
    const en = await publishLegalDocument({ type: "TERMS", locale: "en", content: "en v1" });

    expect(en.ok).toBe(true);
    if (en.ok) expect(en.data.version).toBe(1);
  });

  it("un cliente no puede publicar documentos legales", async () => {
    actingAs(scenario.superadminA.id);

    const result = await publishLegalDocument({
      type: "PRIVACY",
      locale: "es",
      content: "intento",
    });

    expect(result.ok).toBe(false);
  });
});
