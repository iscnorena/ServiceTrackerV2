"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import { createDepartment, updateDepartment } from "@/lib/actions/departments";

type Department = {
  id: string;
  name: string;
  defaultSlaMinutes: number | null;
  affectsRoomStatus: boolean;
  active: boolean;
  _count: { tickets: number };
};

export function DepartmentsManager({
  hotelId,
  departments,
}: {
  hotelId: string;
  departments: Department[];
}) {
  const t = useTranslations("departments");
  const tCommon = useTranslations("common");
  const [editing, setEditing] = useState<Department | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-6">
      {creating || editing ? (
        <DepartmentForm
          hotelId={hotelId}
          department={editing}
          onDone={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      ) : (
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" aria-hidden="true" />
          {t("new")}
        </Button>
      )}

      {departments.length === 0 ? (
        <EmptyState message={t("empty")} />
      ) : (
        <Card>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("sla")}</TableHead>
                  <TableHead>{t("affectsRoomStatus")}</TableHead>
                  <TableHead>{tCommon("status")}</TableHead>
                  <TableHead className="text-right">{tCommon("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((department) => (
                  <TableRow key={department.id}>
                    <TableCell className="font-medium">{department.name}</TableCell>
                    <TableCell>
                      {department.defaultSlaMinutes
                        ? `${department.defaultSlaMinutes} min`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {department.affectsRoomStatus ? tCommon("yes") : tCommon("no")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={department.active ? "default" : "secondary"}>
                        {department.active ? tCommon("active") : tCommon("inactive")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditing(department)}
                        aria-label={`${tCommon("edit")} ${department.name}`}
                      >
                        <Pencil className="size-4" aria-hidden="true" />
                      </Button>
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

function DepartmentForm({
  hotelId,
  department,
  onDone,
}: {
  hotelId: string;
  department: Department | null;
  onDone: () => void;
}) {
  const t = useTranslations("departments");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [affectsRoomStatus, setAffectsRoomStatus] = useState(
    department?.affectsRoomStatus ?? false,
  );
  const [active, setActive] = useState(department?.active ?? true);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const slaRaw = String(form.get("defaultSlaMinutes") ?? "").trim();
    setErrorKey(null);

    const payload = {
      hotelId,
      name: String(form.get("name") ?? ""),
      defaultSlaMinutes: slaRaw ? Number(slaRaw) : null,
      affectsRoomStatus,
      active,
    };

    startTransition(async () => {
      const result = department
        ? await updateDepartment(department.id, payload)
        : await createDepartment(payload);

      if (!result.ok) {
        setErrorKey(result.errorKey);
        return;
      }

      toast.success(department ? t("updated") : t("created"));
      onDone();
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">{t("name")}</Label>
              <Input
                id="name"
                name="name"
                defaultValue={department?.name}
                required
                minLength={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultSlaMinutes">{t("sla")}</Label>
              <Input
                id="defaultSlaMinutes"
                name="defaultSlaMinutes"
                type="number"
                min={1}
                defaultValue={department?.defaultSlaMinutes ?? ""}
                aria-describedby="sla-hint"
              />
              <p id="sla-hint" className="text-xs text-muted-foreground">
                {t("slaHint")}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Switch
              id="affectsRoomStatus"
              checked={affectsRoomStatus}
              onCheckedChange={setAffectsRoomStatus}
            />
            <div>
              <Label htmlFor="affectsRoomStatus">{t("affectsRoomStatus")}</Label>
              <p className="text-xs text-muted-foreground">
                {t("affectsRoomStatusHint")}
              </p>
            </div>
          </div>

          {department ? (
            <div className="flex items-center gap-3">
              <Switch id="active" checked={active} onCheckedChange={setActive} />
              <Label htmlFor="active">{tCommon("active")}</Label>
            </div>
          ) : null}

          <FormError errorKey={errorKey} />

          <div className="flex gap-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? tCommon("saving") : tCommon("save")}
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
