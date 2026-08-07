"use client";

import { useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { CalendarPlus, Plus, Trash2, UserPlus } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/native-select";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/page-header";
import { FormError } from "@/components/form-error";
import { createGuest, createReservation } from "@/lib/actions/guests";

type RoomOption = { id: string; number: string };

type Guest = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  reservations: {
    id: string;
    checkIn: Date;
    checkOut: Date;
    notes: string | null;
    roomStays: {
      id: string;
      contactName: string;
      contactPhone: string | null;
      room: { id: string; number: string };
    }[];
  }[];
};

export function GuestsManager({
  hotelId,
  guests,
  rooms,
}: {
  hotelId: string;
  guests: Guest[];
  rooms: RoomOption[];
}) {
  const t = useTranslations("guests");
  const tRes = useTranslations("reservations");
  const format = useFormatter();
  const [creatingGuest, setCreatingGuest] = useState(false);
  const [reservingFor, setReservingFor] = useState<Guest | null>(null);

  return (
    <div className="space-y-6">
      {creatingGuest ? (
        <GuestForm hotelId={hotelId} onDone={() => setCreatingGuest(false)} />
      ) : (
        <Button onClick={() => setCreatingGuest(true)}>
          <UserPlus className="size-4" aria-hidden="true" />
          {t("new")}
        </Button>
      )}

      {reservingFor ? (
        <ReservationForm
          hotelId={hotelId}
          guest={reservingFor}
          rooms={rooms}
          onDone={() => setReservingFor(null)}
        />
      ) : null}

      {guests.length === 0 ? (
        <EmptyState message={t("empty")} />
      ) : (
        <ul className="space-y-4">
          {guests.map((guest) => (
            <li key={guest.id}>
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{guest.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {[guest.email, guest.phone].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setReservingFor(guest)}
                    >
                      <CalendarPlus className="size-4" aria-hidden="true" />
                      {tRes("new")}
                    </Button>
                  </div>
                </CardHeader>

                <CardContent>
                  {guest.reservations.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{tRes("empty")}</p>
                  ) : (
                    <ul className="space-y-4">
                      {guest.reservations.map((reservation) => (
                        <li key={reservation.id}>
                          <p className="text-sm font-medium">
                            {format.dateTime(reservation.checkIn, "medium")} →{" "}
                            {format.dateTime(reservation.checkOut, "medium")}
                          </p>
                          {reservation.notes ? (
                            <p className="text-sm text-muted-foreground">
                              {reservation.notes}
                            </p>
                          ) : null}

                          {/* Cada habitación de la reserva lleva su propio
                              contacto: el titular reservó, pero no está
                              físicamente en todos los cuartos. */}
                          <ul className="mt-2 space-y-1">
                            {reservation.roomStays.map((stay) => (
                              <li
                                key={stay.id}
                                className="flex flex-wrap gap-x-2 rounded-md bg-muted/50 px-3 py-1.5 text-sm"
                              >
                                <span className="font-medium">{stay.room.number}</span>
                                <span>{stay.contactName}</span>
                                {stay.contactPhone ? (
                                  <span className="text-muted-foreground">
                                    {stay.contactPhone}
                                  </span>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GuestForm({ hotelId, onDone }: { hotelId: string; onDone: () => void }) {
  const t = useTranslations("guests");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setErrorKey(null);

    startTransition(async () => {
      const result = await createGuest({
        hotelId,
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
        phone: String(form.get("phone") ?? ""),
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
              <Label htmlFor="name">{tCommon("name")}</Label>
              <Input id="name" name="name" required minLength={2} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{tCommon("email")}</Label>
              <Input id="email" name="email" type="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{tCommon("phone")}</Label>
              <Input id="phone" name="phone" type="tel" />
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

type StayDraft = { key: number; roomId: string; contactName: string; contactPhone: string };

function ReservationForm({
  hotelId,
  guest,
  rooms,
  onDone,
}: {
  hotelId: string;
  guest: Guest;
  rooms: RoomOption[];
  onDone: () => void;
}) {
  const t = useTranslations("reservations");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [stays, setStays] = useState<StayDraft[]>([
    { key: 0, roomId: rooms[0]?.id ?? "", contactName: guest.name, contactPhone: "" },
  ]);

  function updateStay(key: number, patch: Partial<StayDraft>) {
    setStays((current) =>
      current.map((stay) => (stay.key === key ? { ...stay, ...patch } : stay)),
    );
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setErrorKey(null);

    startTransition(async () => {
      const result = await createReservation({
        hotelId,
        guestId: guest.id,
        checkIn: String(form.get("checkIn") ?? ""),
        checkOut: String(form.get("checkOut") ?? ""),
        notes: String(form.get("notes") ?? ""),
        stays: stays.map((stay) => ({
          roomId: stay.roomId,
          contactName: stay.contactName,
          contactPhone: stay.contactPhone,
        })),
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
      <CardHeader>
        <CardTitle className="text-base">
          {t("new")} · {guest.name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="checkIn">{t("checkIn")}</Label>
              <Input id="checkIn" name="checkIn" type="date" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkOut">{t("checkOut")}</Label>
              <Input id="checkOut" name="checkOut" type="date" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">{tCommon("notes")}</Label>
              <Input id="notes" name="notes" placeholder="Evento corporativo…" />
            </div>
          </div>

          <Separator />

          <div>
            <p className="font-medium">{t("rooms")}</p>
            <p className="mb-3 text-sm text-muted-foreground">{t("contactHint")}</p>

            <ul className="space-y-3">
              {stays.map((stay, index) => (
                <li key={stay.key} className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
                  <div className="space-y-1">
                    <Label htmlFor={`room-${stay.key}`} className="text-xs">
                      {t("rooms")}
                    </Label>
                    <NativeSelect
                      id={`room-${stay.key}`}
                      value={stay.roomId}
                      onChange={(event) =>
                        updateStay(stay.key, { roomId: event.target.value })
                      }
                      required
                    >
                      {rooms.map((room) => (
                        <option key={room.id} value={room.id}>
                          {room.number}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor={`contact-${stay.key}`} className="text-xs">
                      {t("contactName")}
                    </Label>
                    <Input
                      id={`contact-${stay.key}`}
                      value={stay.contactName}
                      onChange={(event) =>
                        updateStay(stay.key, { contactName: event.target.value })
                      }
                      required
                      minLength={2}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor={`phone-${stay.key}`} className="text-xs">
                      {t("contactPhone")}
                    </Label>
                    <Input
                      id={`phone-${stay.key}`}
                      type="tel"
                      value={stay.contactPhone}
                      onChange={(event) =>
                        updateStay(stay.key, { contactPhone: event.target.value })
                      }
                    />
                  </div>

                  {stays.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="self-end"
                      aria-label={`${tCommon("delete")} ${index + 1}`}
                      onClick={() =>
                        setStays((current) => current.filter((s) => s.key !== stay.key))
                      }
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() =>
                setStays((current) => [
                  ...current,
                  {
                    key: Date.now(),
                    roomId: rooms[0]?.id ?? "",
                    contactName: "",
                    contactPhone: "",
                  },
                ])
              }
            >
              <Plus className="size-4" aria-hidden="true" />
              {t("addRoom")}
            </Button>
          </div>

          <FormError errorKey={errorKey} />

          <div className="flex gap-2">
            <Button type="submit" disabled={isPending || rooms.length === 0}>
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
