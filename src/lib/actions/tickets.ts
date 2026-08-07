"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireHotelContext, notDeleted } from "@/lib/hotel-scope";
import { canDeleteTicket, isRestrictedToOwnDepartment } from "@/lib/auth/can";
import { calculateSlaDueAt } from "@/lib/sla";
import { syncRoomStatus } from "@/lib/room-status";
import { actionError, actionOk, toActionError, UnauthorizedError, NotFoundError, type ActionResult } from "@/lib/errors";
import type { TicketStatus } from "@/generated/prisma/enums";

const createSchema = z.object({
  hotelId: z.string().min(1),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(1).max(4000),
  departmentId: z.string().min(1),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  roomStayId: z.string().min(1).optional().nullable(),
  assignedToId: z.string().min(1).optional().nullable(),
});

export async function createTicket(
  input: z.infer<typeof createSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) return actionError("errors.validation");

    const ctx = await requireHotelContext(parsed.data.hotelId);

    // El departamento y la ocupación deben ser de ESTE hotel: si no se valida,
    // un id copiado de otra propiedad crearía un ticket cruzado.
    const department = await prisma.department.findFirst({
      where: { id: parsed.data.departmentId, hotelId: ctx.hotelId, active: true },
      select: { id: true, defaultSlaMinutes: true, affectsRoomStatus: true },
    });
    if (!department) return actionError("errors.notFound");

    const roomStayId = await validateRoomStay(ctx.hotelId, parsed.data.roomStayId);
    const assignedToId = await validateAssignee(ctx.hotelId, parsed.data.assignedToId);

    const ticket = await prisma.$transaction(async (tx) => {
      const created = await tx.ticket.create({
        data: {
          hotelId: ctx.hotelId,
          title: parsed.data.title,
          description: parsed.data.description,
          departmentId: department.id,
          priority: parsed.data.priority,
          roomStayId,
          assignedToId,
          createdById: ctx.user.id,
          source: "STAFF",
          slaDueAt: calculateSlaDueAt(department.defaultSlaMinutes, parsed.data.priority),
        },
        select: { id: true, roomStayId: true },
      });

      await tx.ticketActivity.create({
        data: { ticketId: created.id, userId: ctx.user.id, action: "CREATED" },
      });

      return created;
    });

    if (department.affectsRoomStatus && ticket.roomStayId) {
      await syncRoomStatus(ticket.roomStayId);
    }

    revalidatePath(`/${ctx.hotelId}/tickets`);
    return actionOk({ id: ticket.id });
  } catch (error) {
    return toActionError(error);
  }
}

const updateSchema = z.object({
  ticketId: z.string().min(1),
  hotelId: z.string().min(1),
  title: z.string().trim().min(3).max(160).optional(),
  description: z.string().trim().min(1).max(4000).optional(),
  departmentId: z.string().min(1).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  status: z.enum(["PENDING", "IN_PROGRESS", "RESOLVED", "CANCELLED"]).optional(),
  assignedToId: z.string().min(1).nullable().optional(),
});

