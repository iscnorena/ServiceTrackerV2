import "server-only";
import { prisma } from "@/lib/prisma";
import { multiHotelFilter } from "@/lib/hotel-scope";
import type { CurrentUser } from "@/lib/auth/session";

/// Reporte de insumos recurrentes cruzando propiedades (sección 4.5).
///
/// Este es el caso de uso que originó el proyecto: detectar que las pilas AA o
/// los controles remotos se reponen constantemente en varios hoteles, para
/// decidir una compra en volumen a nivel corporativo en vez de hotel por hotel.
///
/// Aplica a cualquiera con acceso a más de un hotel — un ADMIN con 2 propiedades
/// también lo necesita, no solo el corporativo.

export type SupplyReportFilters = {
  from: Date;
  to: Date;
  hotelIds?: string[];
  minRepetitions?: number;
};

export type SupplyReportRow = {
  normalizedName: string;
  /// Nombre más frecuente entre los hoteles, para encabezar la fila
  displayName: string;
  totalQuantity: number;
  totalUsages: number;
  hotelCount: number;
  /// Desglose por hotel con el nombre EXACTO que capturó cada uno. Es lo que
  /// permite verificar a ojo que de verdad se trata del mismo insumo antes de
  /// tomar una decisión de compra — la agrupación por nombre normalizado es una
  /// aproximación, no una coincidencia perfecta.
  breakdown: {
    hotelId: string;
    hotelName: string;
    capturedName: string;
    quantity: number;
  }[];
};

export async function getRecurringSupplyReport(
  user: CurrentUser,
  filters: SupplyReportFilters,
): Promise<{ rows: SupplyReportRow[]; totalHotels: number }> {
  const scope = multiHotelFilter(user, filters.hotelIds);
  const hotelIds = scope.hotelId.in;

  if (hotelIds.length === 0) return { rows: [], totalHotels: 0 };

  // Se agrega en la base y no en memoria: el rango puede abarcar meses de
  // consumo entre varias propiedades.
  const usages = await prisma.ticketSupplyUsage.groupBy({
    by: ["supplyItemId"],
    where: {
      createdAt: { gte: filters.from, lte: filters.to },
      // El scoping va por el ticket, que es quien lleva hotelId denormalizado.
      ticket: { hotelId: { in: hotelIds }, deletedAt: null },
    },
    _sum: { quantity: true },
    _count: { _all: true },
  });

  if (usages.length === 0) return { rows: [], totalHotels: hotelIds.length };

  const items = await prisma.supplyItem.findMany({
    where: { id: { in: usages.map((usage) => usage.supplyItemId) } },
    select: {
      id: true,
      name: true,
      normalizedName: true,
      hotelId: true,
      hotel: { select: { name: true } },
    },
  });

  const itemsById = new Map(items.map((item) => [item.id, item]));
  const grouped = new Map<string, SupplyReportRow>();

  for (const usage of usages) {
    const item = itemsById.get(usage.supplyItemId);
    if (!item) continue;

    const quantity = usage._sum.quantity ?? 0;
    const row = grouped.get(item.normalizedName) ?? {
      normalizedName: item.normalizedName,
      displayName: item.name,
      totalQuantity: 0,
      totalUsages: 0,
      hotelCount: 0,
      breakdown: [],
    };

    row.totalQuantity += quantity;
    row.totalUsages += usage._count._all;
    row.breakdown.push({
      hotelId: item.hotelId,
      hotelName: item.hotel.name,
      capturedName: item.name,
      quantity,
    });

    grouped.set(item.normalizedName, row);
  }

  const rows = [...grouped.values()].map((row) => {
    row.breakdown.sort((a, b) => b.quantity - a.quantity);
    row.hotelCount = new Set(row.breakdown.map((entry) => entry.hotelId)).size;
    // El nombre que encabeza la fila es el del hotel que más repuso: es el más
    // representativo para quien lee el reporte.
    row.displayName = row.breakdown[0]?.capturedName ?? row.displayName;
    return row;
  });

  const minRepetitions = filters.minRepetitions ?? 0;

  return {
    rows: rows
      .filter((row) => row.totalUsages >= minRepetitions)
      .sort((a, b) => b.totalQuantity - a.totalQuantity),
    totalHotels: hotelIds.length,
  };
}
