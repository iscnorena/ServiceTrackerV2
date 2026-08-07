"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireHotelContext, notDeleted } from "@/lib/hotel-scope";
import { isRestrictedToOwnDepartment } from "@/lib/auth/can";
import { uploadTicketPhoto } from "@/lib/storage";
import { actionError, actionOk, toActionError, NotFoundError, UnauthorizedError, type ActionResult } from "@/lib/errors";
import type { AttachmentType } from "@/generated/prisma/enums";

/// Fotos de "antes" y "después" de un ticket. Sirven de evidencia del trabajo
/// hecho y son lo que convierte un ticket resuelto en algo verificable.
export async function uploadTicketAttachment(
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  try {
    const hotelId = String(formData.get("hotelId") ?? "");
    const ticketId = String(formData.get("ticketId") ?? "");
    const type = String(formData.get("type") ?? "OTHER") as AttachmentType;
    const file = formData.get("file");

    if (!(file instanceof File)) return actionError("errors.validation");
    if (!["BEFORE", "AFTER", "OTHER"].includes(type)) {
      return actionError("errors.validation");
    }

    const ctx = await requireHotelContext(hotelId);

    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, hotelId: ctx.hotelId, ...notDeleted },
      select: { id: true, departmentId: true, assignedToId: true },
    });
    if (!ticket) throw new NotFoundError();

    // Un STAFF solo adjunta a lo suyo, igual que para editarlo.
    if (isRestrictedToOwnDepartment(ctx.user, ctx.hotelId)) {
      const own =
        ticket.assignedToId === ctx.user.id ||
        (ctx.access.departmentId != null &&
          ticket.departmentId === ctx.access.departmentId);
      if (!own) throw new UnauthorizedError();
    }

    const upload = await uploadTicketPhoto(file, `tickets/${ctx.hotelId}/${ticket.id}`);
    if (!upload.ok) return actionError(upload.errorKey);

    await prisma.$transaction([
      prisma.ticketAttachment.create({
        data: {
          ticketId: ticket.id,
          uploadedById: ctx.user.id,
          url: upload.url,
          type,
        },
      }),
      prisma.ticketActivity.create({
        data: { ticketId: ticket.id, userId: ctx.user.id, action: "ATTACHED" },
      }),
    ]);

    revalidatePath(`/${ctx.hotelId}/tickets/${ticket.id}`);
    return actionOk({ url: upload.url });
  } catch (error) {
    return toActionError(error);
  }
}
