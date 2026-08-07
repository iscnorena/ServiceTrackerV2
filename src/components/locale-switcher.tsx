"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Languages } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { locales } from "@/i18n/routing";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { savePreferredLocale } from "@/lib/actions/preferences";

const LABELS: Record<string, string> = { es: "Español", en: "English" };

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("common");
  const [isPending, startTransition] = useTransition();

  function change(next: string) {
    startTransition(async () => {
      // Se guarda la preferencia para que la próxima sesión (y los correos)
      // usen el mismo idioma. Si no hay sesión, el guardado es un no-op.
      await savePreferredLocale(next);
      router.replace(pathname, { locale: next as (typeof locales)[number] });
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" disabled={isPending} aria-label={t("language")} />
        }
      >
        <Languages className="size-4" aria-hidden="true" />
        <span className="hidden sm:inline">{LABELS[locale] ?? locale}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((option) => (
          <DropdownMenuItem
            key={option}
            onClick={() => change(option)}
            aria-current={option === locale}
          >
            {LABELS[option] ?? option}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
