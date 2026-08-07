"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/form-error";
import { updatePlatformConfig } from "@/lib/actions/platform";

export function PlatformConfigForm({
  config,
}: {
  config: {
    pricePerHotelMonthly: number;
    currency: string;
    trialDays: number;
    trialHotelLimit: number;
  };
}) {
  const t = useTranslations("platform");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setErrorKey(null);

    startTransition(async () => {
      const result = await updatePlatformConfig({
        pricePerHotelMonthly: Number(form.get("pricePerHotelMonthly")),
        currency: String(form.get("currency") ?? ""),
        trialDays: Number(form.get("trialDays")),
        trialHotelLimit: Number(form.get("trialHotelLimit")),
      });

      if (!result.ok) {
        setErrorKey(result.errorKey);
        return;
      }

      toast.success(t("configSaved"));
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pricePerHotelMonthly">{t("pricePerHotelMonthly")}</Label>
              <Input
                id="pricePerHotelMonthly"
                name="pricePerHotelMonthly"
                type="number"
                min={0}
                step="0.01"
                defaultValue={config.pricePerHotelMonthly}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">{t("currency")}</Label>
              <Input
                id="currency"
                name="currency"
                maxLength={3}
                minLength={3}
                defaultValue={config.currency}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="trialDays">{t("trialDays")}</Label>
              <Input
                id="trialDays"
                name="trialDays"
                type="number"
                min={0}
                defaultValue={config.trialDays}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="trialHotelLimit">{t("trialHotelLimit")}</Label>
              <Input
                id="trialHotelLimit"
                name="trialHotelLimit"
                type="number"
                min={1}
                defaultValue={config.trialHotelLimit}
                required
              />
            </div>
          </div>

          <FormError errorKey={errorKey} />

          <Button type="submit" disabled={isPending}>
            {isPending ? tCommon("saving") : tCommon("save")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
