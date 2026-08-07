"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Download } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/native-select";
import { EmptyState } from "@/components/page-header";
import type { DepartmentMetrics, HotelMetrics } from "@/lib/queries/metrics";

export function MetricsView({
  hotelId,
  hotelMetrics,
  departmentMetrics,
  days,
  showComparison,
}: {
  hotelId: string;
  hotelMetrics: HotelMetrics[];
  departmentMetrics: DepartmentMetrics[];
  days: number;
  showComparison: boolean;
}) {
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const current = hotelMetrics.find((metrics) => metrics.hotelId === hotelId);
  const exportHref = `/api/export/tickets?hotelId=${hotelId}&${searchParams.toString()}`;

  function setDays(value: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("days", value);
    router.replace(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-40 space-y-1">
          <Label htmlFor="days" className="text-xs text-muted-foreground">
            {t("last30Days")}
          </Label>
          <NativeSelect
            id="days"
            value={String(days)}
            onChange={(event) => setDays(event.target.value)}
          >
            <option value="7">7</option>
            <option value="30">30</option>
            <option value="90">90</option>
          </NativeSelect>
        </div>

        <Button variant="outline" render={<a href={exportHref} />}>
          <Download className="size-4" aria-hidden="true" />
          Excel
        </Button>
      </div>

      {current ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label={t("pending")} value={current.open} />
          <Stat label={t("resolvedToday")} value={current.resolved} />
          <Stat
            label={t("overdue")}
            value={current.overdue}
            tone={current.overdue > 0 ? "danger" : undefined}
          />
          <Stat
            label={t("slaCompliance")}
            value={current.slaCompliance === null ? "—" : `${current.slaCompliance}%`}
          />
        </div>
      ) : null}

      {current?.avgResolutionMinutes != null ? (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">{t("avgResolution")}</p>
            <p className="text-2xl font-semibold tabular-nums">
              {formatMinutes(current.avgResolutionMinutes)}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("ticketsByDepartment")}</CardTitle>
        </CardHeader>
        <CardContent>
          {departmentMetrics.length === 0 ? (
            <EmptyState message={tCommon("empty")} />
          ) : (
            <BarList
              rows={departmentMetrics.map((row) => ({
                label: row.departmentName,
                value: row.total,
                warning: row.overdue,
              }))}
            />
          )}
        </CardContent>
      </Card>

      {showComparison ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("compareHotels")}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-lg text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th scope="col" className="pb-2 font-normal">
                    {t("ticketsPerHotel")}
                  </th>
                  <th scope="col" className="pb-2 text-right font-normal">
                    {tCommon("all")}
                  </th>
                  <th scope="col" className="pb-2 text-right font-normal">
                    {t("overdue")}
                  </th>
                  <th scope="col" className="pb-2 text-right font-normal">
                    {t("slaCompliance")}
                  </th>
                  <th scope="col" className="pb-2 text-right font-normal">
                    {t("avgResolution")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {hotelMetrics.map((metrics) => (
                  <tr
                    key={metrics.hotelId}
                    className={metrics.hotelId === hotelId ? "font-medium" : undefined}
                  >
                    <td className="py-2">{metrics.hotelName || "—"}</td>
                    <td className="py-2 text-right tabular-nums">{metrics.total}</td>
                    <td className="py-2 text-right tabular-nums">
                      {metrics.overdue > 0 ? (
                        <span className="inline-flex items-center gap-1 text-destructive">
                          <AlertTriangle className="size-3.5" aria-hidden="true" />
                          {metrics.overdue}
                        </span>
                      ) : (
                        metrics.overdue
                      )}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {metrics.slaCompliance === null ? "—" : `${metrics.slaCompliance}%`}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {metrics.avgResolutionMinutes === null
                        ? "—"
                        : formatMinutes(metrics.avgResolutionMinutes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
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

/// Barras en CSS puro en vez de una librería de gráficas: son cinco filas de una
/// sola serie, y así el reporte no arrastra 50 KB de JavaScript al cliente.
function BarList({
  rows,
}: {
  rows: { label: string; value: number; warning: number }[];
}) {
  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="mb-1 flex justify-between text-sm">
            <span>{row.label}</span>
            <span className="tabular-nums">
              {row.value}
              {row.warning > 0 ? (
                <span className="ml-2 text-destructive">({row.warning})</span>
              ) : null}
            </span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={`${row.label}: ${row.value}`}
          >
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${(row.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
