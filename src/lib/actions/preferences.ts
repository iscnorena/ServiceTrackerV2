"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { isLocale } from "@/i18n/routing";

/// Recuerda el idioma elegido. Si no hay sesión no hace nada: el locale de la URL
/// ya manda en esa navegación y no hay dónde persistirlo.
export async function savePreferredLocale(locale: string): Promise<void> {
  if (!isLocale(locale)) return;

  const user = await getCurrentUser();
  if (!user) return;

  await prisma.user.update({
    where: { id: user.id },
    data: { preferredLocale: locale },
  });
}
