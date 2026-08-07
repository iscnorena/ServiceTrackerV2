import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isLocale } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = isLocale(requested) ? requested : defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: "America/Mexico_City",
    // Referencia única para los tiempos relativos del SLA. Sin esto, servidor y
    // cliente calculan "vence en X" con relojes distintos y la hidratación no cuadra.
    now: new Date(),
    // Formatos con nombre para no repetir opciones de Intl en cada componente.
    formats: {
      dateTime: {
        short: {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        },
        medium: {
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        },
        date: { day: "numeric", month: "long", year: "numeric" },
      },
    },
  };
});
