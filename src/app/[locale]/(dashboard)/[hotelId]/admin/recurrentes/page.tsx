import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { RecurringManager } from "@/components/admin/recurring-manager";
import { requireHotelContext } from "@/lib/hotel-scope";
import { canManageHotel } from "@/lib/auth/can";
import { prisma } from "@/lib/prisma";

export default async function RecurringPage({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;
  const ctx = await requireHotelContext(hotelId);
  if (!canManageHotel(ctx.user, hotelId)) notFound();

  const t = await getTranslations("recurring");

  const [templates, departments, rooms] = await Promise.all([
    prisma.recurringTicketTemplate.findMany({
      where: { hotelId: ctx.hotelId },
      select: {
        id: true,
        title: true,
        frequency: true,
        nextRunAt: true,
        lastRunAt: true,
        active: true,
        priority: true,
        department: { select: { name: true } },
        room: { select: { number: true } },
      },
      orderBy: { nextRunAt: "asc" },
    }),
    prisma.department.findMany({
      where: { hotelId: ctx.hotelId, active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.room.findMany({
      where: { hotelId: ctx.hotelId, active: true },
      select: { id: true, number: true },
      orderBy: { number: "asc" },
    }),
  ]);

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <RecurringManager
        hotelId={hotelId}
        templates={templates}
        departments={departments}
        rooms={rooms}
      />
    </>
  );
}
