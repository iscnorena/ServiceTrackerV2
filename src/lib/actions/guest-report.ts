"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { calculateSlaDueAt } from "@/lib/sla";
import { syncRoomStatusByRoom } from "@/lib/room-status";
import { checkGuestReportLimit, clientIpFrom } from "@/lib/rate-limit";
import { actionError, actionOk, toActionError, type ActionResult } from "@/lib/errors";

/// Única acción del sistema que corre sin sesión. Se trata como superficie
/// pública: se valida el slug contra la base antes de nada, se limita por origen,
/// y nunca se devuelve información de otras habitaciones o huéspedes.

const schema = z.object({
  qrSlug: z.string().trim().min(4).max(40),
  category: z.enum(["CLEANING", "BROKEN", "OTHER"]),
  description: z.string().trim().min(5).max(1000),
  contactName: z.string().trim().max(120).optional(),
});

export async function submitGuestReport(
  input: z.infer<typeof schema>,
): Promise<ActionResult<void>> {
  try {
    const parsed = schema.safeParse(input);
    if (!parsed.success) return actionError("errors.validation");

    const room = await prisma.room.findUnique({
      where: { qrSlug: parsed.data.qrSlug },
      select: {
        id: true,
        status: true,
        active: true,
        hotelId: true,
        hotel: {
          select: {
            billingStatus: true,
            organization: { select: { subscriptionStatus: true } },
          },
        },
      },
    });

    if (!room?.active) return actionError("qr.invalidRoom");

    // Una propiedad suspendida o de un cliente sin suscripción vigente no debe
    // seguir recibiendo trabajo por un QR que quedó pegado en la pared.
    if (
      room.hotel.billingStatus !== "ACTIVE" ||
      !["ACTIVE", "TRIALING"].includes(room.hotel.organization.subscriptionStatus)
    ) {
      return actionError("qr.invalidRoom");
    }

    const ip = clientIpFrom(await headers());
    const allowed = await checkGuestReportLimit(ip, room.id);
    if (!allowed) return actionError("qr.rateLimited");

    // Solo se acepta el reporte si la habitación aparece ocupada según el propio
    // sistema. Ver la limitación conocida del PLAN: si recepción hace el check-in
    // en un PMS externo y no lo replica aquí, este dato se desincroniza — en un
    // despliegue real se resolvería integrando el PMS, no quitando la validación.
    const now = new Date();
    const stay = await prisma.roomStay.findFirst({
      where: { roomId: room.id, checkIn: { lte: now }, checkOut: { gte: now } },
      select: { id: true },
    });

    if (!stay) return actionError("qr.roomNotOccupied");

    // El huésped elige una categoría amplia, no un departamento técnico ni una
    // prioridad: eso lo reinterpreta el staff al revisarlo. El ticket entra al
    // departamento de recepción, que es quien tria en la operación real.
    const department = await pickTriageDepartment(room.hotelId);
    if (!department) return actionError("errors.generic");

    const ticket = await prisma.ticket.create({
      data: {
        hotelId: room.hotelId,
        title: TITLE_BY_CATEGORY[parsed.data.category],
        description: parsed.data.contactName
          ? `${parsed.data.description}\n\n— ${parsed.data.contactName}`
          : parsed.data.description,
        departmentId: department.id,
        priority: "MEDIUM",
        roomStayId: stay.id,
        source: "GUEST",
        guestCategory: parsed.data.category,
        slaDueAt: calculateSlaDueAt(department.defaultSlaMinutes, "MEDIUM"),
      },
      select: { id: true },
    });

    await prisma.ticketActivity.create({
      data: { ticketId: ticket.id, action: "CREATED", detail: "Reportado por huésped" },
    });

    if (department.affectsRoomStatus) await syncRoomStatusByRoom(room.id);

    return actionOk();
  } catch (error) {
    return toActionError(error);
  }
}

const TITLE_BY_CATEGORY: Record<string, string> = {
  CLEANING: "Solicitud de limpieza (huésped)",
  BROKEN: "Algo no funciona (huésped)",
  OTHER: "Reporte de huésped",
};

/// Departamento al que entran los reportes de huésped para triage. Se prefiere
/// uno llamado "Recepción"; si el hotel lo nombró de otra forma, se usa el más
/// antiguo activo antes que rechazar el reporte.
async function pickTriageDepartment(hotelId: string) {
  const byName = await prisma.department.findFirst({
    where: {
      hotelId,
      active: true,
      name: { contains: "recep", mode: "insensitive" },
    },
    select: { id: true, defaultSlaMinutes: true, affectsRoomStatus: true },
  });
  if (byName) return byName;

  return prisma.department.findFirst({
    where: { hotelId, active: true },
    select: { id: true, defaultSlaMinutes: true, affectsRoomStatus: true },
    orderBy: { createdAt: "asc" },
  });
}
