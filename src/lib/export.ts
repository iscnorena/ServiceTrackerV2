import "server-only";
import * as XLSX from "xlsx";

/// Genera un `.xlsx` en memoria a partir de filas ya formateadas.
///
/// La exportación siempre parte de los mismos filtros que el usuario tiene
/// aplicados en pantalla (sección 4.4): el archivo debe coincidir exactamente con
/// lo que está viendo, sin un formulario de reporte aparte.
export function buildWorkbook(
  sheets: { name: string; rows: Record<string, string | number>[] }[],
): Buffer {
  const workbook = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const worksheet = XLSX.utils.json_to_sheet(sheet.rows);
    // Ancho de columna aproximado al contenido más largo, para que no salga todo
    // en columnas de 8 caracteres.
    const headers = Object.keys(sheet.rows[0] ?? {});
    worksheet["!cols"] = headers.map((header) => ({
      wch: Math.min(
        Math.max(
          header.length,
          ...sheet.rows.map((row) => String(row[header] ?? "").length),
        ) + 2,
        50,
      ),
    }));

    // Excel corta los nombres de hoja a 31 caracteres y rechaza algunos símbolos.
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31));
  }

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

export function spreadsheetResponse(buffer: Buffer, filename: string): Response {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
