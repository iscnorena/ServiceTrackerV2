import { NextResponse } from "next/server";
import { addDays, addMonths, addWeeks } from "date-fns";
import { prisma } from "@/lib/prisma";
import { isAuthorizedCron } from "@/lib/cron";
import { calculateSlaDueAt } from "@/lib/sla";
import type { RecurrenceFrequency } from "@/generated/prisma/enums";

/// Materializa los tickets de mantenimiento preventivo cuya plantilla ya venció.
///
/// Corre una vez al día (máximo de Vercel Hobby), que alcanza porque la
/// frecuencia mínima de una plantilla es diaria.
///
/// Es idempotente: si el cron se reintenta, `nextRunAt` ya avanzó y la plantilla
/// deja de calificar, así que no se duplican tickets para el mismo ciclo. El
/// avance de fecha y la creación del ticket van en la misma transacción para que
/// no pueda pasar una sin la otra.
export async function GET(request: Request): Promise<NextResponse> {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();

  const due = await prisma.recurringTicketTemplate.findMany({
    where: {
      active: true,
      nextRunAt: { lte: now },
      // Una propiedad suspendida no genera trabajo nuevo.
      hotel: {
        billingStatus: "ACTIVE",
        organization: { subscriptionStatus: { in: ["ACTIVE", "TRIALING"] } },
      },
    },
    select: {
      id: true,
      hotelId: true,
      title: true,
      description: true,
      departmentId: true,
      roomId: true,
      priority: true,
      frequency: true,
      nextRunAt: true,
      createdById: true,
      department: { select: { defaultSlaMinutes: true } },
    },
  });

  let created = 0;

  for (const template of due) {
    // Si la plantilla apunta a un cuarto, se engancha a su ocupación vigente para
    // que el ticket llegue con el contacto correcto; si no hay nadie hospedado,
    // el ticket se crea igual pero sin contacto.
    const roomStay = template.roomId
      ? await prisma.roomStay.findFirst({
          where: {
            roomId: template.roomId,
            checkIn: { lte: now },
            checkOut: { gte: now },
          },
          select: { id: true },
        })
      : null;

    await prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.create({
        data: {
          hotelId: template.hotelId,
          title: template.title,
          description: template.description,
          departmentId: template.departmentId,
          priority: template.priority,
          roomStayId: roomStay?.id ?? null,
          createdById: template.createdById,
          source: "STAFF",
          slaDueAt: calculateSlaDueAt(
            template.department.defaultSlaMinutes,
            template.priority,
            now,
          ),
        },
        select: { id: true },
      });

      await tx.ticketActivity.create({
        data: {
          ticketId: ticket.id,
          userId: template.createdById,
          action: "CREATED",
          detail: "Generado por plantilla recurrente",
        },
      });

      await tx.recurringTicketTemplate.update({
        where: { id: template.id },
        data: {
          lastRunAt: now,
          nextRunAt: advance(template.nextRunAt, template.frequency, now),
        },
      });
    });

    created += 1;
  }

  return NextResponse.json({ created });
}

/// Avanza la fecha hasta dejarla en el futuro. El bucle importa: si el cron no
/// corrió durante una semana, una plantilla diaria no debe generar siete tickets
/// atrasados de golpe — se genera uno y se reanuda el ciclo desde hoy.
function advance(from: Date, frequency: RecurrenceFrequency, now: Date): Date {
  const step = (date: Date): Date =>
    frequency === "DAILY"
      ? addDays(date, 1)
      : frequency === "WEEKLY"
        ? addWeeks(date, 1)
        : addMonths(date, 1);

  let next = step(from);
  while (next <= now) next = step(next);
  return next;
}
