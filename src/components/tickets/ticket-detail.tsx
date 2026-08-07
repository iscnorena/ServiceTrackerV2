"use client";

import { useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Phone, Trash2, User } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/native-select";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  GuestSourceBadge,
  PriorityBadge,
  SlaIndicator,
  StatusBadge,
} from "@/components/tickets/ticket-badges";
import { TicketAttachments } from "@/components/tickets/ticket-attachments";
import {
  addTicketComment,
  addTicketSupplyUsage,
  deleteTicket,
  updateTicket,
} from "@/lib/actions/tickets";

type Option = { id: string; name: string };

type Ticket = {
  id: string;
  title: string;
  description: string;
  status: "PENDING" | "IN_PROGRESS" | "RESOLVED" | "CANCELLED";
  priority: "LOW" | "MEDIUM" | "HIGH";
  source: "STAFF" | "GUEST";
  guestCategory: string | null;
  slaDueAt: Date | null;
  createdAt: Date;
  resolvedAt: Date | null;
  department: { id: string; name: string };
  assignedTo: { id: string; name: string } | null;
  createdBy: { id: string; name: string } | null;
  roomStay: {
    id: string;
    contactName: string;
    contactPhone: string | null;
    room: { id: string; number: string };
  } | null;
  activities: {
    id: string;
    action: string;
    detail: string | null;
    createdAt: Date;
    user: { name: string } | null;
  }[];
  comments: {
    id: string;
    message: string;
    createdAt: Date;
    user: { name: string } | null;
  }[];
  attachments: { id: string; url: string; type: "BEFORE" | "AFTER" | "OTHER"; createdAt: Date }[];
  supplyUsage: { id: string; quantity: number; supplyItem: { id: string; name: string } }[];
};

