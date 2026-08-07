"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/page-header";
import { FormError } from "@/components/form-error";
import { createSupplyItem, setSupplyItemActive } from "@/lib/actions/supplies";

type Supply = {
  id: string;
  name: string;
  active: boolean;
  _count: { usages: number };
};

export function SuppliesManager({
  hotelId,
  supplies,
}: {
  hotelId: string;
  supplies: Supply[];
}) {
  const t = useTranslations("supplies");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = String(new FormData(form).get("name") ?? "");
    setErrorKey(null);

    startTransition(async () => {
      const result = await createSupplyItem({ hotelId, name });
      if (!result.ok) {
        setErrorKey(result.errorKey);
        return;
      }
      toast.success(t("created"));
      form.reset();
      router.refresh();
    });
  }

  function toggle(supply: Supply) {
    startTransition(async () => {
      const result = await setSupplyItemActive(hotelId, supply.id, !supply.active);
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1 space-y-2">
              <Label htmlFor="name">{t("new")}</Label>
              <Input
                id="name"
                name="name"
                required
                minLength={2}
                placeholder="Pilas AA"
              />
            </div>
            <Button type="submit" disabled={isPending}>
              <Plus className="size-4" aria-hidden="true" />
              {tCommon("add")}
            </Button>
          </form>
          <div className="mt-2">
            <FormError errorKey={errorKey} />
          </div>
        </CardContent>
      </Card>

      {supplies.length === 0 ? (
        <EmptyState message={t("empty")} />
      ) : (
        <Card>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tCommon("name")}</TableHead>
                  <TableHead>{t("totalQuantity")}</TableHead>
                  <TableHead className="text-right">{tCommon("active")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supplies.map((supply) => (
                  <TableRow key={supply.id}>
                    <TableCell className="font-medium">{supply.name}</TableCell>
                    <TableCell>{supply._count.usages}</TableCell>
                    <TableCell className="text-right">
                      <Switch
                        checked={supply.active}
                        disabled={isPending}
                        onCheckedChange={() => toggle(supply)}
                        aria-label={`${tCommon("active")} ${supply.name}`}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
