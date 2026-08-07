import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getCurrentUser, isOrganizationOperable } from "@/lib/auth/session";
import { SubscriptionGate } from "@/components/billing/subscription-gate";

/// Puerta de entrada a todo el contexto de un hotel. Valida en orden:
/// pertenencia (el hotel debe estar entre los accesibles del usuario, lo que
/// implica que es de SU organización), suscripción vigente, y hotel no suspendido.
export default async function HotelLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;
  const user = await getCurrentUser();
  if (!user) notFound();

  const access = user.hotels.find((hotel) => hotel.id === hotelId);
  // 404 y no 403 a propósito: quien no tiene acceso no debe poder distinguir
  // "este hotel no existe" de "existe pero es de otro cliente".
  if (!access) notFound();

  if (!isOrganizationOperable(user.organization)) {
    return <SubscriptionGate status={user.organization?.subscriptionStatus} />;
  }

  if (access.billingStatus === "SUSPENDED") {
    return <SubscriptionGate status="SUSPENDED_HOTEL" />;
  }

  return children;
}
