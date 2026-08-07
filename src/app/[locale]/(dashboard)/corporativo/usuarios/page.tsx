import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { CorporateUsersManager } from "@/components/corporate/corporate-users-manager";
import { requireCorporateContext } from "@/lib/hotel-scope";
import { canManageOrganizationUsers } from "@/lib/auth/can";
import { prisma } from "@/lib/prisma";

/// Administración de usuarios a nivel de toda la organización: promover a
/// corporativo, otorgar el permiso de borrado y desactivar cuentas.
export default async function CorporateUsersPage() {
  const ctx = await requireCorporateContext();
  if (!canManageOrganizationUsers(ctx.user)) notFound();

  const t = await getTranslations("users");

  const users = await prisma.user.findMany({
    where: { organizationId: ctx.organizationId },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      corporateRole: true,
      canDeleteTickets: true,
      hotelAccess: {
        select: {
          permissionLevel: true,
          canDeleteTickets: true,
          hotel: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [{ corporateRole: "desc" }, { name: "asc" }],
  });

  return (
    <>
      <PageHeader title={t("title")} description={t("canDeleteTicketsHint")} />
      <CorporateUsersManager users={users} currentUserId={ctx.user.id} />
    </>
  );
}
