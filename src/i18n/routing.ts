import { defineRouting } from "next-intl/routing";

// Agregar un idioma nuevo debe ser únicamente: crear messages/{locale}.json y
// registrarlo aquí. Cero cambios en componentes o lógica de negocio.
export const locales = ["es", "en"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "es";

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "always",
});

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}
