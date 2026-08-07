import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { RoomsManager } from "@/components/admin/rooms-manager";
import { requireHotelContext } from "@/lib/hotel-scope";
import { canManageHotel } from "@/lib/auth/can";
import { prisma } from "@/lib/prisma";

export default async function RoomsPage({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;
  const ctx = await requireHotelContext(hotelId);
  const t = await getTranslations("rooms");
  const now = new Date();

  const rooms = await prisma.room.findMany({
    where: { hotelId: ctx.hotelId },
    select: {
      id: true,
      number: true,
      floor: true,
      status: true,
      qrSlug: true,
      // La ocupación vigente: es el contacto que verá quien atienda un ticket
      // de esta habitación.
      roomStays: {
        where: { checkIn: { lte: now }, checkOut: { gte: now } },
        select: { id: true, contactName: true, contactPhone: true },
        take: 1,
      },
    },
    orderBy: [{ floor: "asc" }, { number: "asc" }],
  });

  return (
    <>
      <PageHeader title={t("title")} />
      <RoomsManager
        hotelId={hotelId}
        rooms={rooms}
        canManage={canManageHotel(ctx.user, hotelId)}
      />
    </>
  );
}
