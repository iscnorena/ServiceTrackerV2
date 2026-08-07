import { getFormatter, getTranslations } from "next-intl/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader, EmptyState } from "@/components/page-header";
import { OrganizationActions } from "@/components/platform/organization-actions";
import { requirePlatformOwner } from "@/lib/hotel-scope";
import { getPlatformConfig } from "@/lib/platform-config";
import { prisma } from "@/lib/prisma";

/// Vista del negocio de licenciamiento: quiénes son los clientes, en qué estado
/// están y cuánto ingresa al mes. Deliberadamente NO da acceso a sus datos
/// operativos — solo a lo necesario para operar el licenciamiento.
export default async function OrganizationsPage() {
  await requirePlatformOwner();

  const t = await getTranslations("platform");
  const tStatus = await getTranslations("enums.subscriptionStatus");
  const format = await getFormatter();
  const config = await getPlatformConfig();

  const organizations = await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      pricePerHotelSnapshot: true,
      currencySnapshot: true,
      createdAt: true,
      _count: { select: { users: true } },
      hotels: { where: { billingStatus: "ACTIVE" }, select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const mrr = organizations
    .filter((organization) => organization.subscriptionStatus === "ACTIVE")
    .reduce((total, organization) => {
      const price = organization.pricePerHotelSnapshot
        ? Number(organization.pricePerHotelSnapshot)
        : config.pricePerHotelMonthly;
      return total + price * organization.hotels.length;
    }, 0);

  const counts = {
    active: organizations.filter((o) => o.subscriptionStatus === "ACTIVE").length,
    trialing: organizations.filter((o) => o.subscriptionStatus === "TRIALING").length,
    expired: organizations.filter((o) =>
      ["EXPIRED", "CANCELLED", "PAST_DUE"].includes(o.subscriptionStatus),
    ).length,
  };

  return (
    <>
      <PageHeader title={t("organizations")} description={t("noOperationalAccess")} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label={t("mrr")}
          value={format.number(mrr, { style: "currency", currency: config.currency })}
        />
        <Stat label={t("activeClients")} value={String(counts.active)} />
        <Stat label={t("trialingClients")} value={String(counts.trialing)} />
        <Stat label={t("expiredClients")} value={String(counts.expired)} />
      </div>

      {organizations.length === 0 ? (
        <EmptyState message={t("organizations")} />
      ) : (
        <Card>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("orgName")}</TableHead>
                  <TableHead>{tStatus("ACTIVE")}</TableHead>
                  <TableHead>{t("hotelsCount")}</TableHead>
                  <TableHead>{t("usersCount")}</TableHead>
                  <TableHead className="text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizations.map((organization) => (
                  <TableRow key={organization.id}>
                    <TableCell>
                      <p className="font-medium">{organization.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format.dateTime(organization.createdAt, "date")}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          organization.subscriptionStatus === "ACTIVE"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {tStatus(organization.subscriptionStatus)}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {organization.hotels.length}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {organization._count.users}
                    </TableCell>
                    <TableCell className="text-right">
                      <OrganizationActions
                        organizationId={organization.id}
                        name={organization.name}
                        status={organization.subscriptionStatus}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
