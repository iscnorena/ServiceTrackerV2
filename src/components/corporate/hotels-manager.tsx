"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Building2, Plus } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EmptyState } from "@/components/page-header";
import { FormError } from "@/components/form-error";
import { createHotel, setHotelBillingStatus } from "@/lib/actions/hotels";

type Hotel = {
  id: string;
  name: string;
  address: string | null;
  timezone: string | null;
  billingStatus: "ACTIVE" | "SUSPENDED";
  _count: { rooms: number; tickets: number };
};

export function HotelsManager({
  hotels,
  canManage,
  isTrialing,
  trialHotelLimit,
}: {
  hotels: Hotel[];
  canManage: boolean;
  isTrialing: boolean;
  trialHotelLimit: number;
}) {
  const t = useTranslations("hotels");
  const tCommon = useTranslations("common");
  const [creating, setCreating] = useState(false);

  const activeCount = hotels.filter((hotel) => hotel.billingStatus === "ACTIVE").length;
  const atTrialLimit = isTrialing && activeCount >= trialHotelLimit;

  return (
    <div className="space-y-6">
      {atTrialLimit ? (
        <Alert>
          <AlertDescription className="flex flex-wrap items-center gap-2">
            {t("trialLimitReached", { limit: trialHotelLimit })}
            <Link href="/corporativo/facturacion" className="font-medium underline">
              {t("upgradeNow")}
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}

      {canManage ? (
        creating ? (
          <HotelForm onDone={() => setCreating(false)} />
        ) : (
          <Button onClick={() => setCreating(true)} disabled={atTrialLimit}>
            <Plus className="size-4" aria-hidden="true" />
            {t("new")}
          </Button>
        )
      ) : null}

      {hotels.length === 0 ? (
        <EmptyState message={t("empty")} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {hotels.map((hotel) => (
            <li key={hotel.id}>
              <HotelCard hotel={hotel} canManage={canManage} />
            </li>
          ))}
        </ul>
      )}

      <p className="text-sm text-muted-foreground">
        {tCommon("active")}: {activeCount}
      </p>
    </div>
  );
}

function HotelCard({ hotel, canManage }: { hotel: Hotel; canManage: boolean }) {
  const t = useTranslations("hotels");
  const tCommon = useTranslations("common");
  const tNav = useTranslations("nav");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const suspended = hotel.billingStatus === "SUSPENDED";

  function toggle() {
    startTransition(async () => {
      const result = await setHotelBillingStatus(
        hotel.id,
        suspended ? "ACTIVE" : "SUSPENDED",
      );
      if (!result.ok) {
        toast.error(tCommon("empty"));
        return;
      }
      toast.success(t("updated"));
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-medium">
              <Building2 className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{hotel.name}</span>
            </p>
            {hotel.address ? (
              <p className="truncate text-sm text-muted-foreground">{hotel.address}</p>
            ) : null}
          </div>
          {suspended ? <Badge variant="secondary">{tCommon("inactive")}</Badge> : null}
        </div>

        <p className="text-sm text-muted-foreground">
          {hotel._count.rooms} · {hotel._count.tickets}
        </p>

        <div className="flex flex-wrap gap-2">
          {!suspended ? (
            <Button size="sm" variant="outline" render={<Link href={`/${hotel.id}`} />}>
              {tNav("dashboard")}
            </Button>
          ) : null}

          {canManage ? (
            <Button
              size="sm"
              variant={suspended ? "outline" : "ghost"}
              onClick={toggle}
              disabled={isPending}
            >
              {suspended ? t("reactivate") : t("suspend")}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function HotelForm({ onDone }: { onDone: () => void }) {
  const t = useTranslations("hotels");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setErrorKey(null);

    startTransition(async () => {
      const result = await createHotel({
        name: String(form.get("name") ?? ""),
        address: String(form.get("address") ?? "") || null,
        timezone: String(form.get("timezone") ?? "") || null,
      });

      if (!result.ok) {
        setErrorKey(result.errorKey);
        return;
      }

      toast.success(t("created"));
      onDone();
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="name">{t("name")}</Label>
              <Input id="name" name="name" required minLength={2} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">{t("address")}</Label>
              <Input id="address" name="address" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">{t("timezone")}</Label>
              <Input
                id="timezone"
                name="timezone"
                defaultValue="America/Mexico_City"
                placeholder="America/Mexico_City"
              />
            </div>
          </div>

          <FormError errorKey={errorKey} />

          <div className="flex gap-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? tCommon("saving") : tCommon("create")}
            </Button>
            <Button type="button" variant="ghost" onClick={onDone}>
              {tCommon("cancel")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
