"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import { ConfirmButton } from "@/components/confirm-button";
import {
  setCanDeleteTickets,
  setCorporateRole,
  setUserStatus,
} from "@/lib/actions/users";
import type { CorporateRole, UserStatus } from "@/generated/prisma/enums";

type User = {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  corporateRole: CorporateRole;
  canDeleteTickets: boolean;
  hotelAccess: {
    permissionLevel: "STAFF" | "ADMIN";
    canDeleteTickets: boolean;
    hotel: { id: string; name: string };
  }[];
};

export function CorporateUsersManager({
  users,
  currentUserId,
}: {
  users: User[];
  currentUserId: string;
}) {
  const t = useTranslations("users");
  const tCommon = useTranslations("common");
  const tRole = useTranslations("enums.corporateRole");
  const tStatus = useTranslations("enums.userStatus");

  if (users.length === 0) return <EmptyState message={t("empty")} />;

  return (
    <Card>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tCommon("name")}</TableHead>
              <TableHead>{t("corporateRole")}</TableHead>
              <TableHead>{t("hotels")}</TableHead>
              <TableHead>{t("canDeleteTickets")}</TableHead>
              <TableHead>{tCommon("status")}</TableHead>
              <TableHead className="text-right">{tCommon("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                isSelf={user.id === currentUserId}
                labels={{ tRole, tStatus }}
              />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function UserRow({
  user,
  isSelf,
  labels,
}: {
  user: User;
  isSelf: boolean;
  labels: { tRole: (key: string) => string; tStatus: (key: string) => string };
}) {
  const t = useTranslations("users");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean }>, successKey: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(tCommon("empty"));
        return;
      }
      toast.success(successKey);
      router.refresh();
    });
  }

  const isSuperadmin = user.corporateRole === "SUPERADMIN";
  const isCorporate = user.corporateRole === "CORPORATE_ADMIN";
  const adminHotels = user.hotelAccess.filter((a) => a.permissionLevel === "ADMIN");

  return (
    <TableRow>
      <TableCell>
        <p className="font-medium">{user.name}</p>
        <p className="text-xs text-muted-foreground">{user.email}</p>
      </TableCell>

      <TableCell>
        <NativeSelect
          aria-label={t("corporateRole")}
          className="w-44"
          value={user.corporateRole}
          // Nadie se degrada a sí mismo: dejaría la organización sin superadmin.
          disabled={isPending || isSelf}
          onChange={(event) =>
            run(
              () =>
                setCorporateRole(
                  user.id,
                  event.target.value as CorporateRole,
                ),
              t("updated"),
            )
          }
        >
          {(["NONE", "CORPORATE_ADMIN", "SUPERADMIN"] as const).map((role) => (
            <option key={role} value={role}>
              {labels.tRole(role)}
            </option>
          ))}
        </NativeSelect>
      </TableCell>

      <TableCell className="text-sm">
        {user.corporateRole === "NONE" ? (
          user.hotelAccess.length === 0 ? (
            "—"
          ) : (
            user.hotelAccess.map((a) => a.hotel.name).join(", ")
          )
        ) : (
          <span className="text-muted-foreground">{tCommon("all")}</span>
        )}
      </TableCell>

      <TableCell>
        {isSuperadmin ? (
          // Un SUPERADMIN siempre puede: no hay flag que otorgar ni revocar.
          <Badge>{tCommon("yes")}</Badge>
        ) : isCorporate ? (
          <ConfirmButton
            variant={user.canDeleteTickets ? "destructive" : "outline"}
            size="sm"
            disabled={isPending}
            title={t("canDeleteTickets")}
            description={
              user.canDeleteTickets
                ? t("revokeDeleteConfirm", { name: user.name })
                : t("grantDeleteConfirm", { name: user.name })
            }
            onConfirm={() =>
              run(
                () => setCanDeleteTickets(user.id, !user.canDeleteTickets),
                t("updated"),
              )
            }
          >
            {user.canDeleteTickets ? tCommon("yes") : tCommon("no")}
          </ConfirmButton>
        ) : adminHotels.length > 0 ? (
          // Para un ADMIN el permiso es por hotel, así que se otorga desde la
          // pantalla de usuarios de esa propiedad, no desde aquí.
          <span className="text-sm text-muted-foreground">
            {adminHotels.filter((a) => a.canDeleteTickets).length}/{adminHotels.length}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </TableCell>

      <TableCell>
        <Badge variant={user.status === "ACTIVE" ? "default" : "secondary"}>
          {labels.tStatus(user.status)}
        </Badge>
      </TableCell>

      <TableCell className="text-right">
        {isSelf ? null : (
          <ConfirmButton
            variant="ghost"
            size="sm"
            disabled={isPending}
            title={user.status === "DISABLED" ? t("enable") : t("disable")}
            description={t("disableConfirm")}
            onConfirm={() =>
              run(
                () =>
                  setUserStatus(
                    user.id,
                    user.status === "DISABLED" ? "ACTIVE" : "DISABLED",
                  ),
                t("updated"),
              )
            }
          >
            {user.status === "DISABLED" ? tCommon("enable") : tCommon("disable")}
          </ConfirmButton>
        )}
      </TableCell>
    </TableRow>
  );
}
