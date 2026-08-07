import { differenceInCalendarDays } from "date-fns";
import { getTranslations } from "next-intl/server";
import { AlertTriangle, Clock } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { CurrentUser } from "@/lib/auth/session";

/// Aviso persistente del estado de la suscripción. Nunca depende solo del color:
/// lleva ícono y texto, para que se entienda igual con daltonismo.
export async function TrialBanner({
  organization,
}: {
  organization: CurrentUser["organization"];
}) {
  if (!organization) return null;

  const t = await getTranslations("billing");
  const status = organization.subscriptionStatus;

  if (status === "ACTIVE") return null;

  if (status === "TRIALING") {
    const daysLeft = organization.trialEndsAt
      ? differenceInCalendarDays(organization.trialEndsAt, new Date())
      : null;

    // Solo se avisa cuando de verdad está por vencer: un banner permanente
    // durante 14 días se vuelve ruido y deja de leerse.
    if (daysLeft === null || daysLeft > 3) return null;

    return (
      <Banner tone="warning">
        <Clock className="size-4 shrink-0" aria-hidden="true" />
        <span>{t("trialEndsSoon", { days: Math.max(daysLeft, 0) })}</span>
        <Link href="/corporativo/facturacion" className="font-medium underline">
          {t("subscribe")}
        </Link>
      </Banner>
    );
  }

  const messageKey =
    status === "PAST_DUE"
      ? "upgradePastDue"
      : status === "CANCELLED"
        ? "upgradeCancelled"
        : "upgradeExpired";

  return (
    <Banner tone="danger">
      <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
      <span>{t(messageKey)}</span>
      <Link href="/corporativo/facturacion" className="font-medium underline">
        {t("manageSubscription")}
      </Link>
    </Banner>
  );
}

function Banner({
  tone,
  children,
}: {
  tone: "warning" | "danger";
  children: React.ReactNode;
}) {
  const classes =
    tone === "danger"
      ? "bg-destructive/10 text-destructive"
      : "bg-amber-500/10 text-amber-700 dark:text-amber-400";

  return (
    <div
      role="status"
      className={`flex flex-wrap items-center justify-center gap-2 px-4 py-2 text-sm ${classes}`}
    >
      {children}
    </div>
  );
}
