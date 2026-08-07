import "server-only";

/// Los endpoints de cron son públicos en la red: Vercel los invoca por HTTP.
/// Sin este chequeo, cualquiera podría disparar la expiración de pruebas o
/// generar tickets recurrentes a voluntad.
///
/// Vercel Cron manda `Authorization: Bearer $CRON_SECRET` automáticamente.
export function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // Sin secreto configurado se rechaza todo: es preferible un cron que no corre
  // a un endpoint abierto en producción.
  if (!secret) return false;

  return request.headers.get("authorization") === `Bearer ${secret}`;
}
