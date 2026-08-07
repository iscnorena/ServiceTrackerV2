"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight, Download, Info } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { NativeSelect } from "@/components/native-select";
import { EmptyState } from "@/components/page-header";
import type { SupplyReportRow } from "@/lib/queries/supply-report";

export function SupplyReportView({
  rows,
  totalHotels,
  hotels,
  days,
  minRepetitions,
  selectedHotels,
}: {
  rows: SupplyReportRow[];
  totalHotels: number;
  hotels: { id: string; name: string }[];
  days: number;
  minRepetitions: number;
  selectedHotels: string[];
}) {
  const t = useTranslations("supplies");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`);
  }

  function toggleHotel(hotelId: string) {
    const current = new Set(selectedHotels);
    if (current.has(hotelId)) current.delete(hotelId);
    else current.add(hotelId);
    setParam("hotels", current.size > 0 ? [...current].join(",") : null);
  }

  const exportHref = `/api/export/supplies?${searchParams.toString()}`;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 py-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-40 space-y-1">
              <Label htmlFor="days" className="text-xs text-muted-foreground">
                {t("dateRange")}
              </Label>
              <NativeSelect
                id="days"
                value={String(days)}
                onChange={(event) => setParam("days", event.target.value)}
              >
                <option value="30">30</option>
                <option value="90">90</option>
                <option value="180">180</option>
                <option value="365">365</option>
              </NativeSelect>
            </div>

            <div className="min-w-40 space-y-1">
              <Label htmlFor="min" className="text-xs text-muted-foreground">
                {t("minRepetitions")}
              </Label>
              <NativeSelect
                id="min"
                value={String(minRepetitions)}
                onChange={(event) => setParam("min", event.target.value)}
              >
                {[1, 2, 3, 5, 10].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <Button variant="outline" render={<a href={exportHref} />}>
              <Download className="size-4" aria-hidden="true" />
              Excel
            </Button>
          </div>

          {hotels.length > 1 ? (
            <fieldset>
              <legend className="mb-2 text-xs text-muted-foreground">
                {t("hotelsCount")}
              </legend>
              <div className="flex flex-wrap gap-4">
                {hotels.map((hotel) => (
                  <div key={hotel.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`hotel-${hotel.id}`}
                      checked={
                        selectedHotels.length === 0 || selectedHotels.includes(hotel.id)
                      }
                      onCheckedChange={() => toggleHotel(hotel.id)}
                    />
                    <Label htmlFor={`hotel-${hotel.id}`} className="font-normal">
                      {hotel.name}
                    </Label>
                  </div>
                ))}
              </div>
            </fieldset>
          ) : null}
        </CardContent>
      </Card>

      {/* La advertencia va arriba y no en letra chica: quien lee esto está por
          tomar una decisión de compra, y debe saber que la agrupación es una
          aproximación por nombre normalizado, no una coincidencia exacta. */}
      <Alert>
        <Info className="size-4" aria-hidden="true" />
        <AlertDescription>{t("normalizationNote")}</AlertDescription>
      </Alert>

      {rows.length === 0 ? (
        <EmptyState message={t("empty")} />
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <SupplyRow key={row.normalizedName} row={row} totalHotels={totalHotels} />
          ))}
        </ul>
      )}
    </div>
  );
}

function SupplyRow({
  row,
  totalHotels,
}: {
  row: SupplyReportRow;
  totalHotels: number;
}) {
  const t = useTranslations("supplies");
  const [open, setOpen] = useState(false);

  return (
    <li>
      <Card>
        <CardContent className="py-4">
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
            className="flex w-full items-center gap-3 text-left"
          >
            {open ? (
              <ChevronDown className="size-4 shrink-0" aria-hidden="true" />
            ) : (
              <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
            )}

            <span className="min-w-0 flex-1">
              <span className="block font-medium">{row.displayName}</span>
              <span className="block text-sm text-muted-foreground">
                {t("appearsIn", { count: row.hotelCount, total: totalHotels })}
              </span>
            </span>

            <span className="text-right">
              <span className="block text-2xl font-semibold tabular-nums">
                {row.totalQuantity}
              </span>
              <span className="block text-xs text-muted-foreground">
                {t("totalQuantity")}
              </span>
            </span>
          </button>

          {open ? (
            <table className="mt-4 w-full text-sm">
              <caption className="sr-only">{t("capturedAs")}</caption>
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th scope="col" className="pb-1 font-normal">
                    {t("hotelsCount")}
                  </th>
                  <th scope="col" className="pb-1 font-normal">
                    {t("capturedAs")}
                  </th>
                  <th scope="col" className="pb-1 text-right font-normal">
                    {t("totalQuantity")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {row.breakdown.map((entry) => (
                  <tr key={`${entry.hotelId}-${entry.capturedName}`}>
                    <td className="py-1">{entry.hotelName}</td>
                    <td className="py-1 text-muted-foreground">{entry.capturedName}</td>
                    <td className="py-1 text-right tabular-nums">{entry.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </CardContent>
      </Card>
    </li>
  );
}
