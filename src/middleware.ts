import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

// El middleware solo resuelve el locale. La autorización real vive en el servidor
// (layouts + Server Actions vía lib/auth/session.ts), no aquí: el middleware corre
// en edge runtime y no debe tocar la base de datos.
export default createMiddleware(routing);

export const config = {
  // Todo excepto /api, /qr (ruta pública sin locale), assets y archivos estáticos.
  matcher: ["/((?!api|qr|_next|_vercel|.*\\..*).*)"],
};
