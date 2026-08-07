"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireHotelContext } from "@/lib/hotel-scope";
import { canManageHotel } from "@/lib/auth/can";
import { generateQrSlug } from "@/lib/normalize";
import { actionError, actionOk, toActionError, UnauthorizedError, type ActionResult } from "@/lib/errors";

const schema = z.object({
  hotelId: z.string().min(1),
  number: z.string().trim().min(1).max(20),
  floor: z.string().trim().max(20).nullable().optional(),
});

export async function createRoom(
  input: z.infer<typeof schema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = schema.safeParse(input);
    if (!parsed.success) return actionError("errors.validation");

    const ctx = await requireHotelContext(parsed.data.hotelId);
    if (!canManageHotel(ctx.user, ctx.hotelId)) throw new UnauthorizedError();

    const duplicate = await prisma.room.findFirst({
      where: { hotelId: ctx.hotelId, number: parsed.data.number },
      select: { id: true },
    });
    if (duplicate) return actionError("rooms.duplicateNumber");

    const room = await prisma.room.create({
      data: {
        hotelId: ctx.hotelId,
        number: parsed.data.number,
        floor: parsed.data.floor ?? null,
        qrSlug: generateQrSlug(),
      },
      select: { id: true },
    });

    revalidatePath(`/${ctx.hotelId}/habitaciones`);
    return actionOk(room);
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateRoom(
  roomId: string,
  input: z.infer<typeof schema>,
): Promise<ActionResult<void>> {
  try {
    const parsed = schema.safeParse(input);
    if (!parsed.success) return actionError("errors.validation");

    const ctx = await requireHotelContext(parsed.data.hotelId);
    if (!canManageHotel(ctx.user, ctx.hotelId)) throw new UnauthorizedError();

    const room = await prisma.room.findFirst({
      where: { id: roomId, hotelId: ctx.hotelId },
      select: { id: true },
    });
    if (!room) return actionError("errors.notFound");

    const duplicate = await prisma.room.findFirst({
      where: { hotelId: ctx.hotelId, number: parsed.data.number, id: { not: roomId } },
      select: { id: true },
    });
    if (duplicate) return actionError("rooms.duplicateNumber");

    await prisma.room.update({
      where: { id: room.id },
      data: { number: parsed.data.number, floor: parsed.data.floor ?? null },
    });

    revalidatePath(`/${ctx.hotelId}/habitaciones`);
    return actionOk();
  } catch (error) {
    return toActionError(error);
  }
}
