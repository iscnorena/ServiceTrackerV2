import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

/// Límite de reportes por origen en la ruta pública del QR.
///
/// Es el control principal contra el abuso de un formulario sin autenticación
/// (sección 4.3). Deliberadamente permisivo: un huésped legítimo puede reportar
/// dos o tres cosas seguidas al llegar a su cuarto, y bloquearlo sería peor que
/// el spam que se busca evitar.
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60_000;

function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

/// La IP real viene del proxy de Vercel. Si no hay cabecera (desarrollo local)
/// se usa una constante: el límite sigue aplicando, solo que compartido.
export function clientIpFrom(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function checkGuestReportLimit(
  ip: string,
  roomId: string,
): Promise<boolean> {
  const ipHash = hashIp(ip);
  const since = new Date(Date.now() - WINDOW_MS);

  const recent = await prisma.guestReportAttempt.count({
    where: { ipHash, createdAt: { gte: since } },
  });

  if (recent >= MAX_ATTEMPTS) return false;

  await prisma.guestReportAttempt.create({ data: { ipHash, roomId } });
  return true;
}

/// Limpieza oportunista: los intentos viejos ya no sirven para nada y no vale la
/// pena un cron aparte para borrarlos.
export async function pruneGuestReportAttempts(): Promise<void> {
  await prisma.guestReportAttempt.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
}