export function TicketDetail({
  ticket,
  hotelId,
  departments,
  assignees,
  supplies,
  canDelete,
  canReassign,
  storageConfigured,
}: {
  ticket: Ticket;
  hotelId: string;
  departments: Option[];
  assignees: Option[];
  supplies: Option[];
  canDelete: boolean;
  canReassign: boolean;
  storageConfigured: boolean;
}) {
  const t = useTranslations("tickets");
  const tCommon = useTranslations("common");
  const tStatus = useTranslations("enums.ticketStatus");
  const tPriority = useTranslations("enums.ticketPriority");
  const tAction = useTranslations("enums.activityAction");
  const tGuestCategory = useTranslations("enums.guestCategory");
  const format = useFormatter();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function patch(data: Parameters<typeof updateTicket>[0]) {
    startTransition(async () => {
      const result = await updateTicket(data);
      if (!result.ok) {
        toast.error(tCommon("empty"));
        return;
      }
      toast.success(t("updated"));
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
              {ticket.source === "GUEST" ? <GuestSourceBadge /> : null}
              <SlaIndicator slaDueAt={ticket.slaDueAt} status={ticket.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>

            {ticket.guestCategory ? (
              <p className="text-sm text-muted-foreground">
                {t("source")}: {tGuestCategory(ticket.guestCategory)}
              </p>
            ) : null}

            <Separator />

            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <Field label={t("createdBy")}>
                {ticket.createdBy?.name ?? tCommon("none")}
              </Field>
              <Field label={tCommon("createdAt")}>
                {format.dateTime(ticket.createdAt, "medium")}
              </Field>
              {ticket.resolvedAt ? (
                <Field label={t("resolvedAt")}>
                  {format.dateTime(ticket.resolvedAt, "medium")}
                </Field>
              ) : null}
            </dl>
          </CardContent>
        </Card>

        <TicketAttachments
          hotelId={hotelId}
          ticketId={ticket.id}
          attachments={ticket.attachments}
          storageConfigured={storageConfigured}
        />
        <CommentsCard ticket={ticket} hotelId={hotelId} />
        <TimelineCard ticket={ticket} tAction={tAction} />
      </div>

      <div className="space-y-6">
        {/* El contacto que se muestra es el de ESA habitación, no el del titular
            de la reserva: es lo que mantenimiento necesita al tocar la puerta. */}
        {ticket.roomStay ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("contact")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-lg font-semibold">{ticket.roomStay.room.number}</p>
              <p className="flex items-center gap-2">
                <User className="size-4 text-muted-foreground" aria-hidden="true" />
                {ticket.roomStay.contactName}
              </p>
              {ticket.roomStay.contactPhone ? (
                <p className="flex items-center gap-2">
                  <Phone className="size-4 text-muted-foreground" aria-hidden="true" />
                  <a
                    href={`tel:${ticket.roomStay.contactPhone}`}
                    className="hover:underline"
                  >
                    {ticket.roomStay.contactPhone}
                  </a>
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{tCommon("actions")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="status">{t("status")}</Label>
              <NativeSelect
                id="status"
                value={ticket.status}
                disabled={isPending}
                onChange={(event) =>
                  patch({
                    ticketId: ticket.id,
                    hotelId,
                    status: event.target.value as Ticket["status"],
                  })
                }
              >
                {(["PENDING", "IN_PROGRESS", "RESOLVED", "CANCELLED"] as const).map(
                  (status) => (
                    <option key={status} value={status}>
                      {tStatus(status)}
                    </option>
                  ),
                )}
              </NativeSelect>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">{t("priority")}</Label>
              <NativeSelect
                id="priority"
                value={ticket.priority}
                disabled={isPending}
                onChange={(event) =>
                  patch({
                    ticketId: ticket.id,
                    hotelId,
                    priority: event.target.value as Ticket["priority"],
                  })
                }
              >
                {(["HIGH", "MEDIUM", "LOW"] as const).map((priority) => (
                  <option key={priority} value={priority}>
                    {tPriority(priority)}
                  </option>
                ))}
              </NativeSelect>
            </div>

            {canReassign ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="department">{t("department")}</Label>
                  <NativeSelect
                    id="department"
                    value={ticket.department.id}
                    disabled={isPending}
                    onChange={(event) =>
                      patch({
                        ticketId: ticket.id,
                        hotelId,
                        departmentId: event.target.value,
                      })
                    }
                  >
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </NativeSelect>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assignee">{t("assignedTo")}</Label>
                  <NativeSelect
                    id="assignee"
                    value={ticket.assignedTo?.id ?? ""}
                    disabled={isPending}
                    onChange={(event) =>
                      patch({
                        ticketId: ticket.id,
                        hotelId,
                        assignedToId: event.target.value || null,
                      })
                    }
                  >
                    <option value="">{tCommon("unassigned")}</option>
                    {assignees.map((assignee) => (
                      <option key={assignee.id} value={assignee.id}>
                        {assignee.name}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        <SuppliesCard ticket={ticket} hotelId={hotelId} supplies={supplies} />

        {canDelete ? <DeleteTicketCard ticket={ticket} hotelId={hotelId} /> : null}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function CommentsCard({ ticket, hotelId }: { ticket: Ticket; hotelId: string }) {
  const t = useTranslations("tickets");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const message = String(new FormData(form).get("message") ?? "");

    startTransition(async () => {
      const result = await addTicketComment(hotelId, ticket.id, message);
      if (!result.ok) return;
      form.reset();
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("comments")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("commentsHint")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-3">
          {ticket.comments.map((comment) => (
            <li key={comment.id} className="rounded-md bg-muted/50 p-3 text-sm">
              <p className="mb-1 text-xs text-muted-foreground">
                {comment.user?.name ?? tCommon("none")} ·{" "}
                {format.dateTime(comment.createdAt, "short")}
              </p>
              <p className="whitespace-pre-wrap">{comment.message}</p>
            </li>
          ))}
        </ul>

        <form onSubmit={onSubmit} className="space-y-2">
          <Label htmlFor="message" className="sr-only">
            {t("addComment")}
          </Label>
          <Textarea id="message" name="message" rows={3} required maxLength={2000} />
          <Button type="submit" size="sm" disabled={isPending}>
            {t("addComment")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function TimelineCard({
  ticket,
  tAction,
}: {
  ticket: Ticket;
  tAction: (key: string) => string;
}) {
  const t = useTranslations("tickets");
  const format = useFormatter();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("timeline")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3 text-sm">
          {ticket.activities.map((activity) => (
            <li key={activity.id} className="flex gap-3">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground" />
              <div>
                <p>
                  <span className="font-medium">{activity.user?.name ?? "—"}</span>{" "}
                  {tAction(activity.action).toLowerCase()}
                  {activity.detail ? (
                    <span className="text-muted-foreground"> · {activity.detail}</span>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format.dateTime(activity.createdAt, "short")}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function SuppliesCard({
  ticket,
  hotelId,
  supplies,
}: {
  ticket: Ticket;
  hotelId: string;
  supplies: Option[];
}) {
  const t = useTranslations("tickets");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (supplies.length === 0 && ticket.supplyUsage.length === 0) return null;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const supplyItemId = String(data.get("supplyItemId") ?? "");
    const quantity = Number(data.get("quantity") ?? 1);
    if (!supplyItemId) return;

    startTransition(async () => {
      const result = await addTicketSupplyUsage(
        hotelId,
        ticket.id,
        supplyItemId,
        quantity,
      );
      if (!result.ok) return;
      form.reset();
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("supplies")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-1 text-sm">
          {ticket.supplyUsage.map((usage) => (
            <li key={usage.id} className="flex justify-between">
              <span>{usage.supplyItem.name}</span>
              <span className="text-muted-foreground">×{usage.quantity}</span>
            </li>
          ))}
        </ul>

        {supplies.length > 0 ? (
          <form onSubmit={onSubmit} className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor="supplyItemId" className="text-xs">
                {t("addSupply")}
              </Label>
              <NativeSelect id="supplyItemId" name="supplyItemId" defaultValue="">
                <option value="">—</option>
                {supplies.map((supply) => (
                  <option key={supply.id} value={supply.id}>
                    {supply.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="w-20 space-y-1">
              <Label htmlFor="quantity" className="text-xs">
                {t("quantity")}
              </Label>
              <Input
                id="quantity"
                name="quantity"
                type="number"
                min={1}
                defaultValue={1}
              />
            </div>
            <Button type="submit" size="sm" disabled={isPending}>
              +
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DeleteTicketCard({ ticket, hotelId }: { ticket: Ticket; hotelId: string }) {
  const t = useTranslations("tickets");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function onDelete() {
    startTransition(async () => {
      const result = await deleteTicket(hotelId, ticket.id);
      if (!result.ok) {
        toast.error(t("deleted"));
        return;
      }
      toast.success(t("deleted"));
      setOpen(false);
      router.push(`/${hotelId}/tickets`);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive" className="w-full" />}>
        <Trash2 className="size-4" aria-hidden="true" />
        {tCommon("delete")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("deleteConfirmTitle")}</DialogTitle>
          <DialogDescription>{t("deleteConfirmBody")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost" />}>
            {tCommon("cancel")}
          </DialogClose>
          <Button variant="destructive" onClick={onDelete} disabled={isPending}>
            {tCommon("delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
