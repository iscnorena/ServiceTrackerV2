"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil, Plus, Printer, QrCode } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { createRoom, updateRoom } from "@/lib/actions/rooms";
import type { RoomStatus } from "@/generated/prisma/enums";

type Room = {
  id: string;
  number: string;
  floor: string | null;
  status: RoomStatus;
  qrSlug: string;
  roomStays: { id: string; contactName: string; contactPhone: string | null }[];
};

const STATUS_CLASS: Record<RoomStatus, string> = {
  AVAILABLE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  OCCUPIED: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  MAINTENANCE: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
};

export function RoomsManager({
  hotelId,
  rooms,
  canManage,
}: {
  hotelId: string;
  rooms: Room[];
  canManage: boolean;
}) {
  const t = useTranslations("rooms");
  const tCommon = useTranslations("common");
  const tStatus = useTranslations("enums.roomStatus");
  const [editing, setEditing] = useState<Room | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-6">
      {canManage ? (
        creating || editing ? (
          <RoomForm
            hotelId={hotelId}
            room={editing}
            onDone={() => {
              setCreating(false);
              setEditing(null);
            }}
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" aria-hidden="true" />
              {t("new")}
            </Button>
            {/* Imprimir todos de una vez es lo que hace viable la instalación
                inicial: nadie va a exportar cuarto por cuarto 60 veces. */}
            <Button
              variant="outline"
              render={<a href={`/${hotelId}/habitaciones/imprimir`} target="_blank" rel="noreferrer" />}
            >
              <Printer className="size-4" aria-hidden="true" />
              {t("printAllQr")}
            </Button>
          </div>
        )
      ) : null}

      {rooms.length === 0 ? (
        <EmptyState message={t("empty")} />
      ) : (
        <Card>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("number")}</TableHead>
                  <TableHead>{t("floor")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("currentStay")}</TableHead>
                  <TableHead className="text-right">{tCommon("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rooms.map((room) => {
                  const stay = room.roomStays[0];
                  return (
                    <TableRow key={room.id}>
                      <TableCell className="font-medium">{room.number}</TableCell>
                      <TableCell>{room.floor ?? "—"}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_CLASS[room.status]}>
                          {tStatus(room.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {stay ? (
                          <span className="text-sm">
                            {stay.contactName}
                            {stay.contactPhone ? (
                              <span className="text-muted-foreground">
                                {" · "}
                                {stay.contactPhone}
                              </span>
                            ) : null}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="space-x-1 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`${t("printQr")} ${room.number}`}
                          render={
                            <a
                              href={`/${hotelId}/habitaciones/imprimir?room=${room.id}`}
                              target="_blank"
                              rel="noreferrer"
                            />
                          }
                        >
                          <QrCode className="size-4" aria-hidden="true" />
                        </Button>
                        {canManage ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditing(room)}
                            aria-label={`${tCommon("edit")} ${room.number}`}
                          >
                            <Pencil className="size-4" aria-hidden="true" />
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RoomForm({
  hotelId,
  room,
  onDone,
}: {
  hotelId: string;
  room: Room | null;
  onDone: () => void;
}) {
  const t = useTranslations("rooms");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setErrorKey(null);

    const payload = {
      hotelId,
      number: String(form.get("number") ?? ""),
      floor: String(form.get("floor") ?? "") || null,
    };

    startTransition(async () => {
      const result = room
        ? await updateRoom(room.id, payload)
        : await createRoom(payload);

      if (!result.ok) {
        setErrorKey(result.errorKey);
        return;
      }

      toast.success(room ? t("updated") : t("created"));
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
              <Label htmlFor="number">{t("number")}</Label>
              <Input id="number" name="number" defaultValue={room?.number} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="floor">{t("floor")}</Label>
              <Input id="floor" name="floor" defaultValue={room?.floor ?? ""} />
            </div>
          </div>

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
