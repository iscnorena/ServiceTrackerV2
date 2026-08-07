import "server-only";
import { prisma } from "@/lib/prisma";
import {
  departmentVisibilityFilter,
  hotelFilter,
  notDeleted,
  type HotelContext,
} from "@/lib/hotel-scope";
import type { TicketPriority, TicketStatus } from "@/generated/prisma/enums";

export type TicketFilters = {
  status?: TicketStatus;
  priority?: TicketPriority;
  departmentId?: string;
  assignedToId?: string;
  overdueOnly?: boolean;
};

/// El `where` de todo listado de tickets: hotel + visibilidad por departamento
/// (un STAFF no ve el tablero completo) + exclusión de borrados + filtros de UI.
const OPEN_STATUSES: TicketStatus[] = ["PENDING", "IN_PROGRESS"];

function ticketWhere(ctx: HotelContext, filters: TicketFilters) {
  // "Vencido" implica que el ticket sigue abierto, así que ambos filtros de
  // estatus se combinan en vez de pisarse entre sí.
  const status = filters.overdueOnly
    ? { in: filters.status ? [filters.status].filter((s) => OPEN_STATUSES.includes(s)) : OPEN_STATUSES }
    : filters.status;

  return {
    ...hotelFilter(ctx),
    ...notDeleted,
    ...departmentVisibilityFilter(ctx),
    ...(status ? { status } : {}),
    ...(filters.overdueOnly ? { slaDueAt: { lt: new Date() } } : {}),
    ...(filters.priority ? { priority: filters.priority } : {}),
    ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
    ...(filters.assignedToId ? { assignedToId: filters.assignedToId } : {}),
  };
}

const TICKET_LIST_SELECT = {
  id: true,
  title: true,
  status: true,
  priority: true,
  source: true,
  slaDueAt: true,
  createdAt: true,
  resolvedAt: true,
  department: { select: { id: true, name: true } },
  assignedTo: { select: { id: true, name: true } },
  roomStay: {
    select: {
      id: true,
      contactName: true,
      contactPhone: true,
      room: { select: { id: true, number: true } },
    },
  },
} as const;

export type TicketListItem = Awaited<ReturnType<typeof listTickets>>[number];

export async function listTickets(ctx: HotelContext, filters: TicketFilters = {}) {
  return prisma.ticket.findMany({
    where: ticketWhere(ctx, filters),
    select: TICKET_LIST_SELECT,
    // Los que vencen primero arriba; los que no manejan SLA, al final por fecha.
    orderBy: [{ slaDueAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    take: 300,
  });
}

export async function countTicketsByStatus(ctx: HotelContext) {
  const grouped = await prisma.ticket.groupBy({
    by: ["status"],
    where: ticketWhere(ctx, {}),
    _count: { _all: true },
  });

  const counts: Record<TicketStatus, number> = {
    PENDING: 0,
    IN_PROGRESS: 0,
    RESOLVED: 0,
    CANCELLED: 0,
  };
  for (const row of grouped) counts[row.status] = row._count._all;
  return counts;
}

export async function countOverdueTickets(ctx: HotelContext): Promise<number> {
  return prisma.ticket.count({
    where: ticketWhere(ctx, { overdueOnly: true }),
  });
}

export async function countResolvedToday(ctx: HotelContext): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  return prisma.ticket.count({
    where: {
      ...ticketWhere(ctx, {}),
      status: "RESOLVED",
      resolvedAt: { gte: startOfDay },
    },
  });
}

export async function getTicketDetail(ctx: HotelContext, ticketId: string) {
  return prisma.ticket.findFirst({
    where: { id: ticketId, ...hotelFilter(ctx), ...notDeleted },
    select: {
      ...TICKET_LIST_SELECT,
      description: true,
      guestCategory: true,
      createdBy: { select: { id: true, name: true } },
      activities: {
        select: {
          id: true,
          action: true,
          detail: true,
          createdAt: true,
          user: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      comments: {
        select: {
          id: true,
          message: true,
          createdAt: true,
          user: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      attachments: {
        select: { id: true, url: true, type: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
      supplyUsage: {
        select: {
          id: true,
          quantity: true,
          supplyItem: { select: { id: true, name: true } },
        },
      },
    },
  });
}

/// Opciones que necesitan los formularios de ticket, todas escopadas al hotel.
export async function getTicketFormOptions(ctx: HotelContext) {
  const [departments, assignees, roomStays] = await Promise.all([
    prisma.department.findMany({
      where: { hotelId: ctx.hotelId, active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: {
        status: { not: "DISABLED" },
        OR: [
          { hotelAccess: { some: { hotelId: ctx.hotelId } } },
          {
            corporateRole: { not: "NONE" },
            organization: { hotels: { some: { id: ctx.hotelId } } },
          },
        ],
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.roomStay.findMany({
      where: {
        room: { hotelId: ctx.hotelId },
        checkOut: { gte: new Date() },
      },
      select: {
        id: true,
        contactName: true,
        room: { select: { number: true } },
      },
      orderBy: { room: { number: "asc" } },
    }),
  ]);

  return { departments, assignees, roomStays };
}
