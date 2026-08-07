import "server-only";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

/// Cliente de Stripe y helpers de suscripción.
///
/// Modelo: UNA suscripción por `Organization`, con `quantity` = número de hoteles
/// con licencia activa (sección 4.6). Agregar o quitar un hotel actualiza esa
/// cantidad y Stripe prorratea el periodo en curso solo — es el patrón estándar
/// de "precio por unidad" y evita manejar N suscripciones sueltas por cliente.

const secretKey = process.env.STRIPE_SECRET_KEY;

export const stripe = secretKey ? new Stripe(secretKey) : null;

export function isStripeConfigured(): boolean {
  return Boolean(secretKey && process.env.STRIPE_PRICE_ID);
}

export async function countLicensedHotels(organizationId: string): Promise<number> {
  return prisma.hotel.count({
    where: { organizationId, billingStatus: "ACTIVE" },
  });
}

/// Alinea el `quantity` de Stripe con los hoteles activos. Es idempotente y no
/// hace nada si la organización todavía no tiene suscripción (está en prueba):
/// se llama desde el alta/suspensión de hoteles sin condicionales en el llamador.
export async function syncSubscriptionQuantity(
  organizationId: string,
): Promise<void> {
  if (!stripe) return;

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { stripeSubscriptionId: true, subscriptionStatus: true },
  });

  if (!organization?.stripeSubscriptionId) return;
  if (organization.subscriptionStatus === "CANCELLED") return;

  const quantity = await countLicensedHotels(organizationId);
  if (quantity === 0) return;

  try {
    const subscription = await stripe.subscriptions.retrieve(
      organization.stripeSubscriptionId,
    );
    const item = subscription.items.data[0];
    if (!item || item.quantity === quantity) return;

    await stripe.subscriptions.update(organization.stripeSubscriptionId, {
      items: [{ id: item.id, quantity }],
      proration_behavior: "create_prorations",
    });
  } catch (error) {
    // Un fallo aquí no debe impedir dar de alta el hotel: la cantidad se
    // reconcilia en la siguiente operación o desde el panel de facturación.
    console.error("[stripe] no se pudo sincronizar quantity", error);
  }
}

export async function ensureStripeCustomer(
  organizationId: string,
): Promise<string | null> {
  if (!stripe) return null;

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, stripeCustomerId: true },
  });
  if (!organization) return null;
  if (organization.stripeCustomerId) return organization.stripeCustomerId;

  const customer = await stripe.customers.create({
    name: organization.name,
    metadata: { organizationId: organization.id },
  });

  await prisma.organization.update({
    where: { id: organization.id },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}
