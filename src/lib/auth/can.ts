import type { AccessibleHotel, CurrentUser } from "@/lib/auth/session";

/// Alcance efectivo del usuario. Resuelve en un solo lugar la mezcla de
/// `UserHotelAccess.permissionLevel` (escopado a hotel) y `User.corporateRole`
/// (alcance a toda la organización). Nadie más debe leer esos campos directamente.
export type Scope =
  | "PLATFORM_OWNER"
  | "SUPERADMIN"
  | "CORPORATE_ADMIN"
  | "ADMIN"
  | "STAFF"
  | "NONE";

export function accessFor(
  user: CurrentUser,
  hotelId: string,
): AccessibleHotel | null {
  return user.hotels.find((hotel) => hotel.id === hotelId) ?? null;
}

/// Alcance del usuario dentro de un hotel concreto.
export function scopeIn(user: CurrentUser, hotelId: string): Scope {
  if (user.isPlatformOwner) return "NONE"; // sin acceso operativo por diseño
  const access = accessFor(user, hotelId);
  if (!access) return "NONE";
  if (user.corporateRole === "SUPERADMIN") return "SUPERADMIN";
  if (user.corporateRole === "CORPORATE_ADMIN") return "CORPORATE_ADMIN";
  return access.permissionLevel; // STAFF | ADMIN
}

/// Alcance global, sin hotel de por medio (para pantallas corporativas/plataforma).
export function globalScope(user: CurrentUser): Scope {
  if (user.isPlatformOwner) return "PLATFORM_OWNER";
  if (user.corporateRole === "SUPERADMIN") return "SUPERADMIN";
  if (user.corporateRole === "CORPORATE_ADMIN") return "CORPORATE_ADMIN";
  return user.hotels.some((hotel) => hotel.permissionLevel === "ADMIN")
    ? "ADMIN"
    : user.hotels.length > 0
      ? "STAFF"
      : "NONE";
}

const ADMIN_OR_ABOVE: Scope[] = ["ADMIN", "CORPORATE_ADMIN", "SUPERADMIN"];

export function canAccessHotel(user: CurrentUser, hotelId: string): boolean {
  return scopeIn(user, hotelId) !== "NONE";
}

/// Administrar catálogos y configuración de un hotel: departamentos, habitaciones,
/// insumos, plantillas recurrentes, reasignación de cualquier ticket.
export function canManageHotel(user: CurrentUser, hotelId: string): boolean {
  return ADMIN_OR_ABOVE.includes(scopeIn(user, hotelId));
}

/// Invitar usuarios a un hotel. ADMIN solo puede invitar STAFF/ADMIN de su hotel.
export function canManageHotelUsers(user: CurrentUser, hotelId: string): boolean {
  return ADMIN_OR_ABOVE.includes(scopeIn(user, hotelId));
}

/// Eliminar tickets. Toda la lógica del permiso otorgable vive aquí:
/// SUPERADMIN siempre; CORPORATE_ADMIN y ADMIN solo si se les otorgó
/// explícitamente; STAFF nunca, sin excepción.
export function canDeleteTicket(user: CurrentUser, hotelId: string): boolean {
  const scope = scopeIn(user, hotelId);
  if (scope === "SUPERADMIN") return true;
  if (scope === "STAFF" || scope === "NONE" || scope === "PLATFORM_OWNER") return false;
  return accessFor(user, hotelId)?.canDeleteTickets ?? false;
}

/// Dar de alta, suspender o reactivar hoteles de la propia organización.
export function canManageHotels(user: CurrentUser): boolean {
  return !user.isPlatformOwner && user.corporateRole === "SUPERADMIN";
}

/// Promover/degradar usuarios de la organización y otorgar `canDeleteTickets`.
export function canManageOrganizationUsers(user: CurrentUser): boolean {
  return !user.isPlatformOwner && user.corporateRole === "SUPERADMIN";
}

/// Otorgar o revocar el permiso sensible de eliminar tickets.
export function canGrantDeletePermission(user: CurrentUser): boolean {
  return canManageOrganizationUsers(user);
}

/// Gestionar la suscripción y la facturación de la propia organización.
export function canManageBilling(user: CurrentUser): boolean {
  return !user.isPlatformOwner && user.corporateRole === "SUPERADMIN";
}

/// Ver el área corporativa (vista cruzada entre hoteles de la organización).
export function canViewCorporateArea(user: CurrentUser): boolean {
  return !user.isPlatformOwner && user.corporateRole !== "NONE";
}

/// El reporte de insumos recurrentes aplica a cualquiera con más de un hotel:
/// un ADMIN con 2-3 propiedades también lo necesita, no solo el corporativo.
export function canViewCrossHotelReports(user: CurrentUser): boolean {
  if (user.isPlatformOwner) return false;
  if (user.corporateRole !== "NONE") return true;
  return user.hotels.filter((h) => h.permissionLevel === "ADMIN").length > 1;
}

/// Administrar el negocio de licenciamiento (precios, organizaciones, legales).
export function canManagePlatform(user: CurrentUser): boolean {
  return user.isPlatformOwner;
}

/// Un STAFF solo ve/actualiza tickets de su departamento dentro de su hotel.
export function isRestrictedToOwnDepartment(
  user: CurrentUser,
  hotelId: string,
): boolean {
  return scopeIn(user, hotelId) === "STAFF";
}
