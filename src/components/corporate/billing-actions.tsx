"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CreditCard, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormError } from "@/components/form-error";
import { openBillingPortal, startCheckout } from "@/lib/actions/billing";

export function BillingActions({
  locale,
  hasSubscription,
  stripeConfigured,
}: {
  locale: string;
  hasSubscription: boolean;
  stripeConfigured: boolean;
}) {
  const t = useTranslations("billing");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!stripeConfigured) {
    return (
      <Alert>
        <AlertDescription>{t("stripeNotConfigured")}</AlertDescription>
      </Alert>
    );
  }

  function go(action: () => Promise<{ ok: boolean } & Record<string, unknown>>) {
    setErrorKey(null);
    startTransition(async () => {
      const result = (await action()) as
        | { ok: true; data: { url: string } }
        | { ok: false; errorKey: string };

      if (!result.ok) {
        setErrorKey(result.errorKey);
        return;
      }
      // Stripe aloja tanto el Checkout como el Portal, así que se sale de la app.
      window.location.href = result.data.url;
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {hasSubscription ? (
          <Button onClick={() => go(() => openBillingPortal(locale))} disabled={isPending}>
            <ExternalLink className="size-4" aria-hidden="true" />
            {t("manageSubscription")}
          </Button>
        ) : (
          <Button onClick={() => go(() => startCheckout(locale))} disabled={isPending}>
            <CreditCard className="size-4" aria-hidden="true" />
            {t("subscribe")}
          </Button>
        )}
      </div>

      <FormError errorKey={errorKey} />
    </div>
  );
}
