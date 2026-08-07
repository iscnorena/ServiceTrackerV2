import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { HotelsManager } from "@/components/corporate/hotels-manager";
import { requireUser } from "@/lib/hotel-scope";
import { canManageHotels, canViewCorporateArea } from "@/lib/auth/can";
import { getPlatformConfig } from "@/lib/platform-config";
import { prisma } from "@/lib/prisma";

export default async function CorporateHotelsPage() {
  const user = await requireUser();
  if (!canViewCorporateArea(user) || !user.organizationId) notFound();

  const t = await getTranslations("hotels");
  const config = await getPlatformConfig();

  const [hotels, organization] = await Promise.all([
    prisma.hotel.findMany({
      where: { organizationId: user.organizationId },
      select: {
        id: true,
        name: true,
        address: true,
        timezone: true,
        billingStatus: true,
        _count: { select: { rooms: true, tickets: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { subscriptionStatus: true },
    }),
  ]);

  return (
    <>
      <PageHeader title={t("title")} />
      <HotelsManager
        hotels={hotels}
        canManage={canManageHotels(user)}
        isTrialing={organization?.subscriptionStatus === "TRIALING"}
        trialHotelLimit={config.trialHotelLimit}
      />
    </>
  );
}
