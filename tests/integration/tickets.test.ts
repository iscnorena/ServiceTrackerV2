import { beforeEach, describe, expect, it } from "vitest";
import { testSession } from "../setup";
import { createScenario, resetDatabase, type Scenario } from "../helpers/db";
import { prisma } from "@/lib/prisma";
import {
  addTicketComment,
  createTicket,
  deleteTicket,
  updateTicket,
} from "@/lib/actions/tickets";

/// Server Actions de tickets contra base de datos real. Lo que se comprueba aquí
/// no es que "funcione el CRUD", sino que las reglas de permiso y de aislamiento
/// se apliquen en el servidor y no dependan de ocultar botones en la UI.

let scenario: Scenario;

beforeEach(async () => {
  await resetDatabase();
  scenario = await createScenario();
});

function actingAs(userId: string) {
  testSession.userId = userId;
}

describe("createTicket", () => {
  it("un ADMIN crea un ticket con el SLA calculado desde su departamento", async () => {
    actingAs(scenario.adminA1.id);

    const result = await createTicket({
      hotelId: scenario.hotelA1.id,
      title: "Aire no enfría",
      description: "El huésped reporta que no baja la temperatura",
      departmentId: scenario.maintenance.id,
      priority: "MEDIUM",
      roomStayId: scenario.roomStay.id,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const ticket = await prisma.ticket.findUniqueOrThrow({
      where: { id: result.data.id },
      include: { activities: true },
    });

    // Mantenimiento tiene 30 min de SLA base y MEDIUM multiplica por 2.
    const expected = ticket.createdAt.getTime() + 60 * 60_000;
    expect(ticket.slaDueAt?.getTime()).toBeCloseTo(expected, -3);
    expect(ticket.hotelId).toBe(scenario.hotelA1.id);
    // La actividad se genera automáticamente, no la llena el usuario.
    expect(ticket.activities.map((a) => a.action)).toEqual(["CREATED"]);
  });

  it("pone la habitación en mantenimiento si el departamento lo afecta", async () => {
    actingAs(scenario.adminA1.id);

    await createTicket({
      hotelId: scenario.hotelA1.id,
      title: "Fuga en regadera",
      description: "Gotea constante",
      departmentId: scenario.maintenance.id,
      priority: "HIGH",
      roomStayId: scenario.roomStay.id,
    });

    const room = await prisma.room.findUniqueOrThrow({
      where: { id: scenario.room.id },
    });
    expect(room.status).toBe("MAINTENANCE");
  });

  it("rechaza un departamento de OTRO hotel aunque el id sea válido", async () => {
    actingAs(scenario.superadminA.id);

    const result = await createTicket({
      hotelId: scenario.hotelA1.id,
      title: "Intento cruzado",
      description: "Departamento de otra organización",
      departmentId: scenario.departmentB.id,
      priority: "LOW",
    });

    expect(result.ok).toBe(false);
  });

  it("un usuario de otra organización no puede crear en un hotel ajeno", async () => {
    // El caso más grave del sistema: fuga entre clientes distintos.
    actingAs(scenario.superadminB.id);

    const result = await createTicket({
      hotelId: scenario.hotelA1.id,
      title: "Intento de otra organización",
      description: "No debería existir",
      departmentId: scenario.maintenance.id,
      priority: "LOW",
    });

    expect(result.ok).toBe(false);
    expect(await prisma.ticket.count()).toBe(0);
  });

  it("no permite asignar a alguien sin acceso a ese hotel", async () => {
    actingAs(scenario.adminA1.id);

    const result = await createTicket({
      hotelId: scenario.hotelA1.id,
      title: "Asignación inválida",
      description: "A un usuario de otra organización",
      departmentId: scenario.maintenance.id,
      priority: "LOW",
      assignedToId: scenario.superadminB.id,
    });

    expect(result.ok).toBe(false);
  });
});

describe("updateTicket", () => {
  async function seedTicket(departmentId: string, assignedToId?: string) {
    actingAs(scenario.adminA1.id);
    const result = await createTicket({
      hotelId: scenario.hotelA1.id,
      title: "Ticket base",
      description: "Para pruebas de actualización",
      departmentId,
      priority: "MEDIUM",
      roomStayId: scenario.roomStay.id,
      assignedToId,
    });
    if (!result.ok) throw new Error("no se pudo crear el ticket base");
    return result.data.id;
  }

  it("sella resolvedAt al resolver y lo limpia al reabrir", async () => {
    const ticketId = await seedTicket(scenario.maintenance.id);
    actingAs(scenario.adminA1.id);

    await updateTicket({ ticketId, hotelId: scenario.hotelA1.id, status: "RESOLVED" });
    let ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
    expect(ticket.resolvedAt).not.toBeNull();

    await updateTicket({ ticketId, hotelId: scenario.hotelA1.id, status: "PENDING" });
    ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
    expect(ticket.resolvedAt).toBeNull();
  });

  it("devuelve la habitación a OCUPADA solo cuando TODOS los tickets cierran", async () => {
    const first = await seedTicket(scenario.maintenance.id);
    const second = await seedTicket(scenario.maintenance.id);
    actingAs(scenario.adminA1.id);

    await updateTicket({
      ticketId: first,
      hotelId: scenario.hotelA1.id,
      status: "RESOLVED",
    });

    let room = await prisma.room.findUniqueOrThrow({ where: { id: scenario.room.id } });
    expect(room.status).toBe("MAINTENANCE");

    await updateTicket({
      ticketId: second,
      hotelId: scenario.hotelA1.id,
      status: "RESOLVED",
    });

    room = await prisma.room.findUniqueOrThrow({ where: { id: scenario.room.id } });
    // Vuelve a OCCUPIED y no a AVAILABLE porque la estancia sigue vigente.
    expect(room.status).toBe("OCCUPIED");
  });

  it("recalcula el SLA al cambiar la prioridad", async () => {
    const ticketId = await seedTicket(scenario.maintenance.id);
    actingAs(scenario.adminA1.id);

    const before = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });

    await updateTicket({ ticketId, hotelId: scenario.hotelA1.id, priority: "HIGH" });
    const after = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });

    expect(after.slaDueAt!.getTime()).toBeLessThan(before.slaDueAt!.getTime());
  });

  it("un STAFF puede mover un ticket de su departamento", async () => {
    const ticketId = await seedTicket(scenario.maintenance.id);
    actingAs(scenario.staffA1.id);

    const result = await updateTicket({
      ticketId,
      hotelId: scenario.hotelA1.id,
      status: "IN_PROGRESS",
    });

    expect(result.ok).toBe(true);
  });

  it("un STAFF NO puede tocar un ticket de otro departamento", async () => {
    const ticketId = await seedTicket(scenario.reception.id);
    actingAs(scenario.staffA1.id);

    const result = await updateTicket({
      ticketId,
      hotelId: scenario.hotelA1.id,
      status: "RESOLVED",
    });

    expect(result.ok).toBe(false);
  });

  it("un STAFF NO puede reasignar ni cambiar de departamento", async () => {
    const ticketId = await seedTicket(scenario.maintenance.id);
    actingAs(scenario.staffA1.id);

    const reassign = await updateTicket({
      ticketId,
      hotelId: scenario.hotelA1.id,
      assignedToId: scenario.adminA1.id,
    });
    expect(reassign.ok).toBe(false);

    const moveDepartment = await updateTicket({
      ticketId,
      hotelId: scenario.hotelA1.id,
      departmentId: scenario.reception.id,
    });
    expect(moveDepartment.ok).toBe(false);
  });
});

