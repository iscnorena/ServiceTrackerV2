import { getTranslations } from "next-intl/server";
import { Building2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, EmptyState } from "@/components/page-header";
import { requireUser } from "@/lib/hotel-scope";
import { operableHotels } from "@/lib/auth/session";

/// Selector de propiedad para quien tiene acceso a más de una. Quien solo trabaja
/// en un hotel nunca llega aquí: entra directo desde la raíz.
export default async function HotelSelectorPage() {
  const user = await requireUser();
  const t = await getTranslations("nav");
  const tDashboard = await getTranslations("dashboard");
  const hotels = operableHotels(user);

  return (
    <>
      <PageHeader title={t("selectHotel")} />
      {hotels.length === 0 ? (
        <EmptyState message={tDashboard("noAccess")} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {hotels.map((hotel) => (
            <li key={hotel.id}>
              <Link href={`/${hotel.id}`}>
                <Card className="transition-colors hover:bg-accent/50">
                  <CardContent className="flex items-center gap-3 py-5">
                    <Building2
                      className="size-5 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{hotel.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {hotel.permissionLevel}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
