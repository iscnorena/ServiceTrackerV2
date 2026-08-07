import { redirect } from "next/navigation";
import { getCurrentUser, operableHotels } from "@/lib/auth/session";
import { globalScope } from "@/lib/auth/can";

/// Entrada del sistema: cada quien aterriza donde le sirve, sin una pantalla
/// intermedia de "elige a dónde ir".
export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await getCurrentUser();

  if (!user) redirect(`/${locale}/login`);

  if (globalScope(user) === "PLATFORM_OWNER") {
    redirect(`/${locale}/plataforma/organizaciones`);
  }

  const hotels = operableHotels(user);

  // Con una sola propiedad no se agrega el paso extra del selector.
  if (hotels.length === 1) redirect(`/${locale}/${hotels[0].id}`);
  if (hotels.length > 1) redirect(`/${locale}/hoteles`);

  // Sin hoteles operables: un SUPERADMIN recién registrado va a darlos de alta;
  // cualquier otro ve el aviso de que todavía no tiene acceso.
  redirect(`/${locale}/corporativo/hoteles`);
}