export async function updateTicket(
  input: z.infer<typeof updateSchema>,
): Promise<ActionResult<void>> {
  try {
    const parsed = updateSchema.safeParse(input);
    if (!parsed.success) return actionError("errors.validation");

    const ctx = await requireHotelContext(parsed.data.hotelId);

    const ticket = await prisma.ticket.findFirst({
      where: { id: parsed.data.ticketId, hotelId: ctx.hotelId, ...notDeleted },
      select: {
        id: true,
        status: true,
        priority: true,
        departmentId: true,
        assignedToId: true,
        roomStayId: true,
        department: { select: { defaultSlaMinutes: true, affectsRoomStatus: true } },
      },
    });
    if (!ticket) throw new NotFoundError();

    // Un STAFF solo mueve lo suyo: tickets de su departamento o asignados a él.
    if (isRestrictedToOwnDepartment(ctx.user, ctx.hotelId)) {
      const own =
        ticket.assignedToId === ctx.user.id ||
        (ctx.access.departmentId != null &&
          ticket.departmentId === ctx.access.departmentId);
      if (!own) throw new UnauthorizedError();
      // Tampoco puede reasignar a otra persona ni mover el ticket de departamento.
      if (parsed.data.assignedToId !== undefined || parsed.data.departmentId) {
        throw new UnauthorizedError();
      }
    }

    const department = parsed.data.departmentId
      ? await prisma.department.findFirst({
          where: { id: parsed.data.departmentId, hotelId: ctx.hotelId, active: true },
          select: { id: true, defaultSlaMinutes: true, affectsRoomStatus: true },
        })
      : null;
    if (parsed.data.departmentId && !department) return actionError("errors.notFound");

    const assignedToId =
      parsed.data.assignedToId === undefined
        ? undefined
        : await validateAssignee(ctx.hotelId, parsed.data.assignedToId);

    const effectiveDepartment = department ?? ticket.department;
    const effectivePriority = parsed.data.priority ?? ticket.priority;
    const nextStatus = parsed.data.status ?? ticket.status;

    // El SLA se recalcula solo si cambió lo que lo determina (depto o prioridad),
    // para no reiniciar el reloj en cada edición menor del título.
    const slaChanged =
      (parsed.data.departmentId && parsed.data.departmentId !== ticket.departmentId) ||
      (parsed.data.priority && parsed.data.priority !== ticket.priority);

    await prisma.$transaction(async (tx) => {
      await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          title: parsed.data.title,
          description: parsed.data.description,
          departmentId: parsed.data.departmentId,
          priority: parsed.data.priority,
          status: parsed.data.status,
          assignedToId,
          resolvedAt: resolveTimestamp(ticket.status, nextStatus),
          ...(slaChanged
            ? {
                slaDueAt: calculateSlaDueAt(
                  effectiveDepartment.defaultSlaMinutes,
                  effectivePriority,
                ),
              }
            : {}),
        },
      });

      if (parsed.data.status && parsed.data.status !== ticket.status) {
        await tx.ticketActivity.create({
          data: {
            ticketId: ticket.id,
            userId: ctx.user.id,
            action: "STATUS_CHANGED",
            detail: `${ticket.status} → ${parsed.data.status}`,
          },
        });
      }

      if (assignedToId !== undefined && assignedToId !== ticket.assignedToId) {
        await tx.ticketActivity.create({
          data: { ticketId: ticket.id, userId: ctx.user.id, action: "REASSIGNED" },
        });
      }
    });

    if (ticket.roomStayId) await syncRoomStatus(ticket.roomStayId);

    revalidatePath(`/${ctx.hotelId}/tickets`);
    revalidatePath(`/${ctx.hotelId}/tickets/${ticket.id}`);
    return actionOk();
  } catch (error) {
    return toActionError(error);
  }
}

/// Soft delete: el ticket sale de los listados pero queda en la base para
/// auditoría, junto con quién y cuándo lo eliminó.
export async function deleteTicket(
  hotelId: string,
  ticketId: string,
): Promise<ActionResult<void>> {
  try {
    const ctx = await requireHotelContext(hotelId);
    if (!canDeleteTicket(ctx.user, ctx.hotelId)) {
      return actionError("errors.cannotDeleteTickets");
    }

    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, hotelId: ctx.hotelId, ...notDeleted },
      select: { id: true, roomStayId: true },
    });
    if (!ticket) throw new NotFoundError();

    await prisma.$transaction([
      prisma.ticket.update({
        where: { id: ticket.id },
        data: { deletedAt: new Date(), deletedById: ctx.user.id },
      }),
      prisma.ticketActivity.create({
        data: { ticketId: ticket.id, userId: ctx.user.id, action: "DELETED" },
      }),
    ]);

    if (ticket.roomStayId) await syncRoomStatus(ticket.roomStayId);

    revalidatePath(`/${ctx.hotelId}/tickets`);
    return actionOk();
  } catch (error) {
    return toActionError(error);
  }
}

