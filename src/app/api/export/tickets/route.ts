import { NextResponse } from "next/server";
import { subDays } from "date-fns";
import { requireHotelContext } from "@/lib/hotel-scope";
import { listTickets } from "@/lib/queries/tickets";
import { getDepartmentMetrics, getHotelMetrics } from "@/lib/queries/metrics";
import { buildWorkbook, spreadsheetResponse } from "@/lib/export";
import { isSlaOverdue } from "@/lib/sla";
import type { TicketPriority, TicketStatus } from "@/generated/prisma/enums";

/// Exporta los tickets del hotel con los mismos filtros de la vista.
///
/// Reutiliza `listTickets`, que ya aplica el scoping y la visibilidad por
/// departamento: un STAFF que exporte obtiene exactamente lo que ve en pantalla,
/// no el tablero completo del hotel.
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const hotelId = params.get("hotelId");
  if (!hotelId) return NextResponse.json({ error: "missing hotelId" }, { status: 400 });

  let ctx;
  try {
    ctx = await requireHotelContext(hotelId);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }

  const days = Number(params.get("days")) || 30;
  const from = subDays(new Date(), days);
  const to = new Date();

  const tickets = await listTickets(ctx, {
    status: parseEnum<TicketStatus>(params.get("status"), [
      "PENDING",
      "IN_PROGRESS",
      "RESOLVED",
      "CANCELLED",
    ]),
    priority: parseEnum<TicketPriority>(params.get("priority"), [
      "LOW",
      "MEDIUM",
      "HIGH",
    ]),
    departmentId: params.get("department") ?? undefined,
    assignedToId: params.get("assignee") ?? undefined,
    overdueOnly: params.get("overdue") === "1",
  });

  const [hotelMetrics, departmentMetrics] = await Promise.all([
    getHotelMetrics([ctx.hotelId], from, to),
    getDepartmentMetrics([ctx.hotelId], from, to),
  ]);

  const metrics = hotelMetrics[0];

  const workbook = buildWorkbook([
    {
      name: "Tickets",
      rows: tickets.map((ticket) => ({
        Título: ticket.title,
        Departamento: ticket.department.name,
        Estatus: ticket.status,
        Prioridad: ticket.priority,
        Origen: ticket.source,
        Habitación: ticket.roomStay?.room.number ?? "",
        Contacto: ticket.roomStay?.contactName ?? "",
        Asignado: ticket.assignedTo?.name ?? "",
        Creado: ticket.createdAt.toISOString(),
        "Vence SLA": ticket.slaDueAt?.toISOString() ?? "",
        "SLA vencido": isSlaOverdue(ticket) ? "Sí" : "No",
        Resuelto: ticket.resolvedAt?.toISOString() ?? "",
      })),
    },
    {
      name: "Resumen",
      rows: metrics
        ? [
            {
              Hotel: metrics.hotelName,
              Total: metrics.total,
              Abiertos: metrics.open,
              Resueltos: metrics.resolved,
              "SLA vencido": metrics.overdue,
              "Cumplimiento SLA %": metrics.slaCompliance ?? "",
              "Resolución promedio (min)": metrics.avgResolutionMinutes ?? "",
            },
          ]
        : [],
    },
    {
      name: "Por departamento",
      rows: departmentMetrics.map((row) => ({
        Departamento: row.departmentName,
        Total: row.total,
        "SLA vencido": row.overdue,
      })),
    },
  ]);

  const stamp = new Date().toISOString().slice(0, 10);
  return spreadsheetResponse(workbook, `tickets-${stamp}.xlsx`);
}

function parseEnum<T extends string>(
  value: string | null,
  allowed: T[],
): T | undefined {
  return value && allowed.includes(value as T) ? (value as T) : undefined;
}
