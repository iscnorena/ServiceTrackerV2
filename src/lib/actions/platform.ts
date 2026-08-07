"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePlatformOwner } from "@/lib/hotel-scope";
import { getPlatformConfig } from "@/lib/platform-config";
import { actionError, actionOk, toActionError, type ActionResult } from "@/lib/errors";

const configSchema = z.object({
  pricePerHotelMonthly: z.number().min(0).max(1_000_000),
  currency: z.string().trim().length(3),
  trialDays: z.number().int().min(0).max(365),
  trialHotelLimit: z.number().int().min(1).max(1000),
});

/// Editar el precio de lista. Aplica a organizaciones nuevas de inmediato; las
/// que ya pagan conservan su `pricePerHotelSnapshot` y no se les toca.
export async function updatePlatformConfig(
  input: z.infer<typeof configSchema>,
): Promise<ActionResult<void>> {
  try {
    const owner = await requirePlatformOwner();
    const parsed = configSchema.safeParse(input);
    if (!parsed.success) return actionError("errors.validation");

    const config = await getPlatformConfig();

    await prisma.platformConfig.update({
      where: { id: config.id },
      data: {
        pricePerHotelMonthly: parsed.data.pricePerHotelMonthly,
        currency: parsed.data.currency.toUpperCase(),
        trialDays: parsed.data.trialDays,
        trialHotelLimit: parsed.data.trialHotelLimit,
        updatedById: owner.id,
      },
    });

    revalidatePath("/plataforma/configuracion");
    return actionOk();
  } catch (error) {
    return toActionError(error);
  }
}

const legalSchema = z.object({
  type: z.enum(["TERMS", "PRIVACY"]),
  locale: z.string().trim().min(2).max(5),
  content: z.string().trim().min(1).max(200_000),
});

/// Publicar NUNCA sobreescribe: cada edición crea un registro nuevo con
/// `version + 1`. Las versiones anteriores quedan guardadas, por si algún día
/// hace falta demostrar qué términos estaban vigentes en una fecha dada.
export async function publishLegalDocument(
  input: z.infer<typeof legalSchema>,
): Promise<ActionResult<{ version: number }>> {
  try {
    const owner = await requirePlatformOwner();
    const parsed = legalSchema.safeParse(input);
    if (!parsed.success) return actionError("errors.validation");

    const latest = await prisma.legalDocument.findFirst({
      where: { type: parsed.data.type, locale: parsed.data.locale },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    const document = await prisma.legalDocument.create({
      data: {
        type: parsed.data.type,
        locale: parsed.data.locale,
        format: "TEXT",
        content: parsed.data.content,
        version: (latest?.version ?? 0) + 1,
        publishedById: owner.id,
      },
      select: { version: true },
    });

    revalidatePath("/plataforma/legal");
    revalidatePath("/legal/terminos");
    revalidatePath("/legal/privacidad");
    return actionOk(document);
  } catch (error) {
    return toActionError(error);
  }
}

/// Suspender un cliente desde la plataforma (ej. por impago prolongado o abuso).
/// Restringe el acceso operativo sin borrar nada.
export async function setOrganizationStatus(
  organizationId: string,
  subscriptionStatus: "ACTIVE" | "CANCELLED",
): Promise<ActionResult<void>> {
  try {
    await requirePlatformOwner();

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!organization) return actionError("errors.notFound");

    await prisma.organization.update({
      where: { id: organization.id },
      data: {
        subscriptionStatus,
        cancelledAt: subscriptionStatus === "CANCELLED" ? new Date() : null,
      },
    });

    revalidatePath("/plataforma/organizaciones");
    return actionOk();
  } catch (error) {
    return toActionError(error);
  }
}
