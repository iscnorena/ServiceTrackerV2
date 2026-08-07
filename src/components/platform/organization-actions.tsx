"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { ConfirmButton } from "@/components/confirm-button";
import { setOrganizationStatus } from "@/lib/actions/platform";
import type { SubscriptionStatus } from "@/generated/prisma/enums";

export function OrganizationActions({
  organizationId,
  name,
  status,
}: {
  organizationId: string;
  name: string;
  status: SubscriptionStatus;
}) {
  const t = useTranslations("platform");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const cancelled = status === "CANCELLED";

  return (
    <ConfirmButton
      variant="ghost"
      size="sm"
      disabled={isPending}
      title={cancelled ? tCommon("enable") : t("suspendOrg")}
      description={name}
      onConfirm={() =>
        startTransition(async () => {
          const result = await setOrganizationStatus(
            organizationId,
            cancelled ? "ACTIVE" : "CANCELLED",
          );
          if (!result.ok) {
            toast.error(tCommon("empty"));
            return;
          }
          router.refresh();
        })
      }
    >
      {cancelled ? tCommon("enable") : tCommon("disable")}
    </ConfirmButton>
  );
}