export async function addTicketComment(
  hotelId: string,
  ticketId: string,
  message: string,
): Promise<ActionResult<void>> {
  try {
    const ctx = await requireHotelContext(hotelId);
    const parsed = z.string().trim().min(1).max(2000).safeParse(message);
    if (!parsed.success) return actionError("errors.validation");

    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, hotelId: ctx.hotelId, ...notDeleted },
      select: { id: true },
    });
    if (!ticket) throw new NotFoundError();

    await prisma.$transaction([
      prisma.ticketComment.create({
        data: { ticketId: ticket.id, userId: ctx.user.id, message: parsed.data },
      }),
      prisma.ticketActivity.create({
        data: { ticketId: ticket.id, userId: ctx.user.id, action: "COMMENTED" },
      }),
    ]);

    revalidatePath(`/${ctx.hotelId}/tickets/${ticketId}`);
    return actionOk();
  } catch (error) {
    return toActionError(error);
  }
}

/// Etiquetar el insumo que se usó al resolver. Es lo que alimenta el reporte
/// corporativo de insumos recurrentes (sección 4.5).
export async function addTicketSupplyUsage(
  hotelId: string,
  ticketId: string,
  supplyItemId: string,
  quantity: number,
): Promise<ActionResult<void>> {
  try {
    const ctx = await requireHotelContext(hotelId);
    const parsed = z.number().int().min(1).max(9999).safeParse(quantity);
    if (!parsed.success) return actionError("errors.validation");

    const [ticket, supply] = await Promise.all([
      prisma.ticket.findFirst({
        where: { id: ticketId, hotelId: ctx.hotelId, ...notDeleted },
        select: { id: true },
      }),
      prisma.supplyItem.findFirst({
        where: { id: supplyItemId, hotelId: ctx.hotelId, active: true },
        select: { id: true },
      }),
    ]);
    if (!ticket || !supply) throw new NotFoundError();

    await prisma.ticketSupplyUsage.create({
      data: { ticketId: ticket.id, supplyItemId: supply.id, quantity: parsed.data },
    });

    revalidatePath(`/${ctx.hotelId}/tickets/${ticketId}`);
    return actionOk();
  } catch (error) {
    return toActionError(error);
  }
}

// ---------------------------------------------------------------------------

/// `resolvedAt` se sella al pasar a RESOLVED y se limpia si el ticket se reabre.
function resolveTimestamp(
  previous: TicketStatus,
  next: TicketStatus,
): Date | null | undefined {
  if (previous === next) return undefined;
  if (next === "RESOLVED") return new Date();
  if (previous === "RESOLVED") return null;
  return undefined;
}

async function validateRoomStay(
  hotelId: string,
  roomStayId: string | null | undefined,
): Promise<string | null> {
  if (!roomStayId) return null;
  const stay = await prisma.roomStay.findFirst({
    where: { id: roomStayId, room: { hotelId } },
    select: { id: true },
  });
  if (!stay) throw new NotFoundError();
  return stay.id;
}

async function validateAssignee(
  hotelId: string,
  userId: string | null | undefined,
): Promise<string | null> {
  if (!userId) return null;
  // Solo se puede asignar a alguien con acceso a este hotel — por accesos
  // directos o por rol corporativo dentro de la misma organización.
  const candidate = await prisma.user.findFirst({
    where: {
      id: userId,
      status: { not: "DISABLED" },
      OR: [
        { hotelAccess: { some: { hotelId } } },
        {
          corporateRole: { not: "NONE" },
          organization: { hotels: { some: { id: hotelId } } },
        },
      ],
    },
    select: { id: true },
  });
  if (!candidate) throw new NotFoundError();
  return candidate.id;
}
