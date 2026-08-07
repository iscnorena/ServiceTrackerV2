"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireHotelContext } from "@/lib/hotel-scope";
import { canManageHotel } from "@/lib/auth/can";
import { normalizeSupplyName } from "@/lib/normalize";
import { actionError, actionOk, toActionError, UnauthorizedError, type ActionResult } from "@/lib/errors";

const schema = z.object({
  hotelId: z.string().min(1),
  name: z.string().trim().min(2).max(80),
});

/// El catálogo de insumos es por hotel, no global. El nombre normalizado se
/// calcula al guardar para que la agregación corporativa pueda agrupar entre
/// propiedades sin normalizar en cada consulta (sección 4.5).
export async function createSupplyItem(
  input: z.infer<typeof schema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = schema.safeParse(input);
    if (!parsed.success) return actionError("errors.validation");

    const ctx = await requireHotelContext(parsed.data.hotelId);
    if (!canManageHotel(ctx.user, ctx.hotelId)) throw new UnauthorizedError();

    const duplicate = await prisma.supplyItem.findFirst({
      where: { hotelId: ctx.hotelId, name: parsed.data.name },
      select: { id: true },
    });
    if (duplicate) return actionError("departments.duplicateName");

    const supply = await prisma.supplyItem.create({
      data: {
        hotelId: ctx.hotelId,
        name: parsed.data.name,
        normalizedName: normalizeSupplyName(parsed.data.name),
        createdById: ctx.user.id,
      },
      select: { id: true },
    });

    revalidatePath(`/${ctx.hotelId}/admin/insumos`);
    return actionOk(supply);
  } catch (error) {
    return toActionError(error);
  }
}

export async function setSupplyItemActive(
  hotelId: string,
  supplyItemId: string,
  active: boolean,
): Promise<ActionResult<void>> {
  try {
    const ctx = await requireHotelContext(hotelId);
    if (!canManageHotel(ctx.user, ctx.hotelId)) throw new UnauthorizedError();

    const supply = await prisma.supplyItem.findFirst({
      where: { id: supplyItemId, hotelId: ctx.hotelId },
      select: { id: true },
    });
    if (!supply) return actionError("errors.notFound");

    await prisma.supplyItem.update({ where: { id: supply.id }, data: { active } });

    revalidatePath(`/${ctx.hotelId}/admin/insumos`);
    return actionOk();
  } catch (error) {
    return toActionError(error);
  }
}
