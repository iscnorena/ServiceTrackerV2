import {
  canManageBilling,
  canManageHotels,
  canManagePlatform,
  canViewCorporateArea,
  canViewCrossHotelReports,
} from "@/lib/auth/can";
import { operableHotels, type CurrentUser } from "@/lib/auth/session";

/// Modelo de navegación serializable: se calcula en el servidor (donde vive la
/// matriz de permisos) y se pinta en el cliente (que sabe cuál es la ruta activa).
/// La UI nunca decide por su cuenta qué puede ver alguien.
export type NavModel = {
  hotels: { id: string; name: string }[];
  /// Hoteles donde el usuario es ADMIN o superior (ve el menú de administración)
  manageableHotelIds: string[];
  showCorporate: boolean;
  showHotelsAdmin: boolean;
  showBilling: boolean;
  showCrossHotelReport: boolean;
  showPlatform: boolean;
};

export function buildNavModel(user: CurrentUser): NavModel {
  const hotels = operableHotels(user);

  return {
    hotels: hotels.map((hotel) => ({ id: hotel.id, name: hotel.name })),
    manageableHotelIds: hotels
      .filter((hotel) => hotel.permissionLevel === "ADMIN")
      .map((hotel) => hotel.id),
    showCorporate: canViewCorporateArea(user),
    showHotelsAdmin: canManageHotels(user),
    showBilling: canManageBilling(user),
    showCrossHotelReport: canViewCrossHotelReports(user),
    showPlatform: canManagePlatform(user),
  };
}
