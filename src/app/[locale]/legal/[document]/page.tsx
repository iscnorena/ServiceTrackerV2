import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { prisma } from "@/lib/prisma";
import { defaultLocale } from "@/i18n/routing";
import type { LegalDocumentType } from "@/generated/prisma/enums";

/// Páginas públicas de términos y privacidad.
///
/// El contenido NO está escrito en el código: siempre se lee la versión más
/// reciente de `LegalDocument` para el tipo e idioma correspondientes, que el
/// PLATFORM_OWNER publica desde su panel.
const SLUGS: Record<string, LegalDocumentType> = {
  terminos: "TERMS",
  terms: "TERMS",
  privacidad: "PRIVACY",
  privacy: "PRIVACY",
};

export default async function LegalPage({
  params,
}: {
  params: Promise<{ locale: string; document: string }>;
}) {
  const { locale, document } = await params;
  const type = SLUGS[document];
  if (!type) notFound();

  const t = await getTranslations("legal");
  const tCommon = await getTranslations("common");
  const format = await getFormatter();

  // Si todavía no se publicó en este idioma, se cae al idioma base antes que
  // mostrar una página vacía: un documento legal ausente es peor que uno en otro idioma.
  const published =
    (await latestVersion(type, locale)) ?? (await latestVersion(type, defaultLocale));

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="flex items-center justify-between px-6 py-4">
        <Link href="/" className="font-semibold tracking-tight">
          {tCommon("appName")}
        </Link>
        <LocaleSwitcher />
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <article className="rounded-lg border bg-background p-8">
          <h1 className="mb-2 text-2xl font-semibold tracking-tight">
            {type === "TERMS" ? t("terms") : t("privacy")}
          </h1>

          {published ? (
            <>
              <p className="mb-8 text-sm text-muted-foreground">
                {t("lastUpdated", {
                  date: format.dateTime(published.publishedAt, "date"),
                })}{" "}
                · {t("version", { version: published.version })}
              </p>

              {published.format === "PDF" && published.fileUrl ? (
                <a
                  href={published.fileUrl}
                  className="font-medium underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("downloadPdf")}
                </a>
              ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <Markdown remarkPlugins={[remarkGfm]}>
                    {published.content ?? ""}
                  </Markdown>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("notPublished")}</p>
          )}
        </article>
      </main>
    </div>
  );
}

async function latestVersion(type: LegalDocumentType, locale: string) {
  return prisma.legalDocument.findFirst({
    where: { type, locale },
    orderBy: { version: "desc" },
    select: {
      version: true,
      content: true,
      format: true,
      fileUrl: true,
      publishedAt: true,
    },
  });
}
