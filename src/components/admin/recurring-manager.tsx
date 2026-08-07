"use client";

import { useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import {
  createRecurringTemplate,
  setRecurringTemplateActive,
} from "@/lib/actions/recurring";
import type { RecurrenceFrequency, TicketPriority } from "@/generated/prisma/enums";

type Option = { id: string; name: string };
type RoomOption = { id: string; number: string };

type Template = {
  id: string;
  title: string;
  frequency: RecurrenceFrequency;
  nextRunAt: Date;
  lastRunAt: Date | null;
  active: boolean;
  priority: TicketPriority;
  department: { name: string };
  room: { number: string } | null;
};

export function RecurringManager({
  hotelId,
  templates,
  departments,
  rooms,
}: {
  hotelId: string;
  templates: Template[];
  departments: Option[];
  rooms: RoomOption[];
}) {
  const t = useTranslations("recurring");
  const tCommon = useTranslations("common");
  const tFrequency = useTranslations("enums.frequency");
  const format = useFormatter();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [isPending, startTransition] = useTransition();

  function toggle(template: Template) {
    startTransition(async () => {
      const result = await setRecurringTemplateActive(
        hotelId,
        template.id,
        !template.active,
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
    <div className="space-y-6">
      {creating ? (
        <TemplateForm
          hotelId={hotelId}
          departments={departments}
          rooms={rooms}
          onDone={() => setCreating(false)}
        />
      ) : (
        <Button onClick={() => setCreating(true)} disabled={departments.length === 0}>
          <Plus className="size-4" aria-hidden="true" />
          {t("new")}
        </Button>
      )}

      {templates.length === 0 ? (
        <EmptyState message={t("empty")} />
      ) : (
        <Card>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tCommon("name")}</TableHead>
                  <TableHead>{t("frequency")}</TableHead>
                  <TableHead>{t("nextRun")}</TableHead>
                  <TableHead>{t("lastRun")}</TableHead>
                  <TableHead className="text-right">{tCommon("active")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <p className="font-medium">{template.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {template.department.name}
                        {template.room ? ` · ${template.room.number}` : ""}
                      </p>
                    </TableCell>
                    <TableCell>{tFrequency(template.frequency)}</TableCell>
                    <TableCell>
                      {format.dateTime(template.nextRunAt, "date")}
                    </TableCell>
                    <TableCell>
                      {template.lastRunAt
                        ? format.dateTime(template.lastRunAt, "date")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Switch
                        checked={template.active}
                        disabled={isPending}
                        onCheckedChange={() => toggle(template)}
                        aria-label={`${tCommon("active")} ${template.title}`}
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

function TemplateForm({
  hotelId,
  departments,
  rooms,
  onDone,
}: {
  hotelId: string;
  departments: Option[];
  rooms: RoomOption[];
  onDone: () => void;
}) {
  const t = useTranslations("recurring");
  const tCommon = useTranslations("common");
  const tTickets = useTranslations("tickets");
  const tFrequency = useTranslations("enums.frequency");
  const tPriority = useTranslations("enums.ticketPriority");
  const router = useRouter();
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setErrorKey(null);

    startTransition(async () => {
      const result = await createRecurringTemplate({
        hotelId,
        title: String(form.get("title") ?? ""),
        description: String(form.get("description") ?? ""),
        departmentId: String(form.get("departmentId") ?? ""),
        roomId: (form.get("roomId") as string) || null,
        priority: String(form.get("priority") ?? "MEDIUM") as TicketPriority,
        frequency: String(form.get("frequency") ?? "MONTHLY") as RecurrenceFrequency,
        nextRunAt: String(form.get("nextRunAt") ?? ""),
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
          <div className="space-y-2">
            <Label htmlFor="title">{tTickets("ticketTitle")}</Label>
            <Input id="title" name="title" required minLength={3} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{tTickets("description")}</Label>
            <Textarea id="description" name="description" rows={3} required />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="departmentId">{tTickets("department")}</Label>
              <NativeSelect id="departmentId" name="departmentId" required>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-2">
              <Label htmlFor="roomId">{tTickets("room")}</Label>
              <NativeSelect id="roomId" name="roomId" defaultValue="">
                {/* Sin habitación es una plantilla general del hotel, no de un cuarto */}
                <option value="">{tCommon("none")}</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.number}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">{tTickets("priority")}</Label>
              <NativeSelect id="priority" name="priority" defaultValue="MEDIUM">
                {(["HIGH", "MEDIUM", "LOW"] as const).map((priority) => (
                  <option key={priority} value={priority}>
                    {tPriority(priority)}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-2">
              <Label htmlFor="frequency">{t("frequency")}</Label>
              <NativeSelect id="frequency" name="frequency" defaultValue="MONTHLY">
                {(["DAILY", "WEEKLY", "MONTHLY"] as const).map((frequency) => (
                  <option key={frequency} value={frequency}>
                    {tFrequency(frequency)}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nextRunAt">{t("nextRun")}</Label>
              <Input id="nextRunAt" name="nextRunAt" type="date" required />
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
