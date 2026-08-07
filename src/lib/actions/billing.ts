"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/hotel-scope";
import { canManageBilling } from "@/lib/auth/can";
import {
  countLicensedHotels,
  ensureStripeCustomer,
  isStripeConfigured,
  stripe,
} from "@/lib/stripe";
import { getPlatformConfig } from "@/lib/platform-config";
import { actionError, actionOk, toActionError, UnauthorizedError, type ActionResult } from "@/lib/errors";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

/// Lleva a la organización de TRIALING a ACTIVE con una suscripción única cuyo
/// `quantity` es el número de hoteles a licenciar (sección 4.6).
export async function startCheckout(
  locale: string,
): Promise<ActionResult<{ url: string }>> {
  try {
    const user = await requireUser();
    if (!canManageBilling(user) || !user.organizationId) throw new UnauthorizedError();
    if (!stripe || !isStripeConfigured()) {
      return actionError("billing.stripeNotConfigured");
    }

    const customerId = await ensureStripeCustomer(user.organizationId);
    if (!customerId) return actionError("billing.stripeNotConfigured");

    // Se cobra por hotel activo; si todavía no hay ninguno se licencia uno, que
    // es el mínimo con el que la organización puede operar.
    const quantity = Math.max(await countLicensedHotels(user.organizationId), 1);
    const config = await getPlatformConfig();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity }],
      success_url: `${appUrl()}/${locale}/corporativo/facturacion?checkout=ok`,
      cancel_url: `${appUrl()}/${locale}/corporativo/facturacion`,
      // El webhook necesita saber a qué organización pertenece el pago, y con qué
      // precio se suscribió para poder congelarlo (grandfathering).
      subscription_data: {
        metadata: {
          organizationId: user.organizationId,
          pricePerHotelSnapshot: String(config.pricePerHotelMonthly),
          currencySnapshot: config.currency,
        },
      },
      metadata: { organizationId: user.organizationId },
    });

    if (!session.url) return actionError("errors.generic");
    return actionOk({ url: session.url });
  } catch (error) {
    return toActionError(error);
  }
}

/// Portal de Stripe para cambiar método de pago, ver facturas o cancelar.
export async function openBillingPortal(
  locale: string,
): Promise<ActionResult<{ url: string }>> {
  try {
    const user = await requireUser();
    if (!canManageBilling(user) || !user.organizationId) throw new UnauthorizedError();
    if (!stripe) return actionError("billing.stripeNotConfigured");

    const organization = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { stripeCustomerId: true },
    });
    if (!organization?.stripeCustomerId) {
      return actionError("billing.stripeNotConfigured");
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: organization.stripeCustomerId,
      return_url: `${appUrl()}/${locale}/corporativo/facturacion`,
    });

    return actionOk({ url: session.url });
  } catch (error) {
    return toActionError(error);
  }
}
