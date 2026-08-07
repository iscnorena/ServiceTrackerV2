import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { HotelUsersManager } from "@/components/admin/hotel-users-manager";
import { requireHotelContext } from "@/lib/hotel-scope";
import { canGrantDeletePermission, canManageHotelUsers } from "@/lib/auth/can";
import { prisma } from "@/lib/prisma";

export default async function HotelUsersPage({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;
  const ctx = await requireHotelContext(hotelId);
  if (!canManageHotelUsers(ctx.user, hotelId)) notFound();

  const t = await getTranslations("users");

  const [access, departments] = await Promise.all([
    // Solo el staff con acceso directo a ESTE hotel. Los roles corporativos se
    // administran desde el área corporativa, no propiedad por propiedad.
    prisma.userHotelAccess.findMany({
      where: { hotelId: ctx.hotelId },
      select: {
        id: true,
        permissionLevel: true,
        departmentId: true,
        canDeleteTickets: true,
        user: {
          select: { id: true, name: true, email: true, status: true },
        },
      },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.department.findMany({
      where: { hotelId: ctx.hotelId, active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <>
      <PageHeader title={t("title")} description={t("inviteSubtitle")} />
      <HotelUsersManager
        hotelId={hotelId}
        access={access}
        departments={departments}
        canGrantDelete={canGrantDeletePermission(ctx.user)}
        currentUserId={ctx.user.id}
      />
    </>
  );
}
