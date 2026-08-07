import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { subDays } from "date-fns";
import { PageHeader } from "@/components/page-header";
import { SupplyReportView } from "@/components/corporate/supply-report-view";
import { requireUser } from "@/lib/hotel-scope";
import { canViewCrossHotelReports } from "@/lib/auth/can";
import { operableHotels } from "@/lib/auth/session";
import { getRecurringSupplyReport } from "@/lib/queries/supply-report";

export default async function RecurringSuppliesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  // Aplica a cualquiera con más de un hotel, no solo a los roles corporativos.
  if (!canViewCrossHotelReports(user)) notFound();

  const query = await searchParams;
  const t = await getTranslations("supplies");

  const days = Number(query.days) || 90;
  const minRepetitions = Number(query.min) || 1;
  const selectedHotels = query.hotels?.split(",").filter(Boolean);

  const report = await getRecurringSupplyReport(user, {
    from: subDays(new Date(), days),
    to: new Date(),
    hotelIds: selectedHotels,
    minRepetitions,
  });

  return (
    <>
      <PageHeader title={t("recurringTitle")} description={t("recurringSubtitle")} />
      <SupplyReportView
        rows={report.rows}
        totalHotels={report.totalHotels}
        hotels={operableHotels(user).map((hotel) => ({
          id: hotel.id,
          name: hotel.name,
        }))}
        days={days}
        minRepetitions={minRepetitions}
        selectedHotels={selectedHotels ?? []}
      />
    </>
  );
}
