"use client";

import { useTranslations } from "next-intl";
import { AlertCircle } from "lucide-react";

/// Los Server Actions devuelven una clave de traducción, nunca texto. Este
/// componente la resuelve al idioma activo. La clave viene como "namespace.key".
export function FormError({ errorKey }: { errorKey: string | null | undefined }) {
  const t = useTranslations();
  if (!errorKey) return null;

  return (
    <p
      role="alert"
      className="flex items-start gap-2 text-sm font-medium text-destructive"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{t(errorKey)}</span>
    </p>
  );
}
