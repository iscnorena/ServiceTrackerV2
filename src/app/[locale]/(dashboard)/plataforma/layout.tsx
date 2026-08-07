import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

/// Área de la plataforma: solo para las cuentas que operan el producto, nunca
/// para clientes. La validación vive aquí para que agregar una pantalla nueva no
/// pueda dejar un hueco abierto.
export default async function PlatformLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user?.isPlatformOwner) notFound();

  return children;
}
