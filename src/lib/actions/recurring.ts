"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireHotelContext } from "@/lib/hotel-scope";
import { canManageHotel } from "@/lib/auth/can";
import { actionError, actionOk, toActionError, UnauthorizedError, type ActionResult } from "@/lib/errors";

const schema = z.object({
  hotelId: z.string().min(1),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(1).max(2000),
  departmentId: z.string().min(1),
  roomId: z.string().min(1).nullable().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
  nextRunAt: z.string().min(1),
});

/// Plantilla de mantenimiento preventivo. No crea un ticket ahora: define cuándo
/// y con qué frecuencia el cron diario debe materializarlo.
export async function createRecurringTemplate(
  input: z.infer<typeof schema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = schema.safeParse(input);
    if (!parsed.success) return actionError("errors.validation");

    const ctx = await requireHotelContext(parsed.data.hotelId);
    if (!canManageHotel(ctx.user, ctx.hotelId)) throw new UnauthorizedError();

    const nextRunAt = new Date(parsed.data.nextRunAt);
    if (Number.isNaN(nextRunAt.getTime())) return actionError("errors.validation");

    // Departamento y habitación deben ser de ESTE hotel.
    const department = await prisma.department.findFirst({
      where: { id: parsed.data.departmentId, hotelId: ctx.hotelId, active: true },
      select: { id: true },
    });
    if (!department) return actionError("errors.notFound");

    if (parsed.data.roomId) {
      const room = await prisma.room.findFirst({
        where: { id: parsed.data.roomId, hotelId: ctx.hotelId },
        select: { id: true },
      });
      if (!room) return actionError("errors.notFound");
    }

    const template = await prisma.recurringTicketTemplate.create({
      data: {
        hotelId: ctx.hotelId,
        title: parsed.data.title,
        description: parsed.data.description,
        departmentId: department.id,
        roomId: parsed.data.roomId ?? null,
        priority: parsed.data.priority,
        frequency: parsed.data.frequency,
        nextRunAt,
        createdById: ctx.user.id,
      },
      select: { id: true },
    });

    revalidatePath(`/${ctx.hotelId}/admin/recurrentes`);
    return actionOk(template);
  } catch (error) {
    return toActionError(error);
  }
}

export async function setRecurringTemplateActive(
  hotelId: string,
  templateId: string,
  active: boolean,
): Promise<ActionResult<void>> {
  try {
    const ctx = await requireHotelContext(hotelId);
    if (!canManageHotel(ctx.user, ctx.hotelId)) throw new UnauthorizedError();

    const template = await prisma.recurringTicketTemplate.findFirst({
      where: { id: templateId, hotelId: ctx.hotelId },
      select: { id: true },
    });
    if (!template) return actionError("errors.notFound");

    await prisma.recurringTicketTemplate.update({
      where: { id: template.id },
      data: { active },
    });

    revalidatePath(`/${ctx.hotelId}/admin/recurrentes`);
    return actionOk();
  } catch (error) {
    return toActionError(error);
  }
}
