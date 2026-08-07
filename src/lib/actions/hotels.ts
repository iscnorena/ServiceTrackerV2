"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/hotel-scope";
import { canManageHotels } from "@/lib/auth/can";
import { getPlatformConfig } from "@/lib/platform-config";
import { syncSubscriptionQuantity } from "@/lib/stripe";
import { actionError, actionOk, toActionError, UnauthorizedError, type ActionResult } from "@/lib/errors";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  address: z.string().trim().max(240).optional().nullable(),
  timezone: z.string().trim().max(60).optional().nullable(),
});

export async function createHotel(
  input: z.infer<typeof schema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = schema.safeParse(input);
    if (!parsed.success) return actionError("errors.validation");

    const user = await requireUser();
    if (!canManageHotels(user) || !user.organizationId) throw new UnauthorizedError();

    const organization = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { id: true, subscriptionStatus: true },
    });
    if (!organization) return actionError("errors.notFound");

    // Durante la prueba solo se puede operar un número limitado de propiedades:
    // es la fricción deliberada que empuja a contratar (sección 4.6).
    if (organization.subscriptionStatus === "TRIALING") {
      const config = await getPlatformConfig();
      const current = await prisma.hotel.count({
        where: { organizationId: organization.id, billingStatus: "ACTIVE" },
      });
      if (current >= config.trialHotelLimit) {
        return actionError("hotels.trialLimitReached");
      }
    } else if (organization.subscriptionStatus !== "ACTIVE") {
      return actionError("errors.subscriptionInactive");
    }

    const hotel = await prisma.hotel.create({
      data: {
        organizationId: organization.id,
        name: parsed.data.name,
        address: parsed.data.address ?? null,
        timezone: parsed.data.timezone ?? null,
      },
      select: { id: true },
    });

    // La suscripción de Stripe es una sola por organización, con `quantity` =
    // hoteles con licencia activa. Stripe prorratea el periodo en curso solo.
    await syncSubscriptionQuantity(organization.id);

    revalidatePath("/corporativo/hoteles");
    return actionOk(hotel);
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateHotel(
  hotelId: string,
  input: z.infer<typeof schema>,
): Promise<ActionResult<void>> {
  try {
    const parsed = schema.safeParse(input);
    if (!parsed.success) return actionError("errors.validation");

    const user = await requireUser();
    if (!canManageHotels(user) || !user.organizationId) throw new UnauthorizedError();

    const hotel = await prisma.hotel.findFirst({
      where: { id: hotelId, organizationId: user.organizationId },
      select: { id: true },
    });
    if (!hotel) return actionError("errors.hotelNotInOrganization");

    await prisma.hotel.update({
      where: { id: hotel.id },
      data: {
        name: parsed.data.name,
        address: parsed.data.address ?? null,
        timezone: parsed.data.timezone ?? null,
      },
    });

    revalidatePath("/corporativo/hoteles");
    return actionOk();
  } catch (error) {
    return toActionError(error);
  }
}

/// Suspender conserva los datos: el hotel deja de ser operable y deja de contar
/// en la facturación, pero nada se borra.
export async function setHotelBillingStatus(
  hotelId: string,
  billingStatus: "ACTIVE" | "SUSPENDED",
): Promise<ActionResult<void>> {
  try {
    const user = await requireUser();
    if (!canManageHotels(user) || !user.organizationId) throw new UnauthorizedError();

    const hotel = await prisma.hotel.findFirst({
      where: { id: hotelId, organizationId: user.organizationId },
      select: { id: true },
    });
    if (!hotel) return actionError("errors.hotelNotInOrganization");

    await prisma.hotel.update({ where: { id: hotel.id }, data: { billingStatus } });
    await syncSubscriptionQuantity(user.organizationId);

    revalidatePath("/corporativo/hoteles");
    return actionOk();
  } catch (error) {
    return toActionError(error);
  }
}
