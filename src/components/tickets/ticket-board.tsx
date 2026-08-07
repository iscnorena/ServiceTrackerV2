"use client";

import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/page-header";
import { TicketCard } from "@/components/tickets/ticket-card";
import type { TicketListItem } from "@/lib/queries/tickets";
import type { TicketStatus } from "@/generated/prisma/enums";

/// Kanban por estatus. Las columnas son fijas a propósito: `Ticket.status`
/// controla lógica de negocio (reglas de SLA, notificaciones), por eso no se
/// convirtió en catálogo dinámico como los departamentos (sección 4.2).
const COLUMNS: TicketStatus[] = ["PENDING", "IN_PROGRESS", "RESOLVED", "CANCELLED"];

export function TicketBoard({
  tickets,
  hotelId,
}: {
  tickets: TicketListItem[];
  hotelId: string;
}) {
  const t = useTranslations("tickets");
  const tStatus = useTranslations("enums.ticketStatus");

  if (tickets.length === 0) return <EmptyState message={t("empty")} />;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {COLUMNS.map((status) => {
        const column = tickets.filter((ticket) => ticket.status === status);
        return (
          <section key={status} aria-label={tStatus(status)} className="min-w-0">
            <h2 className="mb-2 flex items-center justify-between text-sm font-semibold">
              {tStatus(status)}
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                {column.length}
              </span>
            </h2>
            <ul className="space-y-2">
              {column.map((ticket) => (
                <li key={ticket.id}>
                  <TicketCard ticket={ticket} hotelId={hotelId} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
