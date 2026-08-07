import { getTranslations } from "next-intl/server";
import { Lock } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SubscriptionStatus } from "@/generated/prisma/enums";

type GateStatus = SubscriptionStatus | "SUSPENDED_HOTEL" | undefined;

const MESSAGE_KEY: Record<string, string> = {
  PAST_DUE: "upgradePastDue",
  CANCELLED: "upgradeCancelled",
  EXPIRED: "upgradeExpired",
  TRIALING: "upgradeExpired",
  SUSPENDED_HOTEL: "upgradeExpired",
};

/// Se muestra en vez del dashboard cuando la organización no puede operar.
/// Los datos no se borran ni se tocan: solo se restringe el acceso.
export async function SubscriptionGate({ status }: { status: GateStatus }) {
  const t = await getTranslations("billing");

  return (
    <div className="mx-auto max-w-lg py-16">
      <Card>
        <CardHeader className="items-center text-center">
          <Lock className="size-8 text-muted-foreground" aria-hidden="true" />
          <CardTitle>{t("upgradeTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <p className="text-sm text-muted-foreground">
            {t(MESSAGE_KEY[status ?? "EXPIRED"] ?? "upgradeExpired")}
          </p>
          <Button render={<Link href="/corporativo/facturacion" />}>
            {t("manageSubscription")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
