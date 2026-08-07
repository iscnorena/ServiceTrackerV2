import "server-only";
import { prisma } from "@/lib/prisma";
import { metSla } from "@/lib/sla";

/// Métricas agregadas de tickets. Se calculan sobre un conjunto de hoteles para
/// servir por igual al dashboard de un hotel y al comparativo entre propiedades.

export type HotelMetrics = {
  hotelId: string;
  hotelName: string;
  total: number;
  open: number;
  resolved: number;
  overdue: number;
  /// Minutos promedio entre creación y resolución. `null` si no hay resueltos.
  avgResolutionMinutes: number | null;
  /// Porcentaje de tickets resueltos dentro de su SLA. `null` si ninguno manejaba SLA.
  slaCompliance: number | null;
};

export type DepartmentMetrics = {
  departmentId: string;
  departmentName: string;
  total: number;
  overdue: number;
};

export async function getHotelMetrics(
  hotelIds: string[],
  from: Date,
  to: Date,
): Promise<HotelMetrics[]> {
  if (hotelIds.length === 0) return [];

  const tickets = await prisma.ticket.findMany({
    where: {
      hotelId: { in: hotelIds },
      deletedAt: null,
      createdAt: { gte: from, lte: to },
    },
    select: {
      hotelId: true,
      status: true,
      slaDueAt: true,
      createdAt: true,
      resolvedAt: true,
      hotel: { select: { name: true } },
    },
  });

  const now = new Date();
  const byHotel = new Map<string, HotelMetrics & { _resolutionSum: number; _resolutionCount: number; _slaTotal: number; _slaMet: number }>();

  for (const hotelId of hotelIds) {
    byHotel.set(hotelId, {
      hotelId,
      hotelName: "",
      total: 0,
      open: 0,
      resolved: 0,
      overdue: 0,
      avgResolutionMinutes: null,
      slaCompliance: null,
      _resolutionSum: 0,
      _resolutionCount: 0,
      _slaTotal: 0,
      _slaMet: 0,
    });
  }

  for (const ticket of tickets) {
    const entry = byHotel.get(ticket.hotelId);
    if (!entry) continue;

    entry.hotelName = ticket.hotel.name;
    entry.total += 1;

    const isOpen = ticket.status === "PENDING" || ticket.status === "IN_PROGRESS";
    if (isOpen) entry.open += 1;
    if (ticket.status === "RESOLVED") entry.resolved += 1;

    if (isOpen && ticket.slaDueAt && ticket.slaDueAt < now) entry.overdue += 1;

    if (ticket.resolvedAt) {
      entry._resolutionSum +=
        (ticket.resolvedAt.getTime() - ticket.createdAt.getTime()) / 60_000;
      entry._resolutionCount += 1;
    }

    // El cumplimiento solo se mide sobre tickets que tenían SLA y ya cerraron:
    // incluir los que nunca tuvieron SLA inflaría el porcentaje artificialmente.
    const met = metSla(ticket);
    if (met !== null) {
      entry._slaTotal += 1;
      if (met) entry._slaMet += 1;
    }
  }

  return [...byHotel.values()].map((entry) => ({
    hotelId: entry.hotelId,
    hotelName: entry.hotelName,
    total: entry.total,
    open: entry.open,
    resolved: entry.resolved,
    overdue: entry.overdue,
    avgResolutionMinutes:
      entry._resolutionCount > 0
        ? Math.round(entry._resolutionSum / entry._resolutionCount)
        : null,
    slaCompliance:
      entry._slaTotal > 0 ? Math.round((entry._slaMet / entry._slaTotal) * 100) : null,
  }));
}

export async function getDepartmentMetrics(
  hotelIds: string[],
  from: Date,
  to: Date,
): Promise<DepartmentMetrics[]> {
  if (hotelIds.length === 0) return [];

  const tickets = await prisma.ticket.findMany({
    where: {
      hotelId: { in: hotelIds },
      deletedAt: null,
      createdAt: { gte: from, lte: to },
    },
    select: {
      status: true,
      slaDueAt: true,
      department: { select: { id: true, name: true } },
    },
  });

  const now = new Date();
  const byDepartment = new Map<string, DepartmentMetrics>();

  for (const ticket of tickets) {
    // Los departamentos son por hotel, así que el mismo nombre en dos
    // propiedades se agrupa junto: es lo que interesa en la vista comparativa.
    const key = ticket.department.name;
    const entry = byDepartment.get(key) ?? {
      departmentId: ticket.department.id,
      departmentName: ticket.department.name,
      total: 0,
      overdue: 0,
    };

    entry.total += 1;
    if (
      (ticket.status === "PENDING" || ticket.status === "IN_PROGRESS") &&
      ticket.slaDueAt &&
      ticket.slaDueAt < now
    ) {
      entry.overdue += 1;
    }

    byDepartment.set(key, entry);
  }

  return [...byDepartment.values()].sort((a, b) => b.total - a.total);
}
