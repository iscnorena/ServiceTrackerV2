import { NextResponse } from "next/server";
import { subDays } from "date-fns";
import { getCurrentUser } from "@/lib/auth/session";
import { canViewCrossHotelReports } from "@/lib/auth/can";
import { getRecurringSupplyReport } from "@/lib/queries/supply-report";
import { buildWorkbook, spreadsheetResponse } from "@/lib/export";

/// Exporta el reporte de insumos recurrentes con EXACTAMENTE los mismos filtros
/// que el usuario tiene en pantalla: los lee de la query string, igual que la
/// página. Si se recalcularan de otra forma, el archivo no coincidiría con lo que
/// el usuario está viendo.
export async function GET(request: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user || !canViewCrossHotelReports(user)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const days = Number(params.get("days")) || 90;
  const minRepetitions = Number(params.get("min")) || 1;
  const hotelIds = params.get("hotels")?.split(",").filter(Boolean);

  const report = await getRecurringSupplyReport(user, {
    from: subDays(new Date(), days),
    to: new Date(),
    hotelIds,
    minRepetitions,
  });

  const summary = report.rows.map((row) => ({
    Insumo: row.displayName,
    Unidades: row.totalQuantity,
    Registros: row.totalUsages,
    Hoteles: row.hotelCount,
    "Total de hoteles": report.totalHotels,
  }));

  // El desglose va en una hoja aparte con el nombre exacto que capturó cada
  // hotel: es lo que permite verificar que de verdad es el mismo insumo.
  const breakdown = report.rows.flatMap((row) =>
    row.breakdown.map((entry) => ({
      Insumo: row.displayName,
      Hotel: entry.hotelName,
      "Nombre capturado": entry.capturedName,
      Unidades: entry.quantity,
    })),
  );

  const workbook = buildWorkbook([
    { name: "Resumen", rows: summary },
    { name: "Desglose por hotel", rows: breakdown },
  ]);

  const stamp = new Date().toISOString().slice(0, 10);
  return spreadsheetResponse(workbook, `insumos-recurrentes-${stamp}.xlsx`);
}
