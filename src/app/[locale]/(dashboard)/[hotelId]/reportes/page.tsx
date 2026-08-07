import { getTranslations } from "next-intl/server";
import { subDays } from "date-fns";
import { PageHeader } from "@/components/page-header";
import { MetricsView } from "@/components/reports/metrics-view";
import { requireHotelContext } from "@/lib/hotel-scope";
import { getDepartmentMetrics, getHotelMetrics } from "@/lib/queries/metrics";
import { canViewCrossHotelReports } from "@/lib/auth/can";
import { operableHotels } from "@/lib/auth/session";

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ hotelId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { hotelId } = await params;
  const query = await searchParams;
  const ctx = await requireHotelContext(hotelId);
  const t = await getTranslations("nav");

  const days = Number(query.days) || 30;
  const from = subDays(new Date(), days);
  const to = new Date();

  // Quien administra varias propiedades ve el comparativo entre las suyas, no
  // solo el hotel en el que está parado (sección 4.4).
  const comparable = canViewCrossHotelReports(ctx.user);
  const scope = comparable
    ? operableHotels(ctx.user).map((hotel) => hotel.id)
    : [ctx.hotelId];

  const [hotelMetrics, departmentMetrics] = await Promise.all([
    getHotelMetrics(scope, from, to),
    getDepartmentMetrics([ctx.hotelId], from, to),
  ]);

  return (
    <>
      <PageHeader title={t("reports")} description={ctx.access.name} />
      <MetricsView
        hotelId={hotelId}
        hotelMetrics={hotelMetrics}
        departmentMetrics={departmentMetrics}
        days={days}
        showComparison={comparable && hotelMetrics.length > 1}
      />
    </>
  );
}
