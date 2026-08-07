"use client";

import { useFormatter, useTranslations } from "next-intl";
import { AlertTriangle, Clock, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { isSlaOverdue } from "@/lib/sla";
import type { TicketPriority, TicketStatus } from "@/generated/prisma/enums";

const STATUS_CLASS: Record<TicketStatus, string> = {
  PENDING: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  IN_PROGRESS: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  RESOLVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  CANCELLED: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

const PRIORITY_CLASS: Record<TicketPriority, string> = {
  LOW: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  MEDIUM: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  HIGH: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  const t = useTranslations("enums.ticketStatus");
  return <Badge className={STATUS_CLASS[status]}>{t(status)}</Badge>;
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const t = useTranslations("enums.ticketPriority");
  return <Badge className={PRIORITY_CLASS[priority]}>{t(priority)}</Badge>;
}

/// Un ticket levantado por el huésped suele ameritar atención más rápida que uno
/// que abrió un compañero, así que se distingue con etiqueta e ícono (no color solo).
export function GuestSourceBadge() {
  const t = useTranslations("tickets");
  return (
    <Badge className="bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200">
      <UserRound className="size-3" aria-hidden="true" />
      {t("guestBadge")}
    </Badge>
  );
}

/// El estado de SLA nunca depende solo del color: lleva ícono y texto, para que
/// se lea igual con daltonismo.
export function SlaIndicator({
  slaDueAt,
  status,
}: {
  slaDueAt: Date | null;
  status: TicketStatus;
}) {
  const t = useTranslations("tickets");
  const format = useFormatter();

  if (!slaDueAt) {
    return <span className="text-xs text-muted-foreground">{t("noSla")}</span>;
  }

  if (isSlaOverdue({ slaDueAt, status })) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-destructive">
        <AlertTriangle className="size-3.5" aria-hidden="true" />
        {t("slaOverdue")}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Clock className="size-3.5" aria-hidden="true" />
      {t("slaDue", { time: format.relativeTime(slaDueAt) })}
    </span>
  );
}
