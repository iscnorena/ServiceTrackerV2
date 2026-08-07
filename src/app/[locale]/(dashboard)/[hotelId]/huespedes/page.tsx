import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { GuestsManager } from "@/components/guests/guests-manager";
import { requireHotelContext } from "@/lib/hotel-scope";
import { prisma } from "@/lib/prisma";

export default async function GuestsPage({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;
  const ctx = await requireHotelContext(hotelId);
  const t = await getTranslations("guests");

  const [guests, rooms] = await Promise.all([
    prisma.guest.findMany({
      where: { hotelId: ctx.hotelId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        reservations: {
          select: {
            id: true,
            checkIn: true,
            checkOut: true,
            notes: true,
            roomStays: {
              select: {
                id: true,
                contactName: true,
                contactPhone: true,
                room: { select: { id: true, number: true } },
              },
            },
          },
          orderBy: { checkIn: "desc" },
        },
      },
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
      <PageHeader title={t("title")} />
      <GuestsManager hotelId={hotelId} guests={guests} rooms={rooms} />
    </>
  );
}
