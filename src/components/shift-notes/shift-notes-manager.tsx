"use client";

import { useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/native-select";
import { EmptyState } from "@/components/page-header";
import { FormError } from "@/components/form-error";
import { createShiftNote } from "@/lib/actions/shift-notes";

type Option = { id: string; name: string };

type Note = {
  id: string;
  content: string;
  createdAt: Date;
  author: { name: string } | null;
  department: { id: string; name: string } | null;
};

export function ShiftNotesManager({
  hotelId,
  notes,
  departments,
  defaultDepartmentId,
}: {
  hotelId: string;
  notes: Note[];
  departments: Option[];
  defaultDepartmentId: string | null;
}) {
  const t = useTranslations("shiftNotes");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const router = useRouter();
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setErrorKey(null);

    startTransition(async () => {
      const result = await createShiftNote({
        hotelId,
        departmentId: (data.get("departmentId") as string) || null,
        content: String(data.get("content") ?? ""),
      });

      if (!result.ok) {
        setErrorKey(result.errorKey);
        return;
      }

      toast.success(t("created"));
      form.reset();
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="content">{t("content")}</Label>
              <Textarea
                id="content"
                name="content"
                rows={3}
                required
                minLength={3}
                maxLength={2000}
                placeholder="Habitación 210 pidió toallas extra, aún no se les lleva…"
              />
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-48 space-y-1">
                <Label htmlFor="departmentId" className="text-xs">
                  {tCommon("optional")}
                </Label>
                <NativeSelect
                  id="departmentId"
                  name="departmentId"
                  defaultValue={defaultDepartmentId ?? ""}
                >
                  {/* Sin departamento la nota es del hotel entero, no de un área */}
                  <option value="">{tCommon("all")}</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>

              <Button type="submit" disabled={isPending}>
                {isPending ? tCommon("saving") : t("new")}
              </Button>
            </div>

            <FormError errorKey={errorKey} />
          </form>
        </CardContent>
      </Card>

      {notes.length === 0 ? (
        <EmptyState message={t("empty")} />
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => (
            <li key={note.id}>
              <Card>
                <CardContent className="space-y-2 py-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {note.author?.name ?? "—"}
                    </span>
                    <span>{format.dateTime(note.createdAt, "medium")}</span>
                    {note.department ? (
                      <Badge variant="secondary">{note.department.name}</Badge>
                    ) : null}
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
