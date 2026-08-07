import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { TicketForm } from "@/components/tickets/ticket-form";
import { requireHotelContext } from "@/lib/hotel-scope";
import { getTicketFormOptions } from "@/lib/queries/tickets";
import { isRestrictedToOwnDepartment } from "@/lib/auth/can";

export default async function NewTicketPage({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;
  const ctx = await requireHotelContext(hotelId);
  const t = await getTranslations("tickets");
  const options = await getTicketFormOptions(ctx);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("new")} />
      <TicketForm
        hotelId={hotelId}
        departments={options.departments}
        assignees={options.assignees}
        roomStays={options.roomStays}
        // Un STAFF abre tickets dentro de su departamento y no reasigna a otros.
        lockedDepartmentId={
          isRestrictedToOwnDepartment(ctx.user, hotelId)
            ? (ctx.access.departmentId ?? undefined)
            : undefined
        }
        canAssign={!isRestrictedToOwnDepartment(ctx.user, hotelId)}
      />
    </div>
  );
}
