import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { sendBillingEmail } from "@/lib/email";
import type { SubscriptionStatus } from "@/generated/prisma/enums";

/// Endpoint público de webhooks de Stripe.
///
/// Dos reglas que no se negocian por ser una superficie pública:
/// 1. Se verifica SIEMPRE la firma antes de leer el payload. Sin esto, cualquiera
///    podría activarle la suscripción a su organización con un POST.
/// 2. Cada evento se procesa una sola vez. Stripe reintenta y puede reenviar el
///    mismo evento, así que el `event.id` se guarda y los duplicados se descartan.

export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return NextResponse.json({ error: "stripe not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    // Hace falta el cuerpo crudo: cualquier reserialización rompe la firma.
    const payload = await request.text();
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (error) {
    console.error("[stripe] firma inválida", error);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  // Marca de idempotencia: si el id ya existe, este evento ya se aplicó.
  try {
    await prisma.processedStripeEvent.create({
      data: { id: event.id, type: event.type },
    });
  } catch {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    await handleEvent(event);
  } catch (error) {
    console.error(`[stripe] fallo procesando ${event.type}`, error);
    // Se borra la marca para que el reintento de Stripe sí vuelva a entrar.
    await prisma.processedStripeEvent
      .delete({ where: { id: event.id } })
      .catch(() => undefined);
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const organizationId = session.metadata?.organizationId;
      if (!organizationId || !session.subscription) return;

      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription.id;

      const subscription = await stripe!.subscriptions.retrieve(subscriptionId);

      await prisma.organization.update({
        where: { id: organizationId },
        data: {
          subscriptionStatus: "ACTIVE",
          stripeSubscriptionId: subscriptionId,
          stripeCustomerId:
            typeof session.customer === "string"
              ? session.customer
              : (session.customer?.id ?? undefined),
          // Precio congelado: si más adelante sube la tarifa de lista, a este
          // cliente no se le sube de golpe (grandfathering, decisión #5).
          pricePerHotelSnapshot: subscription.metadata?.pricePerHotelSnapshot
            ? Number(subscription.metadata.pricePerHotelSnapshot)
            : undefined,
          currencySnapshot: subscription.metadata?.currencySnapshot ?? undefined,
          trialEndsAt: null,
          cancelledAt: null,
        },
      });
      return;
    }

    case "invoice.payment_failed": {
      const organization = await organizationFromInvoice(event.data.object);
      if (!organization) return;

      await setStatus(organization.id, "PAST_DUE");
      await notifyOwners(organization.id, "paymentFailed");
      return;
    }

    case "invoice.paid": {
      const organization = await organizationFromInvoice(event.data.object);
      if (!organization) return;

      // Solo interesa la recuperación tras un impago: un cobro normal ya venía ACTIVE.
      if (organization.subscriptionStatus === "PAST_DUE") {
        await setStatus(organization.id, "ACTIVE");
      }
      return;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const organization = await prisma.organization.findFirst({
        where: { stripeSubscriptionId: subscription.id },
        select: { id: true },
      });
      if (!organization) return;

      await prisma.organization.update({
        where: { id: organization.id },
        data: { subscriptionStatus: "CANCELLED", cancelledAt: new Date() },
      });
      await notifyOwners(organization.id, "subscriptionCancelled");
      return;
    }

    default:
      // El resto de eventos se ignora a propósito: solo se suscriben los que
      // cambian el estado de la organización.
      return;
  }
}

async function organizationFromInvoice(invoice: Stripe.Invoice) {
  const customerId =
    typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return null;

  return prisma.organization.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true, subscriptionStatus: true },
  });
}

async function setStatus(
  organizationId: string,
  subscriptionStatus: SubscriptionStatus,
): Promise<void> {
  await prisma.organization.update({
    where: { id: organizationId },
    data: { subscriptionStatus },
  });
}

/// Los correos de facturación van a quien puede resolverlos: los SUPERADMIN de
/// esa organización, en el idioma que cada quien tenga configurado.
async function notifyOwners(
  organizationId: string,
  key: "paymentFailed" | "subscriptionCancelled",
): Promise<void> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      name: true,
      users: {
        where: { corporateRole: "SUPERADMIN", status: "ACTIVE" },
        select: { name: true, email: true, preferredLocale: true },
      },
    },
  });
  if (!organization) return;

  await Promise.all(
    organization.users.map((user) =>
      sendBillingEmail(user, key, { organizationName: organization.name }),
    ),
  );
}
