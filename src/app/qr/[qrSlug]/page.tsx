import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { GuestReportForm } from "@/components/qr/guest-report-form";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

/// Formulario público sin login. Solo muestra el número de habitación y el
/// nombre del hotel: nada de datos de otros huéspedes, ocupación o tickets.
export default async function GuestReportPage({
  params,
}: {
  params: Promise<{ qrSlug: string }>;
}) {
  const { qrSlug } = await params;
  const t = await getTranslations("qr");

  const room = await prisma.room.findUnique({
    where: { qrSlug },
    select: {
      number: true,
      active: true,
      hotel: { select: { name: true, billingStatus: true } },
    },
  });

  if (!room?.active || room.hotel.billingStatus !== "ACTIVE") {
    return (
      <Shell>
        <p className="text-center text-sm text-muted-foreground">
          {t("invalidRoom")}
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("subtitle", { room: room.number, hotel: room.hotel.name })}
        </p>
      </div>

      <GuestReportForm qrSlug={qrSlug} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <Card>
        <CardContent className="py-8">{children}</CardContent>
      </Card>
    </main>
  );
}
