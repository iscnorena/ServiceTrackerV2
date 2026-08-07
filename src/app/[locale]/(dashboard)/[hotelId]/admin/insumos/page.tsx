import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { SuppliesManager } from "@/components/admin/supplies-manager";
import { requireHotelContext } from "@/lib/hotel-scope";
import { canManageHotel } from "@/lib/auth/can";
import { prisma } from "@/lib/prisma";

export default async function SuppliesPage({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;
  const ctx = await requireHotelContext(hotelId);
  if (!canManageHotel(ctx.user, hotelId)) notFound();

  const t = await getTranslations("supplies");

  const supplies = await prisma.supplyItem.findMany({
    where: { hotelId: ctx.hotelId },
    select: {
      id: true,
      name: true,
      active: true,
      _count: { select: { usages: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHeader title={t("title")} description={t("normalizationNote")} />
      <SuppliesManager hotelId={hotelId} supplies={supplies} />
    </>
  );
}
