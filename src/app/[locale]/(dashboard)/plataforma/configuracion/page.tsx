import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { PlatformConfigForm } from "@/components/platform/platform-config-form";
import { requirePlatformOwner } from "@/lib/hotel-scope";
import { getPlatformConfig } from "@/lib/platform-config";

export default async function PlatformConfigPage() {
  await requirePlatformOwner();

  const t = await getTranslations("platform");
  const config = await getPlatformConfig();

  return (
    <div className="max-w-2xl">
      <PageHeader title={t("config")} description={t("configHint")} />
      <PlatformConfigForm config={config} />
    </div>
  );
}
