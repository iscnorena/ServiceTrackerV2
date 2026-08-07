import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { TicketDetail } from "@/components/tickets/ticket-detail";
import { requireHotelContext } from "@/lib/hotel-scope";
import { getTicketDetail, getTicketFormOptions } from "@/lib/queries/tickets";
import { canDeleteTicket, isRestrictedToOwnDepartment } from "@/lib/auth/can";
import { isStorageConfigured } from "@/lib/storage";
import { prisma } from "@/lib/prisma";

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ hotelId: string; ticketId: string }>;
}) {
  const { hotelId, ticketId } = await params;
  const ctx = await requireHotelContext(hotelId);

  const ticket = await getTicketDetail(ctx, ticketId);
  if (!ticket) notFound();

  const restricted = isRestrictedToOwnDepartment(ctx.user, hotelId);
  // Un STAFF solo abre el detalle de lo suyo, aunque adivine el id en la URL.
  if (
    restricted &&
    ticket.assignedTo?.id !== ctx.user.id &&
    ticket.department.id !== ctx.access.departmentId
  ) {
    notFound();
  }

  const [options, supplies] = await Promise.all([
    getTicketFormOptions(ctx),
    prisma.supplyItem.findMany({
      where: { hotelId: ctx.hotelId, active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <>
      <PageHeader title={ticket.title} description={ticket.department.name} />
      <TicketDetail
        ticket={ticket}
        hotelId={hotelId}
        departments={options.departments}
        assignees={options.assignees}
        supplies={supplies}
        canDelete={canDeleteTicket(ctx.user, hotelId)}
        canReassign={!restricted}
        storageConfigured={isStorageConfigured()}
      />
    </>
  );
}