describe("deleteTicket", () => {
  async function seedTicket() {
    actingAs(scenario.adminA1.id);
    const result = await createTicket({
      hotelId: scenario.hotelA1.id,
      title: "Ticket a eliminar",
      description: "Prueba de permisos de borrado",
      departmentId: scenario.maintenance.id,
      priority: "LOW",
    });
    if (!result.ok) throw new Error("no se pudo crear el ticket");
    return result.data.id;
  }

  it("un SUPERADMIN siempre puede, y es borrado lógico", async () => {
    const ticketId = await seedTicket();
    actingAs(scenario.superadminA.id);

    const result = await deleteTicket(scenario.hotelA1.id, ticketId);
    expect(result.ok).toBe(true);

    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
    // El registro sigue existiendo, con rastro de quién y cuándo.
    expect(ticket.deletedAt).not.toBeNull();
    expect(ticket.deletedById).toBe(scenario.superadminA.id);

    const activities = await prisma.ticketActivity.findMany({ where: { ticketId } });
    expect(activities.some((a) => a.action === "DELETED")).toBe(true);
  });

  it("un STAFF nunca puede, ni con el flag activado", async () => {
    const ticketId = await seedTicket();
    await prisma.userHotelAccess.updateMany({
      where: { userId: scenario.staffA1.id },
      data: { canDeleteTickets: true },
    });
    actingAs(scenario.staffA1.id);

    const result = await deleteTicket(scenario.hotelA1.id, ticketId);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKey).toBe("errors.cannotDeleteTickets");
  });

  it("un ADMIN no puede por defecto, y sí cuando se le otorga", async () => {
    const ticketId = await seedTicket();
    actingAs(scenario.adminA1.id);

    const denied = await deleteTicket(scenario.hotelA1.id, ticketId);
    expect(denied.ok).toBe(false);

    await prisma.userHotelAccess.updateMany({
      where: { userId: scenario.adminA1.id, hotelId: scenario.hotelA1.id },
      data: { canDeleteTickets: true },
    });

    const allowed = await deleteTicket(scenario.hotelA1.id, ticketId);
    expect(allowed.ok).toBe(true);
  });

  it("un CORPORATE_ADMIN depende de su propio flag", async () => {
    const ticketId = await seedTicket();
    actingAs(scenario.corporateA.id);

    expect((await deleteTicket(scenario.hotelA1.id, ticketId)).ok).toBe(false);

    await prisma.user.update({
      where: { id: scenario.corporateA.id },
      data: { canDeleteTickets: true },
    });

    expect((await deleteTicket(scenario.hotelA1.id, ticketId)).ok).toBe(true);
  });

  it("un ticket ya eliminado no se puede volver a tocar", async () => {
    const ticketId = await seedTicket();
    actingAs(scenario.superadminA.id);
    await deleteTicket(scenario.hotelA1.id, ticketId);

    const again = await deleteTicket(scenario.hotelA1.id, ticketId);
    expect(again.ok).toBe(false);

    const comment = await addTicketComment(scenario.hotelA1.id, ticketId, "Hola");
    expect(comment.ok).toBe(false);
  });
});
