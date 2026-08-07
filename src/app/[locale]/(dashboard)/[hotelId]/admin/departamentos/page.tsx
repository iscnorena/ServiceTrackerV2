import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { DepartmentsManager } from "@/components/admin/departments-manager";
import { requireHotelContext } from "@/lib/hotel-scope";
import { canManageHotel } from "@/lib/auth/can";
import { prisma } from "@/lib/prisma";

export default async function DepartmentsPage({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;
  const ctx = await requireHotelContext(hotelId);
  if (!canManageHotel(ctx.user, hotelId)) notFound();

  const t = await getTranslations("departments");
  const departments = await prisma.department.findMany({
    where: { hotelId: ctx.hotelId },
    select: {
      id: true,
      name: true,
      defaultSlaMinutes: true,
      affectsRoomStatus: true,
      active: true,
      _count: { select: { tickets: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <DepartmentsManager hotelId={hotelId} departments={departments} />
    </>
  );
}
