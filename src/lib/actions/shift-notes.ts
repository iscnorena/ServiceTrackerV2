"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireHotelContext } from "@/lib/hotel-scope";
import { actionError, actionOk, toActionError, type ActionResult } from "@/lib/errors";

const schema = z.object({
  hotelId: z.string().min(1),
  departmentId: z.string().min(1).nullable().optional(),
  content: z.string().trim().min(3).max(2000),
});

/// Contexto que el turno saliente deja al que entra. No está atado a un ticket:
/// es información operativa suelta ("el 210 pidió toallas, aún no se les lleva")
/// que de otro modo se pierde en el cambio de turno.
///
/// Cualquiera con acceso al hotel puede escribir una: es justo el staff de piso
/// quien tiene el contexto que vale la pena dejar.
export async function createShiftNote(
  input: z.infer<typeof schema>,
): Promise<ActionResult<void>> {
  try {
    const parsed = schema.safeParse(input);
    if (!parsed.success) return actionError("errors.validation");

    const ctx = await requireHotelContext(parsed.data.hotelId);

    if (parsed.data.departmentId) {
      const department = await prisma.department.findFirst({
        where: { id: parsed.data.departmentId, hotelId: ctx.hotelId },
        select: { id: true },
      });
      if (!department) return actionError("errors.notFound");
    }

    await prisma.shiftNote.create({
      data: {
        hotelId: ctx.hotelId,
        departmentId: parsed.data.departmentId ?? null,
        authorId: ctx.user.id,
        content: parsed.data.content,
      },
    });

    revalidatePath(`/${ctx.hotelId}/notas`);
    revalidatePath(`/${ctx.hotelId}`);
    return actionOk();
  } catch (error) {
    return toActionError(error);
  }
}
