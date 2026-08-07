import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, EmptyState } from "@/components/page-header";
import { TicketCard } from "@/components/tickets/ticket-card";
import { requireHotelContext, hotelFilter, notDeleted } from "@/lib/hotel-scope";
import {
  countOverdueTickets,
  countResolvedToday,
  countTicketsByStatus,
  listTickets,
} from "@/lib/queries/tickets";
import { prisma } from "@/lib/prisma";
import { scopeIn } from "@/lib/auth/can";

/// Dashboard del hotel. Cada nivel ve lo que necesita para su trabajo diario:
/// un STAFF ve su cola priorizada por SLA; un ADMIN además ve lo que está sin
/// asignar y el SLA vencido agrupado por departamento (sección 4.4).
export default async function HotelDashboardPage({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;
  const ctx = await requireHotelContext(hotelId);
  const t = await getTranslations("dashboard");
  const isStaff = scopeIn(ctx.user, hotelId) === "STAFF";

  const [counts, overdue, resolvedToday, myTickets, shiftNotes] = await Promise.all([
    countTicketsByStatus(ctx),
    countOverdueTickets(ctx),
    countResolvedToday(ctx),
    listTickets(ctx, {}),
    prisma.shiftNote.findMany({
      where: {
        ...hotelFilter(ctx),
        ...(ctx.access.departmentId
          ? { OR: [{ departmentId: ctx.access.departmentId }, { departmentId: null }] }
          : {}),
      },
      select: {
        id: true,
        content: true,
        createdAt: true,
        author: { select: { name: true } },
        department: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const openTickets = myTickets.filter(
    (ticket) => ticket.status === "PENDING" || ticket.status === "IN_PROGRESS",
  );
  const unassigned = openTickets.filter((ticket) => !ticket.assignedTo);

  const overdueByDepartment = isStaff
    ? []
    : await prisma.ticket.groupBy({
        by: ["departmentId"],
        where: {
          ...hotelFilter(ctx),
          ...notDeleted,
          status: { in: ["PENDING", "IN_PROGRESS"] },
          slaDueAt: { lt: new Date() },
        },
        _count: { _all: true },
      });

  const departmentNames = new Map(
    (
      await prisma.department.findMany({
        where: hotelFilter(ctx),
        select: { id: true, name: true },
      })
    ).map((department) => [department.id, department.name]),
  );

  return (
    <>
      <PageHeader
        title={t("welcome", { name: ctx.user.name })}
        description={ctx.access.name}
        actions={
          <Button render={<Link href={`/${hotelId}/tickets/nuevo`} />}>
            <Plus className="size-4" aria-hidden="true" />
            {t("newTicket")}
          </Button>
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("pending")} value={counts.PENDING} />
        <StatCard label={t("inProgress")} value={counts.IN_PROGRESS} />
        <StatCard label={t("resolvedToday")} value={resolvedToday} />
        <StatCard label={t("overdue")} value={overdue} tone={overdue > 0 ? "danger" : undefined} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section>
          <h2 className="mb-1 text-lg font-semibold">{t("myTickets")}</h2>
          <p className="mb-3 text-sm text-muted-foreground">{t("myTicketsHint")}</p>
          {openTickets.length === 0 ? (
            <EmptyState message={t("noAccess")} />
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {openTickets.slice(0, 8).map((ticket) => (
                <li key={ticket.id}>
                  <TicketCard ticket={ticket} hotelId={hotelId} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-6">
          {!isStaff ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("unassigned")}</CardTitle>
                </CardHeader>
                <CardContent>
                  {unassigned.length === 0 ? (
                    <p className="text-sm text-muted-foreground">—</p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {unassigned.slice(0, 6).map((ticket) => (
                        <li key={ticket.id}>
                          <Link
                            href={`/${hotelId}/tickets/${ticket.id}`}
                            className="hover:underline"
                          >
                            {ticket.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("overdueByDepartment")}</CardTitle>
                </CardHeader>
                <CardContent>
                  {overdueByDepartment.length === 0 ? (
                    <p className="text-sm text-muted-foreground">—</p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {overdueByDepartment.map((row) => (
                        <li key={row.departmentId} className="flex justify-between">
                          <span>{departmentNames.get(row.departmentId) ?? "—"}</span>
                          <span className="font-medium text-destructive">
                            {row._count._all}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("latestShiftNotes")}</CardTitle>
            </CardHeader>
            <CardContent>
              {shiftNotes.length === 0 ? (
                <p className="text-sm text-muted-foreground">—</p>
              ) : (
                <ul className="space-y-3 text-sm">
                  {shiftNotes.map((note) => (
                    <li key={note.id}>
                      <p className="text-xs text-muted-foreground">
                        {note.author?.name ?? "—"}
                        {note.department ? ` · ${note.department.name}` : ""}
                      </p>
                      <p>{note.content}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "danger";
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p
          className={`text-3xl font-semibold tabular-nums ${
            tone === "danger" ? "text-destructive" : ""
          }`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
