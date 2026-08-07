import { cache } from "react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type {
  BillingStatus,
  CorporateRole,
  PermissionLevel,
  SubscriptionStatus,
  UserStatus,
} from "@/generated/prisma/enums";

/// Un hotel al que el usuario tiene acceso, ya resuelto: no importa si el acceso
/// viene de UserHotelAccess (staff/admin de propiedad) o de corporateRole
/// (todos los hoteles de la organización). El resto del código no distingue.
export type AccessibleHotel = {
  id: string;
  name: string;
  billingStatus: BillingStatus;
  permissionLevel: PermissionLevel;
  /// Departamento del usuario en ESE hotel (null para roles corporativos)
  departmentId: string | null;
  canDeleteTickets: boolean;
};

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  preferredLocale: string | null;
  isPlatformOwner: boolean;
  corporateRole: CorporateRole;
  organizationId: string | null;
  organization: {
    id: string;
    name: string;
    subscriptionStatus: SubscriptionStatus;
    trialEndsAt: Date | null;
  } | null;
  /// Hoteles accesibles, incluidos los suspendidos (usa `operableHotels` para operar)
  hotels: AccessibleHotel[];
};

/// Lee el usuario completo desde la base en cada request en vez de confiar en los
/// claims del JWT: así una promoción, una revocación de `canDeleteTickets` o una
/// baja surten efecto de inmediato, sin esperar a que expire la sesión.
/// `cache` de React lo memoiza por request, no entre requests.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      preferredLocale: true,
      isPlatformOwner: true,
      corporateRole: true,
      canDeleteTickets: true,
      organizationId: true,
      organization: {
        select: {
          id: true,
          name: true,
          subscriptionStatus: true,
          trialEndsAt: true,
        },
      },
      hotelAccess: {
        select: {
          permissionLevel: true,
          departmentId: true,
          canDeleteTickets: true,
          hotel: { select: { id: true, name: true, billingStatus: true } },
        },
      },
    },
  });

  if (!user || user.status === "DISABLED") return null;

  const hotels = await resolveAccessibleHotels(user);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    preferredLocale: user.preferredLocale,
    isPlatformOwner: user.isPlatformOwner,
    corporateRole: user.corporateRole,
    organizationId: user.organizationId,
    organization: user.organization,
    hotels,
  };
});

type RawUser = {
  corporateRole: CorporateRole;
  canDeleteTickets: boolean;
  organizationId: string | null;
  isPlatformOwner: boolean;
  hotelAccess: {
    permissionLevel: PermissionLevel;
    departmentId: string | null;
    canDeleteTickets: boolean;
    hotel: { id: string; name: string; billingStatus: BillingStatus };
  }[];
};

async function resolveAccessibleHotels(user: RawUser): Promise<AccessibleHotel[]> {
  // Las cuentas de plataforma no tienen acceso operativo a datos de clientes.
  if (user.isPlatformOwner) return [];

  // Los roles corporativos ven TODOS los hoteles de su organización, incluidos los
  // que se den de alta después — por eso se resuelve por consulta, no por tabla de accesos.
  if (user.corporateRole !== "NONE" && user.organizationId) {
    const hotels = await prisma.hotel.findMany({
      where: { organizationId: user.organizationId },
      select: { id: true, name: true, billingStatus: true },
      orderBy: { name: "asc" },
    });

    const canDelete =
      user.corporateRole === "SUPERADMIN" ? true : user.canDeleteTickets;

    return hotels.map((hotel) => ({
      id: hotel.id,
      name: hotel.name,
      billingStatus: hotel.billingStatus,
      permissionLevel: "ADMIN" as const,
      departmentId: null,
      canDeleteTickets: canDelete,
    }));
  }

  return user.hotelAccess
    .map((access) => ({
      id: access.hotel.id,
      name: access.hotel.name,
      billingStatus: access.hotel.billingStatus,
      permissionLevel: access.permissionLevel,
      departmentId: access.departmentId,
      // STAFF nunca puede eliminar tickets, sin excepción ni posibilidad de otorgarlo.
      canDeleteTickets:
        access.permissionLevel === "ADMIN" ? access.canDeleteTickets : false,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/// Hoteles sobre los que el usuario puede operar de verdad: excluye los suspendidos.
export function operableHotels(user: CurrentUser): AccessibleHotel[] {
  return user.hotels.filter((hotel) => hotel.billingStatus === "ACTIVE");
}

/// Una organización solo puede operar si está en prueba vigente o al corriente.
export function isOrganizationOperable(
  organization: CurrentUser["organization"],
): boolean {
  if (!organization) return false;
  if (organization.subscriptionStatus === "ACTIVE") return true;
  if (organization.subscriptionStatus === "TRIALING") {
    // El cron marca EXPIRED una vez al día; esto cubre la ventana intermedia.
    return !organization.trialEndsAt || organization.trialEndsAt > new Date();
  }
  return false;
}
