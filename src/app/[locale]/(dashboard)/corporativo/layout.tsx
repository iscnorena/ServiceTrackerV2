import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { canViewCorporateArea } from "@/lib/auth/can";

/// Puerta del área corporativa. La validación vive aquí y no en cada página para
/// que un descuido al agregar una pantalla nueva no deje un hueco abierto.
///
/// Responde 404 y no 403 a propósito: quien no tiene alcance corporativo tampoco
/// necesita saber que esta sección existe.
export default async function CorporateLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user || !canViewCorporateArea(user) || !user.organizationId) notFound();

  return children;
}
