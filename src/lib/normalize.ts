/// Normaliza el nombre de un insumo para poder agruparlo entre hoteles.
///
/// El catálogo de `SupplyItem` es por hotel, así que el mismo insumo puede
/// capturarse como "Pilas AA" en un hotel y "baterías  AA" en otro. Esto es una
/// aproximación deliberada, no una coincidencia perfecta: por eso el reporte
/// muestra siempre el nombre exacto que capturó cada hotel (ver sección 4.5).
export function normalizeSupplyName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/// Slug corto y legible para las URLs públicas de QR (`/qr/{slug}`).
///
/// Se excluyen los caracteres que se confunden al teclear: `0`/`o`, y `1`/`l`/`i`.
/// Importa porque la URL se imprime en texto plano debajo del código, como
/// respaldo para cuando el QR no escanea y alguien la escribe a mano.
const SLUG_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

export function generateQrSlug(length = 10): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => SLUG_ALPHABET[byte % SLUG_ALPHABET.length]).join(
    "",
  );
}
