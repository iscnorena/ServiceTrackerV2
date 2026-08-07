import { beforeEach, describe, expect, it } from "vitest";
import { testHeaders } from "../setup";
import { createScenario, resetDatabase, type Scenario } from "../helpers/db";
import { prisma } from "@/lib/prisma";
import { submitGuestReport } from "@/lib/actions/guest-report";

/// La ruta pública del QR es la única superficie sin autenticación del sistema.
/// Estos tests cubren lo que la protege: validación del slug, ocupación real,
/// estado de la propiedad y límite por origen.

let scenario: Scenario;

beforeEach(async () => {
  await resetDatabase();
  scenario = await createScenario();
  testHeaders.set("x-forwarded-for", "203.0.113.10");
});

function report(overrides: Partial<Parameters<typeof submitGuestReport>[0]> = {}) {
  return submitGuestReport({
    qrSlug: scenario.room.qrSlug,
    category: "BROKEN",
    description: "El aire acondicionado no enfría nada",
    ...overrides,
  });
}

describe("submitGuestReport", () => {
  it("crea el ticket con la ocupación y el contacto correctos, sin que el huésped los indique", async () => {
    const result = await report();
    expect(result.ok).toBe(true);

    const ticket = await prisma.ticket.findFirstOrThrow({
      include: { roomStay: { include: { room: true } }, department: true },
    });

    expect(ticket.source).toBe("GUEST");
    expect(ticket.guestCategory).toBe("BROKEN");
    expect(ticket.priority).toBe("MEDIUM");
    // El contacto sale del QR escaneado, no de lo que escriba el huésped.
    expect(ticket.roomStay?.room.id).toBe(scenario.room.id);
    expect(ticket.roomStay?.contactName).toBe("Contacto 101");
    // Entra a Recepción para triage; el staff lo reclasifica si aplica.
    expect(ticket.department.name).toBe("Recepción");
  });

  it("adjunta el nombre del huésped a la descripción cuando lo deja", async () => {
    await report({ contactName: "Ana Torres" });
    const ticket = await prisma.ticket.findFirstOrThrow();
    expect(ticket.description).toContain("Ana Torres");
  });

  it("rechaza un slug inexistente sin revelar nada", async () => {
    const result = await report({ qrSlug: "noexistexx" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKey).toBe("qr.invalidRoom");
    expect(await prisma.ticket.count()).toBe(0);
  });

  it("rechaza si la habitación no está ocupada según el sistema", async () => {
    await prisma.roomStay.deleteMany({ where: { roomId: scenario.room.id } });

    const result = await report();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKey).toBe("qr.roomNotOccupied");
  });

  it("deja de recibir si la propiedad quedó suspendida", async () => {
    // El QR sigue pegado en la pared después de suspender el hotel.
    await prisma.hotel.update({
      where: { id: scenario.hotelA1.id },
      data: { billingStatus: "SUSPENDED" },
    });

    const result = await report();
    expect(result.ok).toBe(false);
    expect(await prisma.ticket.count()).toBe(0);
  });

  it("deja de recibir si la suscripción del cliente no está vigente", async () => {
    await prisma.organization.update({
      where: { id: scenario.orgA.id },
      data: { subscriptionStatus: "EXPIRED" },
    });

    const result = await report();
    expect(result.ok).toBe(false);
  });

  it("limita a 5 reportes por minuto desde el mismo origen", async () => {
    const results = [];
    for (let i = 0; i < 7; i++) results.push(await report());

    expect(results.slice(0, 5).every((r) => r.ok)).toBe(true);
    expect(results[5].ok).toBe(false);
    expect(results[6].ok).toBe(false);
    if (!results[5].ok) expect(results[5].errorKey).toBe("qr.rateLimited");

    expect(await prisma.ticket.count()).toBe(5);
  });

  it("el límite es por origen: otra IP no queda bloqueada", async () => {
    for (let i = 0; i < 6; i++) await report();

    testHeaders.set("x-forwarded-for", "198.51.100.20");
    const other = await report();
    expect(other.ok).toBe(true);
  });

  it("guarda el hash de la IP, nunca la IP en claro", async () => {
    await report();
    const attempt = await prisma.guestReportAttempt.findFirstOrThrow();
    expect(attempt.ipHash).not.toContain("203.0.113.10");
    expect(attempt.ipHash).toHaveLength(64);
  });

  it("rechaza una descripción demasiado corta para ser útil", async () => {
    const result = await report({ description: "no" });
    expect(result.ok).toBe(false);
  });
});
