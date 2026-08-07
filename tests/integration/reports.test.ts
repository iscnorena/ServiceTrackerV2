import { beforeEach, describe, expect, it } from "vitest";
import { testSession } from "../setup";
import { createScenario, resetDatabase, type Scenario } from "../helpers/db";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { getRecurringSupplyReport } from "@/lib/queries/supply-report";
import { getDepartmentMetrics, getHotelMetrics } from "@/lib/queries/metrics";
import { listTickets, countOverdueTickets } from "@/lib/queries/tickets";
import { requireHotelContext } from "@/lib/hotel-scope";
import { normalizeSupplyName } from "@/lib/normalize";

let scenario: Scenario;

beforeEach(async () => {
  await resetDatabase();
  scenario = await createScenario();
});

async function currentUser(userId: string) {
  testSession.userId = userId;
  const user = await getCurrentUser();
  if (!user) throw new Error("sin sesión");
  return user;
}

/// Crea un insumo en un hotel y lo consume en un ticket resuelto.
async function useSupply(hotelId: string, name: string, quantity: number) {
  const department = await prisma.department.findFirstOrThrow({ where: { hotelId } });

  const supply = await prisma.supplyItem.create({
    data: { hotelId, name, normalizedName: normalizeSupplyName(name) },
  });

  const ticket = await prisma.ticket.create({
    data: {
      hotelId,
      title: `Uso de ${name}`,
      description: "Generado para el reporte",
      departmentId: department.id,
      status: "RESOLVED",
      resolvedAt: new Date(),
    },
  });

  await prisma.ticketSupplyUsage.create({
    data: { ticketId: ticket.id, supplyItemId: supply.id, quantity },
  });
}

describe("reporte de insumos recurrentes", () => {
  // Se calcula dentro de cada test: si se evaluara al cargar el archivo, el
  // `to` quedaría antes de que los tests creen sus datos y el rango los excluiría.
  const range = () => ({
    from: new Date(Date.now() - 86_400_000),
    to: new Date(Date.now() + 86_400_000),
  });

  it("agrupa variantes de captura entre hoteles y suma sus cantidades", async () => {
    await useSupply(scenario.hotelA1.id, "Pilas AA", 5);
    await useSupply(scenario.hotelA2.id, "PILAS  aa", 3);

    const user = await currentUser(scenario.corporateA.id);
    const report = await getRecurringSupplyReport(user, range());

    expect(report.rows).toHaveLength(1);
    expect(report.rows[0].totalQuantity).toBe(8);
    expect(report.rows[0].hotelCount).toBe(2);
  });

  it("conserva el nombre exacto que capturó cada hotel", async () => {
    // Es lo que permite verificar a ojo que de verdad es el mismo insumo.
    await useSupply(scenario.hotelA1.id, "Pilas AA", 5);
    await useSupply(scenario.hotelA2.id, "PILAS  aa", 3);

    const user = await currentUser(scenario.corporateA.id);
    const report = await getRecurringSupplyReport(user, range());

    const captured = report.rows[0].breakdown.map((entry) => entry.capturedName);
    expect(captured).toContain("Pilas AA");
    expect(captured).toContain("PILAS  aa");
  });

  it("NO agrupa sinónimos distintos, y quedan como filas separadas", async () => {
    await useSupply(scenario.hotelA1.id, "Toallas de baño", 4);
    await useSupply(scenario.hotelA2.id, "Toallas grandes", 2);

    const user = await currentUser(scenario.corporateA.id);
    const report = await getRecurringSupplyReport(user, range());

    expect(report.rows).toHaveLength(2);
  });

  it("nunca cruza insumos de otra organización", async () => {
    await useSupply(scenario.hotelA1.id, "Pilas AA", 5);
    await useSupply(scenario.hotelB1.id, "Pilas AA", 99);

    const user = await currentUser(scenario.corporateA.id);
    const report = await getRecurringSupplyReport(user, range());

    // Los 99 del otro cliente no deben aparecer por ningún lado.
    expect(report.rows[0].totalQuantity).toBe(5);
    expect(report.rows[0].hotelCount).toBe(1);
  });

  it("respeta el subconjunto de hoteles pedido", async () => {
    await useSupply(scenario.hotelA1.id, "Pilas AA", 5);
    await useSupply(scenario.hotelA2.id, "Pilas AA", 3);

    const user = await currentUser(scenario.corporateA.id);
    const report = await getRecurringSupplyReport(user, {
      ...range(),
      hotelIds: [scenario.hotelA1.id],
    });

    expect(report.rows[0].totalQuantity).toBe(5);
  });

  it("ignora un hotel al que el usuario no tiene acceso aunque lo pida", async () => {
    await useSupply(scenario.hotelB1.id, "Pilas AA", 99);

    const user = await currentUser(scenario.corporateA.id);
    const report = await getRecurringSupplyReport(user, {
      ...range(),
      hotelIds: [scenario.hotelB1.id],
    });

    expect(report.rows).toHaveLength(0);
  });

  it("filtra por repeticiones mínimas", async () => {
    await useSupply(scenario.hotelA1.id, "Pilas AA", 5);
    await useSupply(scenario.hotelA2.id, "Pilas AA", 3);
    await useSupply(scenario.hotelA1.id, "Foco baño", 1);

    const user = await currentUser(scenario.corporateA.id);
    const report = await getRecurringSupplyReport(user, {
      ...range(),
      minRepetitions: 2,
    });

    expect(report.rows.map((row) => row.displayName)).not.toContain("Foco baño");
  });

  it("excluye el consumo fuera del rango de fechas", async () => {
    await useSupply(scenario.hotelA1.id, "Pilas AA", 5);
    await prisma.ticketSupplyUsage.updateMany({
      data: { createdAt: new Date(Date.now() - 30 * 86_400_000) },
    });

    const user = await currentUser(scenario.corporateA.id);
    const report = await getRecurringSupplyReport(user, range());
    expect(report.rows).toHaveLength(0);
  });

  it("excluye el consumo de tickets eliminados", async () => {
    await useSupply(scenario.hotelA1.id, "Pilas AA", 5);
    await prisma.ticket.updateMany({ data: { deletedAt: new Date() } });

    const user = await currentUser(scenario.corporateA.id);
    const report = await getRecurringSupplyReport(user, range());
    expect(report.rows).toHaveLength(0);
  });
});

