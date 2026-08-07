"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/native-select";
import { Card, CardContent } from "@/components/ui/card";
import { FormError } from "@/components/form-error";
import { createTicket } from "@/lib/actions/tickets";

type Option = { id: string; name: string };
type RoomStayOption = { id: string; contactName: string; room: { number: string } };

export function TicketForm({
  hotelId,
  departments,
  assignees,
  roomStays,
  lockedDepartmentId,
  canAssign,
}: {
  hotelId: string;
  departments: Option[];
  assignees: Option[];
  roomStays: RoomStayOption[];
  lockedDepartmentId?: string;
  canAssign: boolean;
}) {
  const t = useTranslations("tickets");
  const tCommon = useTranslations("common");
  const tPriority = useTranslations("enums.ticketPriority");
  const router = useRouter();
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setErrorKey(null);

    startTransition(async () => {
      const result = await createTicket({
        hotelId,
        title: String(form.get("title") ?? ""),
        description: String(form.get("description") ?? ""),
        departmentId: lockedDepartmentId ?? String(form.get("departmentId") ?? ""),
        priority: String(form.get("priority") ?? "MEDIUM") as "LOW" | "MEDIUM" | "HIGH",
        roomStayId: (form.get("roomStayId") as string) || null,
        assignedToId: (form.get("assignedToId") as string) || null,
      });

      if (!result.ok) {
        setErrorKey(result.errorKey);
        return;
      }

      toast.success(t("created"));
      router.push(`/${hotelId}/tickets/${result.data.id}`);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">{t("ticketTitle")}</Label>
            <Input id="title" name="title" required minLength={3} maxLength={160} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t("description")}</Label>
            <Textarea id="description" name="description" required rows={4} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {lockedDepartmentId ? null : (
              <div className="space-y-2">
                <Label htmlFor="departmentId">{t("department")}</Label>
                <NativeSelect id="departmentId" name="departmentId" required>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="priority">{t("priority")}</Label>
              <NativeSelect id="priority" name="priority" defaultValue="MEDIUM">
                {(["HIGH", "MEDIUM", "LOW"] as const).map((priority) => (
                  <option key={priority} value={priority}>
                    {tPriority(priority)}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="roomStayId">{t("roomStay")}</Label>
              <NativeSelect id="roomStayId" name="roomStayId" defaultValue="">
                <option value="">{t("noContact")}</option>
                {roomStays.map((stay) => (
                  <option key={stay.id} value={stay.id}>
                    {stay.room.number} · {stay.contactName}
                  </option>
                ))}
              </NativeSelect>
            </div>

            {canAssign ? (
              <div className="space-y-2">
                <Label htmlFor="assignedToId">{t("assignedTo")}</Label>
                <NativeSelect id="assignedToId" name="assignedToId" defaultValue="">
                  <option value="">{tCommon("unassigned")}</option>
                  {assignees.map((assignee) => (
                    <option key={assignee.id} value={assignee.id}>
                      {assignee.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            ) : null}
          </div>

          <FormError errorKey={errorKey} />

          <div className="flex gap-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? tCommon("saving") : tCommon("create")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              {tCommon("cancel")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
