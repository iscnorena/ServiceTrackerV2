import "server-only";
import {
  getCurrentUser,
  isOrganizationOperable,
  type AccessibleHotel,
  type CurrentUser,
} from "@/lib/auth/session";
import { canViewCorporateArea, scopeIn, type Scope } from "@/lib/auth/can";
import { AppError, NotFoundError, UnauthorizedError } from "@/lib/errors";

/// Punto único de entrada al scoping multi-tenant.
///
/// El aislamiento entre `Organization` es el límite más crítico del sistema: una
/// query sin filtrar no filtra datos entre hoteles de un mismo cliente, sino entre
/// empresas que no se conocen entre sí. Por eso NINGÚN Server Action construye sus
/// filtros de `hotelId`/`organizationId` a mano: todos pasan por aquí.

export type HotelContext = {
  user: CurrentUser;
  hotelId: string;
  access: AccessibleHotel;
  scope: Scope;
};

export type CorporateContext = {
  user: CurrentUser;
  organizationId: string;
  hotelIds: string[];
};

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

/// Contexto de trabajo dentro de un hotel. Valida, en este orden:
/// 1. que haya sesión, 2. que el hotel esté entre los accesibles del usuario
/// (lo que implica que pertenece a SU organización), 3. que la suscripción del
/// cliente permita operar, 4. que el hotel no esté suspendido.
export async function requireHotelContext(
  hotelId: string,
  options: { allowReadOnly?: boolean } = {},
): Promise<HotelContext> {
  const user = await requireUser();

  if (user.isPlatformOwner) {
    // Separación intencional: la plataforma no entra a los datos de sus clientes.
    throw new UnauthorizedError("errors.unauthorized");
  }

  const access = user.hotels.find((hotel) => hotel.id === hotelId);
  if (!access) throw new NotFoundError("errors.hotelNotInOrganization");

  if (!options.allowReadOnly) {
    if (!isOrganizationOperable(user.organization)) {
      throw new AppError("errors.subscriptionInactive", 402);
    }
    if (access.billingStatus === "SUSPENDED") {
      throw new AppError("errors.subscriptionInactive", 402);
    }
  }

  return { user, hotelId, access, scope: scopeIn(user, hotelId) };
}

/// Contexto corporativo: cruza todos los hoteles de la organización del usuario.
export async function requireCorporateContext(): Promise<CorporateContext> {
  const user = await requireUser();
  if (!canViewCorporateArea(user) || !user.organizationId) {
    throw new UnauthorizedError();
  }
  return {
    user,
    organizationId: user.organizationId,
    hotelIds: user.hotels.map((hotel) => hotel.id),
  };
}

export async function requirePlatformOwner(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.isPlatformOwner) throw new UnauthorizedError();
  return user;
}

// ---------------------------------------------------------------------------
// Constructores de filtros — usar SIEMPRE estos en vez de escribir `where` a mano
// ---------------------------------------------------------------------------

/// Filtro para modelos con columna `hotelId` (Ticket, Room, Department, Guest,
/// Reservation, SupplyItem, ShiftNote, RecurringTicketTemplate).
export function hotelFilter(ctx: HotelContext): { hotelId: string } {
  return { hotelId: ctx.hotelId };
}

/// Filtro cruzado sobre todos los hoteles a los que el usuario tiene acceso.
/// Si `hotelIds` viene vacío el `in: []` no devuelve nada — que es exactamente
/// el comportamiento seguro cuando alguien no tiene acceso a ninguna propiedad.
export function multiHotelFilter(
  user: CurrentUser,
  only?: string[],
): { hotelId: { in: string[] } } {
  const accessible = new Set(user.hotels.map((hotel) => hotel.id));
  const requested = only?.filter((id) => accessible.has(id));
  return { hotelId: { in: requested ?? [...accessible] } };
}

/// Filtro para modelos que no llevan `hotelId` propio y cuelgan de Room/Reservation.
export function roomStayFilter(ctx: HotelContext) {
  return { room: { hotelId: ctx.hotelId } };
}

/// Un STAFF solo ve los tickets de su departamento; ADMIN y arriba ven todos.
export function departmentVisibilityFilter(ctx: HotelContext) {
  if (ctx.scope !== "STAFF") return {};
  // Sin departamento asignado, un STAFF solo ve lo que le tocó directamente.
  if (!ctx.access.departmentId) return { assignedToId: ctx.user.id };
  return {
    OR: [
      { departmentId: ctx.access.departmentId },
      { assignedToId: ctx.user.id },
    ],
  };
}

/// Todo listado de tickets excluye los borrados lógicamente.
export const notDeleted = { deletedAt: null };
