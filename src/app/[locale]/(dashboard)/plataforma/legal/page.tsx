import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { LegalEditor } from "@/components/platform/legal-editor";
import { requirePlatformOwner } from "@/lib/hotel-scope";
import { locales } from "@/i18n/routing";
import { prisma } from "@/lib/prisma";

export default async function PlatformLegalPage() {
  await requirePlatformOwner();

  const t = await getTranslations("platform");

  // Solo la versión vigente de cada combinación tipo+idioma alimenta el editor;
  // el historial completo se muestra aparte.
  const documents = await prisma.legalDocument.findMany({
    select: {
      id: true,
      type: true,
      locale: true,
      version: true,
      content: true,
      publishedAt: true,
    },
    orderBy: { version: "desc" },
  });

  return (
    <div className="max-w-4xl">
      <PageHeader title={t("legalTitle")} description={t("legalHint")} />
      <LegalEditor documents={documents} locales={[...locales]} />
    </div>
  );
}
