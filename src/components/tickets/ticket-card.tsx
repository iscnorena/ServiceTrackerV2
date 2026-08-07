"use client";

import { useTranslations } from "next-intl";
import { DoorClosed } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { isSlaOverdue } from "@/lib/sla";
import {
  GuestSourceBadge,
  PriorityBadge,
  SlaIndicator,
} from "@/components/tickets/ticket-badges";
import type { TicketListItem } from "@/lib/queries/tickets";

export function TicketCard({
  ticket,
  hotelId,
}: {
  ticket: TicketListItem;
  hotelId: string;
}) {
  const t = useTranslations("common");
  const overdue = isSlaOverdue({ slaDueAt: ticket.slaDueAt, status: ticket.status });

  return (
    <Link
      href={`/${hotelId}/tickets/${ticket.id}`}
      className={cn(
        "block rounded-lg border bg-card p-3 shadow-xs transition-colors hover:bg-accent/50",
        overdue && "border-destructive/60",
      )}
    >
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <PriorityBadge priority={ticket.priority} />
        {ticket.source === "GUEST" ? <GuestSourceBadge /> : null}
      </div>

      <p className="text-sm leading-snug font-medium">{ticket.title}</p>

      <p className="mt-1 text-xs text-muted-foreground">{ticket.department.name}</p>

      {ticket.roomStay ? (
        <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
          <DoorClosed className="size-3.5" aria-hidden="true" />
          {ticket.roomStay.room.number} · {ticket.roomStay.contactName}
        </p>
      ) : null}

      <div className="mt-2 flex items-center justify-between gap-2">
        <SlaIndicator slaDueAt={ticket.slaDueAt} status={ticket.status} />
        <span className="truncate text-xs text-muted-foreground">
          {ticket.assignedTo?.name ?? t("unassigned")}
        </span>
      </div>
    </Link>
  );
}
