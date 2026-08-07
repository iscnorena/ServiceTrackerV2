"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormError } from "@/components/form-error";
import { submitGuestReport } from "@/lib/actions/guest-report";

const CATEGORIES = ["CLEANING", "BROKEN", "OTHER"] as const;

export function GuestReportForm({ qrSlug }: { qrSlug: string }) {
  const t = useTranslations("qr");
  const tCategory = useTranslations("enums.guestCategory");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("BROKEN");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (done) {
    return (
      <div className="space-y-3 text-center">
        <CheckCircle2
          className="mx-auto size-10 text-emerald-600"
          aria-hidden="true"
        />
        <p className="text-lg font-medium">{t("success")}</p>
        <p className="text-sm text-muted-foreground">{t("successBody")}</p>
      </div>
    );
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setErrorKey(null);

    startTransition(async () => {
      const result = await submitGuestReport({
        qrSlug,
        category,
        description: String(form.get("description") ?? ""),
        contactName: String(form.get("contactName") ?? "") || undefined,
      });

      if (!result.ok) {
        setErrorKey(result.errorKey);
        return;
      }
      setDone(true);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Botones grandes en vez de un desplegable: el huésped llega desde el
          celular y con una mano. Es un fieldset de radios para que funcione con
          teclado y lector de pantalla como lo que es: una sola elección. */}
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">{t("category")}</legend>
        <div className="grid gap-2">
          {CATEGORIES.map((option) => (
            <label
              key={option}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors ${
                category === option
                  ? "border-primary bg-accent font-medium"
                  : "hover:bg-accent/50"
              }`}
            >
              <input
                type="radio"
                name="category"
                value={option}
                checked={category === option}
                onChange={() => setCategory(option)}
                className="size-4"
              />
              {tCategory(option)}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="description">{t("description")}</Label>
        <Textarea
          id="description"
          name="description"
          rows={4}
          required
          minLength={5}
          maxLength={1000}
          placeholder={t("descriptionPlaceholder")}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="contactName">{t("contactName")}</Label>
        <Input id="contactName" name="contactName" maxLength={120} />
      </div>

      <FormError errorKey={errorKey} />

      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {t("submit")}
      </Button>
    </form>
  );
}
