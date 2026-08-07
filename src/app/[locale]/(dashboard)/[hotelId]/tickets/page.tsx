import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { TicketBoard } from "@/components/tickets/ticket-board";
import { TicketFilterBar } from "@/components/tickets/ticket-filter-bar";
import { requireHotelContext } from "@/lib/hotel-scope";
import { listTickets, getTicketFormOptions } from "@/lib/queries/tickets";
import type { TicketPriority, TicketStatus } from "@/generated/prisma/enums";

export default async function TicketsPage({
  params,
  searchParams,
}: {
  params: Promise<{ hotelId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { hotelId } = await params;
  const query = await searchParams;
  const ctx = await requireHotelContext(hotelId);
  const t = await getTranslations("tickets");

  const filters = {
    status: parseEnum<TicketStatus>(query.status, [
      "PENDING",
      "IN_PROGRESS",
      "RESOLVED",
      "CANCELLED",
    ]),
    priority: parseEnum<TicketPriority>(query.priority, ["LOW", "MEDIUM", "HIGH"]),
    departmentId: query.department || undefined,
    assignedToId: query.assignee || undefined,
    overdueOnly: query.overdue === "1",
  };

  const [tickets, options] = await Promise.all([
    listTickets(ctx, filters),
    getTicketFormOptions(ctx),
  ]);

  return (
    <>
      <PageHeader
        title={t("title")}
        actions={
          <Button render={<Link href={`/${hotelId}/tickets/nuevo`} />}>
            <Plus className="size-4" aria-hidden="true" />
            {t("new")}
          </Button>
        }
      />

      <TicketFilterBar
        departments={options.departments}
        assignees={options.assignees}
      />

      <TicketBoard tickets={tickets} hotelId={hotelId} />
    </>
  );
}

function parseEnum<T extends string>(value: string | undefined, allowed: T[]): T | undefined {
  return allowed.includes(value as T) ? (value as T) : undefined;
}
