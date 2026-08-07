"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireHotelContext } from "@/lib/hotel-scope";
import { canManageHotel } from "@/lib/auth/can";
import { actionError, actionOk, toActionError, UnauthorizedError, type ActionResult } from "@/lib/errors";

const schema = z.object({
  hotelId: z.string().min(1),
  name: z.string().trim().min(2).max(60),
  defaultSlaMinutes: z.number().int().min(1).max(10080).nullable(),
  affectsRoomStatus: z.boolean(),
  active: z.boolean().optional(),
});

/// Al crear un departamento aparece de inmediato en los selectores de tickets y
/// de usuarios de ese hotel: no hay lista fija en el código que actualizar.
export async function createDepartment(
  input: z.infer<typeof schema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = schema.safeParse(input);
    if (!parsed.success) return actionError("errors.validation");

    const ctx = await requireHotelContext(parsed.data.hotelId);
    if (!canManageHotel(ctx.user, ctx.hotelId)) throw new UnauthorizedError();

    const duplicate = await prisma.department.findFirst({
      where: { hotelId: ctx.hotelId, name: parsed.data.name },
      select: { id: true },
    });
    if (duplicate) return actionError("departments.duplicateName");

    const department = await prisma.department.create({
      data: {
        hotelId: ctx.hotelId,
        name: parsed.data.name,
        defaultSlaMinutes: parsed.data.defaultSlaMinutes,
        affectsRoomStatus: parsed.data.affectsRoomStatus,
        createdById: ctx.user.id,
      },
      select: { id: true },
    });

    revalidatePath(`/${ctx.hotelId}/admin/departamentos`);
    return actionOk(department);
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateDepartment(
  departmentId: string,
  input: z.infer<typeof schema>,
): Promise<ActionResult<void>> {
  try {
    const parsed = schema.safeParse(input);
    if (!parsed.success) return actionError("errors.validation");

    const ctx = await requireHotelContext(parsed.data.hotelId);
    if (!canManageHotel(ctx.user, ctx.hotelId)) throw new UnauthorizedError();

    const existing = await prisma.department.findFirst({
      where: { id: departmentId, hotelId: ctx.hotelId },
      select: { id: true },
    });
    if (!existing) return actionError("errors.notFound");

    const duplicate = await prisma.department.findFirst({
      where: { hotelId: ctx.hotelId, name: parsed.data.name, id: { not: departmentId } },
      select: { id: true },
    });
    if (duplicate) return actionError("departments.duplicateName");

    await prisma.department.update({
      where: { id: departmentId },
      data: {
        name: parsed.data.name,
        defaultSlaMinutes: parsed.data.defaultSlaMinutes,
        affectsRoomStatus: parsed.data.affectsRoomStatus,
        active: parsed.data.active ?? true,
      },
    });

    revalidatePath(`/${ctx.hotelId}/admin/departamentos`);
    return actionOk();
  } catch (error) {
    return toActionError(error);
  }
}
