"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Mail, Plus } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/native-select";
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
import { ConfirmButton } from "@/components/confirm-button";
import {
  inviteUserToHotel,
  resendInvite,
  setCanDeleteTickets,
  updateHotelAccess,
} from "@/lib/actions/users";

type Option = { id: string; name: string };

type Access = {
  id: string;
  permissionLevel: "STAFF" | "ADMIN";
  departmentId: string | null;
  canDeleteTickets: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    status: "INVITED" | "ACTIVE" | "DISABLED";
  };
};

export function HotelUsersManager({
  hotelId,
  access,
  departments,
  canGrantDelete,
  currentUserId,
}: {
  hotelId: string;
  access: Access[];
  departments: Option[];
  canGrantDelete: boolean;
  currentUserId: string;
}) {
  const t = useTranslations("users");
  const tCommon = useTranslations("common");
  const tLevel = useTranslations("enums.permissionLevel");
  const tStatus = useTranslations("enums.userStatus");
  const [inviting, setInviting] = useState(false);

  return (
    <div className="space-y-6">
      {inviting ? (
        <InviteForm
          hotelId={hotelId}
          departments={departments}
          onDone={() => setInviting(false)}
        />
      ) : (
        <Button onClick={() => setInviting(true)}>
          <Plus className="size-4" aria-hidden="true" />
          {t("invite")}
        </Button>
      )}

      {access.length === 0 ? (
        <EmptyState message={t("empty")} />
      ) : (
        <Card>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tCommon("name")}</TableHead>
                  <TableHead>{t("level")}</TableHead>
                  <TableHead>{t("department")}</TableHead>
                  <TableHead>{tCommon("status")}</TableHead>
                  {canGrantDelete ? <TableHead>{t("canDeleteTickets")}</TableHead> : null}
                  <TableHead className="text-right">{tCommon("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {access.map((row) => (
                  <UserRow
                    key={row.id}
                    row={row}
                    hotelId={hotelId}
                    departments={departments}
                    canGrantDelete={canGrantDelete}
                    isSelf={row.user.id === currentUserId}
                    labels={{ tLevel, tStatus }}
                  />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {canGrantDelete ? (
        <p className="text-sm text-muted-foreground">{t("canDeleteTicketsHint")}</p>
      ) : null}
    </div>
  );
}

function UserRow({
  row,
  hotelId,
  departments,
  canGrantDelete,
  isSelf,
  labels,
}: {
  row: Access;
  hotelId: string;
  departments: Option[];
  canGrantDelete: boolean;
  isSelf: boolean;
  labels: {
    tLevel: (key: string) => string;
    tStatus: (key: string) => string;
  };
}) {
  const t = useTranslations("users");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function saveAccess(next: Partial<Pick<Access, "permissionLevel" | "departmentId">>) {
    startTransition(async () => {
      const result = await updateHotelAccess({
        hotelId,
        userId: row.user.id,
        permissionLevel: next.permissionLevel ?? row.permissionLevel,
        departmentId:
          next.departmentId !== undefined ? next.departmentId : row.departmentId,
      });
      if (!result.ok) {
        toast.error(tCommon("empty"));
        return;
      }
      toast.success(t("updated"));
      router.refresh();
    });
  }

  function toggleDelete() {
    startTransition(async () => {
      const result = await setCanDeleteTickets(
        row.user.id,
        !row.canDeleteTickets,
        hotelId,
      );
      if (!result.ok) {
        toast.error(tCommon("empty"));
        return;
      }
      toast.success(t("updated"));
      router.refresh();
    });
  }

  function resend() {
    startTransition(async () => {
      const result = await resendInvite(hotelId, row.user.id);
      if (result.ok) toast.success(t("inviteSent", { email: row.user.email }));
    });
  }

  return (
    <TableRow>
      <TableCell>
        <p className="font-medium">{row.user.name}</p>
        <p className="text-xs text-muted-foreground">{row.user.email}</p>
      </TableCell>

      <TableCell>
        <NativeSelect
          aria-label={t("level")}
          className="w-28"
          value={row.permissionLevel}
          disabled={isPending || isSelf}
          onChange={(event) =>
            saveAccess({ permissionLevel: event.target.value as Access["permissionLevel"] })
          }
        >
          {(["STAFF", "ADMIN"] as const).map((level) => (
            <option key={level} value={level}>
              {labels.tLevel(level)}
            </option>
          ))}
        </NativeSelect>
      </TableCell>

      <TableCell>
        <NativeSelect
          aria-label={t("department")}
          className="w-40"
          value={row.departmentId ?? ""}
          disabled={isPending}
          onChange={(event) => saveAccess({ departmentId: event.target.value || null })}
        >
          <option value="">{tCommon("none")}</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </NativeSelect>
      </TableCell>

      <TableCell>
        <Badge variant={row.user.status === "ACTIVE" ? "default" : "secondary"}>
          {labels.tStatus(row.user.status)}
        </Badge>
      </TableCell>

      {canGrantDelete ? (
        <TableCell>
          {/* Un STAFF no puede recibir este permiso: no es que esté apagado, es
              que no aplica. Por eso se muestra un guion y no un switch en off. */}
          {row.permissionLevel === "STAFF" ? (
            <span className="text-sm text-muted-foreground">—</span>
          ) : (
            <ConfirmButton
              variant={row.canDeleteTickets ? "destructive" : "outline"}
              size="sm"
              disabled={isPending}
              title={t("canDeleteTickets")}
              description={
                row.canDeleteTickets
                  ? t("revokeDeleteConfirm", { name: row.user.name })
                  : t("grantDeleteConfirm", { name: row.user.name })
              }
              onConfirm={toggleDelete}
            >
              {row.canDeleteTickets ? tCommon("yes") : tCommon("no")}
            </ConfirmButton>
          )}
        </TableCell>
      ) : null}

      <TableCell className="text-right">
        {row.user.status === "INVITED" ? (
          <Button variant="ghost" size="sm" onClick={resend} disabled={isPending}>
            <Mail className="size-4" aria-hidden="true" />
            {t("resendInvite")}
          </Button>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

function InviteForm({
  hotelId,
  departments,
  onDone,
}: {
  hotelId: string;
  departments: Option[];
  onDone: () => void;
}) {
  const t = useTranslations("users");
  const tCommon = useTranslations("common");
  const tLevel = useTranslations("enums.permissionLevel");
  const router = useRouter();
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setErrorKey(null);

    startTransition(async () => {
      const result = await inviteUserToHotel({
        hotelId,
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
        permissionLevel: String(form.get("permissionLevel") ?? "STAFF") as
          | "STAFF"
          | "ADMIN",
        departmentId: (form.get("departmentId") as string) || null,
      });

      if (!result.ok) {
        setErrorKey(result.errorKey);
        return;
      }

      toast.success(t("inviteSent", { email: result.data.email }));
      onDone();
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="name">{tCommon("name")}</Label>
              <Input id="name" name="name" required minLength={2} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{tCommon("email")}</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="permissionLevel">{t("level")}</Label>
              <NativeSelect id="permissionLevel" name="permissionLevel" defaultValue="STAFF">
                {(["STAFF", "ADMIN"] as const).map((level) => (
                  <option key={level} value={level}>
                    {tLevel(level)}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="departmentId">{t("department")}</Label>
              <NativeSelect id="departmentId" name="departmentId" defaultValue="">
                <option value="">{tCommon("none")}</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>

          <FormError errorKey={errorKey} />

          <div className="flex gap-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? tCommon("saving") : t("invite")}
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
