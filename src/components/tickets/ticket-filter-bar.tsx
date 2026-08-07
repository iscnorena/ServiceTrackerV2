"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type Option = { id: string; name: string };

/// Los filtros viven en la URL, no en estado local: así la vista es compartible
/// y la exportación de reportes puede reutilizar exactamente los mismos filtros
/// que el usuario tiene en pantalla (sección 4.4).
export function TicketFilterBar({
  departments,
  assignees,
}: {
  departments: Option[];
  assignees: Option[];
}) {
  const t = useTranslations("tickets");
  const tCommon = useTranslations("common");
  const tStatus = useTranslations("enums.ticketStatus");
  const tPriority = useTranslations("enums.ticketPriority");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`);
  }

  const hasFilters = ["status", "priority", "department", "assignee", "overdue"].some(
    (key) => searchParams.get(key),
  );

  return (
    <div className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
      <Field label={t("filterStatus")} id="filter-status">
        <NativeSelect
          id="filter-status"
          value={searchParams.get("status") ?? ""}
          onChange={(event) => setParam("status", event.target.value || null)}
        >
          <option value="">{tCommon("all")}</option>
          {(["PENDING", "IN_PROGRESS", "RESOLVED", "CANCELLED"] as const).map((s) => (
            <option key={s} value={s}>
              {tStatus(s)}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <Field label={t("filterPriority")} id="filter-priority">
        <NativeSelect
          id="filter-priority"
          value={searchParams.get("priority") ?? ""}
          onChange={(event) => setParam("priority", event.target.value || null)}
        >
          <option value="">{tCommon("all")}</option>
          {(["HIGH", "MEDIUM", "LOW"] as const).map((p) => (
            <option key={p} value={p}>
              {tPriority(p)}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <Field label={t("filterDepartment")} id="filter-department">
        <NativeSelect
          id="filter-department"
          value={searchParams.get("department") ?? ""}
          onChange={(event) => setParam("department", event.target.value || null)}
        >
          <option value="">{tCommon("all")}</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <Field label={t("filterAssignee")} id="filter-assignee">
        <NativeSelect
          id="filter-assignee"
          value={searchParams.get("assignee") ?? ""}
          onChange={(event) => setParam("assignee", event.target.value || null)}
        >
          <option value="">{tCommon("all")}</option>
          {assignees.map((assignee) => (
            <option key={assignee.id} value={assignee.id}>
              {assignee.name}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <div className="flex items-center gap-2 pb-1.5">
        <Checkbox
          id="filter-overdue"
          checked={searchParams.get("overdue") === "1"}
          onCheckedChange={(checked) => setParam("overdue", checked ? "1" : null)}
        />
        <Label htmlFor="filter-overdue" className="text-sm font-normal">
          {t("filterOverdue")}
        </Label>
      </div>

      {hasFilters ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.replace(pathname)}
          className="pb-1.5"
        >
          {tCommon("clearFilters")}
        </Button>
      ) : null}
    </div>
  );
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-36 flex-1 space-y-1">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
