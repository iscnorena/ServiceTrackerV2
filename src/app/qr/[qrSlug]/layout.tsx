import type { ReactNode } from "react";
import { headers } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { defaultLocale, isLocale, type Locale } from "@/i18n/routing";
import "../../globals.css";

/// La ruta del QR vive fuera de `[locale]` a propósito: el huésped no debe pasar
/// por un selector de idioma antes de reportar que no le enfría el aire. Se toma
/// el idioma del navegador y ya.
export default async function QrLayout({ children }: { children: ReactNode }) {
  const locale = await detectLocale();
  const all = (await import(`../../../../messages/${locale}.json`)).default;

  // Se mandan al cliente solo los namespaces que esta pantalla usa, en vez del
  // catálogo completo: el huésped abre esto desde el wifi del hotel y no tiene
  // por qué descargar los textos del panel de administración.
  const messages = {
    qr: all.qr,
    errors: all.errors,
    enums: { guestCategory: all.enums.guestCategory },
  };

  return (
    <html lang={locale}>
      <body className="min-h-screen bg-muted/30 antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

async function detectLocale(): Promise<Locale> {
  const header = (await headers()).get("accept-language");
  const preferred = header?.split(",")[0]?.split("-")[0]?.toLowerCase();
  return isLocale(preferred) ? preferred : defaultLocale;
}