describe("métricas", () => {
  const from = new Date(Date.now() - 86_400_000);
  const to = new Date(Date.now() + 86_400_000);

  async function seedTicket(data: {
    status: "PENDING" | "RESOLVED";
    slaMinutesAgo?: number;
    resolutionMinutes?: number;
  }) {
    const createdAt = new Date(Date.now() - 120 * 60_000);
    return prisma.ticket.create({
      data: {
        hotelId: scenario.hotelA1.id,
        title: "Métrica",
        description: "x",
        departmentId: scenario.maintenance.id,
        status: data.status,
        createdAt,
        slaDueAt:
          data.slaMinutesAgo === undefined
            ? null
            : new Date(Date.now() - data.slaMinutesAgo * 60_000),
        resolvedAt:
          data.resolutionMinutes === undefined
            ? null
            : new Date(createdAt.getTime() + data.resolutionMinutes * 60_000),
      },
    });
  }

  it("cuenta vencidos solo entre los que siguen abiertos", async () => {
    await seedTicket({ status: "PENDING", slaMinutesAgo: 30 });
    await seedTicket({ status: "RESOLVED", slaMinutesAgo: 30, resolutionMinutes: 200 });

    const metrics = await getHotelMetrics([scenario.hotelA1.id], from, to);
    expect(metrics[0].overdue).toBe(1);
  });

  it("mide el cumplimiento de SLA solo sobre tickets que lo tenían y ya cerraron", async () => {
    // Uno cumplió, uno no, y uno sin SLA que no debe contar en el porcentaje.
    await seedTicket({ status: "RESOLVED", slaMinutesAgo: -60, resolutionMinutes: 30 });
    await seedTicket({ status: "RESOLVED", slaMinutesAgo: 60, resolutionMinutes: 200 });
    await seedTicket({ status: "RESOLVED", resolutionMinutes: 10 });

    const metrics = await getHotelMetrics([scenario.hotelA1.id], from, to);
    expect(metrics[0].slaCompliance).toBe(50);
  });

  it("devuelve null cuando no hay nada que medir", async () => {
    const metrics = await getHotelMetrics([scenario.hotelA1.id], from, to);
    expect(metrics[0].slaCompliance).toBeNull();
    expect(metrics[0].avgResolutionMinutes).toBeNull();
  });

  it("promedia el tiempo de resolución", async () => {
    await seedTicket({ status: "RESOLVED", resolutionMinutes: 30 });
    await seedTicket({ status: "RESOLVED", resolutionMinutes: 90 });

    const metrics = await getHotelMetrics([scenario.hotelA1.id], from, to);
    expect(metrics[0].avgResolutionMinutes).toBe(60);
  });

  it("agrupa por departamento", async () => {
    await seedTicket({ status: "PENDING" });
    await seedTicket({ status: "PENDING", slaMinutesAgo: 10 });

    const byDepartment = await getDepartmentMetrics([scenario.hotelA1.id], from, to);
    expect(byDepartment[0].departmentName).toBe("Mantenimiento");
    expect(byDepartment[0].total).toBe(2);
    expect(byDepartment[0].overdue).toBe(1);
  });
});

describe("visibilidad de listados", () => {
  it("un STAFF solo ve su departamento y lo que tiene asignado", async () => {
    await prisma.ticket.create({
      data: {
        hotelId: scenario.hotelA1.id,
        title: "De su departamento",
        description: "x",
        departmentId: scenario.maintenance.id,
      },
    });
    await prisma.ticket.create({
      data: {
        hotelId: scenario.hotelA1.id,
        title: "De otro departamento, sin asignar",
        description: "x",
        departmentId: scenario.reception.id,
      },
    });
    await prisma.ticket.create({
      data: {
        hotelId: scenario.hotelA1.id,
        title: "De otro departamento, asignado a él",
        description: "x",
        departmentId: scenario.reception.id,
        assignedToId: scenario.staffA1.id,
      },
    });

    testSession.userId = scenario.staffA1.id;
    const staffCtx = await requireHotelContext(scenario.hotelA1.id);
    const staffTickets = await listTickets(staffCtx);
    expect(staffTickets.map((t) => t.title).sort()).toEqual([
      "De otro departamento, asignado a él",
      "De su departamento",
    ]);

    testSession.userId = scenario.adminA1.id;
    const adminCtx = await requireHotelContext(scenario.hotelA1.id);
    expect(await listTickets(adminCtx)).toHaveLength(3);
  });

  it("los listados excluyen los tickets eliminados", async () => {
    await prisma.ticket.create({
      data: {
        hotelId: scenario.hotelA1.id,
        title: "Eliminado",
        description: "x",
        departmentId: scenario.maintenance.id,
        deletedAt: new Date(),
      },
    });

    testSession.userId = scenario.adminA1.id;
    const ctx = await requireHotelContext(scenario.hotelA1.id);
    expect(await listTickets(ctx)).toHaveLength(0);
    expect(await countOverdueTickets(ctx)).toBe(0);
  });
});
