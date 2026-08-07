import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { BillingActions } from "@/components/corporate/billing-actions";
import { requireUser } from "@/lib/hotel-scope";
import { canManageBilling } from "@/lib/auth/can";
import { getPlatformConfig } from "@/lib/platform-config";
import { isStripeConfigured } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

export default async function BillingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireUser();
  if (!canManageBilling(user) || !user.organizationId) notFound();

  const t = await getTranslations("billing");
  const tStatus = await getTranslations("enums.subscriptionStatus");
  const format = await getFormatter();
  const config = await getPlatformConfig();

  const organization = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    select: {
      name: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      pricePerHotelSnapshot: true,
      currencySnapshot: true,
      stripeSubscriptionId: true,
      _count: { select: { hotels: true } },
    },
  });
  if (!organization) notFound();

  const licensedHotels = await prisma.hotel.count({
    where: { organizationId: user.organizationId, billingStatus: "ACTIVE" },
  });

  // Un cliente que ya paga conserva el precio con el que se suscribió; uno nuevo
  // ve el precio de lista vigente.
  const price = organization.pricePerHotelSnapshot
    ? Number(organization.pricePerHotelSnapshot)
    : config.pricePerHotelMonthly;
  const currency = organization.currencySnapshot ?? config.currency;

  return (
    <>
      <PageHeader title={t("title")} description={organization.name} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("plan")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-muted-foreground">{t("pricePerHotel")}</dt>
                <dd className="text-2xl font-semibold tabular-nums">
                  {format.number(price, { style: "currency", currency })}
                  <span className="text-base font-normal text-muted-foreground">
                    {t("perMonth")}
                  </span>
                </dd>
              </div>

              <div>
                <dt className="text-sm text-muted-foreground">
                  {t("licensedHotels")}
                </dt>
                <dd className="text-2xl font-semibold tabular-nums">
                  {licensedHotels}
                </dd>
              </div>

              <div>
                <dt className="text-sm text-muted-foreground">
                  {tStatus(organization.subscriptionStatus)}
                </dt>
                <dd>
                  <Badge
                    variant={
                      organization.subscriptionStatus === "ACTIVE"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {tStatus(organization.subscriptionStatus)}
                  </Badge>
                </dd>
              </div>

              {organization.trialEndsAt ? (
                <div>
                  <dt className="text-sm text-muted-foreground">
                    {t("trialEnds", {
                      date: format.dateTime(organization.trialEndsAt, "date"),
                    })}
                  </dt>
                </div>
              ) : null}
            </dl>

            <BillingActions
              locale={locale}
              hasSubscription={Boolean(organization.stripeSubscriptionId)}
              stripeConfigured={isStripeConfigured()}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("upgradeTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>{t("upgradeTrialLimit", { limit: config.trialHotelLimit })}</p>
            <p className="tabular-nums">
              {licensedHotels} ×{" "}
              {format.number(price, { style: "currency", currency })} ={" "}
              <strong className="text-foreground">
                {format.number(licensedHotels * price, {
                  style: "currency",
                  currency,
                })}
              </strong>
              {t("perMonth")}
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
