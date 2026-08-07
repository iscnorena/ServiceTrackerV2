import { describe, expect, it } from "vitest";
import {
  canDeleteTicket,
  canGrantDeletePermission,
  canManageBilling,
  canManageHotel,
  canManageHotels,
  canManagePlatform,
  canViewCorporateArea,
  canViewCrossHotelReports,
  globalScope,
  isRestrictedToOwnDepartment,
  scopeIn,
} from "@/lib/auth/can";
import type { AccessibleHotel, CurrentUser } from "@/lib/auth/session";

/// La matriz de permisos de la sección 4.1. Es el punto donde un error no da un
/// bug visible sino una fuga silenciosa, así que se cubre caso por caso.

const HOTEL_A = "hotel-a";
const HOTEL_B = "hotel-b";

function hotel(overrides: Partial<AccessibleHotel> = {}): AccessibleHotel {
  return {
    id: HOTEL_A,
    name: "Hotel A",
    billingStatus: "ACTIVE",
    permissionLevel: "STAFF",
    departmentId: null,
    canDeleteTickets: false,
    ...overrides,
  };
}

function user(overrides: Partial<CurrentUser> = {}): CurrentUser {
  return {
    id: "user-1",
    name: "Test",
    email: "test@example.com",
    status: "ACTIVE",
    preferredLocale: "es",
    isPlatformOwner: false,
    corporateRole: "NONE",
    organizationId: "org-1",
    organization: {
      id: "org-1",
      name: "Org",
      subscriptionStatus: "ACTIVE",
      trialEndsAt: null,
    },
    hotels: [hotel()],
    ...overrides,
  };
}

describe("scopeIn", () => {
  it("un STAFF tiene alcance STAFF en su hotel", () => {
    expect(scopeIn(user(), HOTEL_A)).toBe("STAFF");
  });

  it("sin acceso al hotel el alcance es NONE", () => {
    expect(scopeIn(user(), HOTEL_B)).toBe("NONE");
  });

  it("los roles corporativos ganan sobre el nivel por hotel", () => {
    const corporate = user({
      corporateRole: "CORPORATE_ADMIN",
      hotels: [hotel({ permissionLevel: "ADMIN" })],
    });
    expect(scopeIn(corporate, HOTEL_A)).toBe("CORPORATE_ADMIN");

    const superadmin = user({ corporateRole: "SUPERADMIN" });
    expect(scopeIn(superadmin, HOTEL_A)).toBe("SUPERADMIN");
  });

  it("una cuenta de plataforma no tiene alcance operativo en ningún hotel", () => {
    // Separación intencional: el proveedor del SaaS no entra a los datos de sus clientes.
    const owner = user({ isPlatformOwner: true, hotels: [hotel()] });
    expect(scopeIn(owner, HOTEL_A)).toBe("NONE");
  });
});

describe("canDeleteTicket", () => {
  it("SUPERADMIN siempre puede, sin necesidad de que se le otorgue", () => {
    const superadmin = user({
      corporateRole: "SUPERADMIN",
      hotels: [hotel({ canDeleteTickets: false })],
    });
    expect(canDeleteTicket(superadmin, HOTEL_A)).toBe(true);
  });

  it("STAFF nunca puede, ni aunque el flag venga en true", () => {
    // Sin excepción y sin posibilidad de que se le otorgue (sección 4.1).
    const staff = user({ hotels: [hotel({ canDeleteTickets: true })] });
    expect(canDeleteTicket(staff, HOTEL_A)).toBe(false);
  });

  it("ADMIN solo puede si se le otorgó explícitamente en ese hotel", () => {
    const sinPermiso = user({ hotels: [hotel({ permissionLevel: "ADMIN" })] });
    expect(canDeleteTicket(sinPermiso, HOTEL_A)).toBe(false);

    const conPermiso = user({
      hotels: [hotel({ permissionLevel: "ADMIN", canDeleteTickets: true })],
    });
    expect(canDeleteTicket(conPermiso, HOTEL_A)).toBe(true);
  });

  it("el permiso de ADMIN es por hotel, no global", () => {
    const admin = user({
      hotels: [
        hotel({ id: HOTEL_A, permissionLevel: "ADMIN", canDeleteTickets: true }),
        hotel({ id: HOTEL_B, permissionLevel: "ADMIN", canDeleteTickets: false }),
      ],
    });
    expect(canDeleteTicket(admin, HOTEL_A)).toBe(true);
    expect(canDeleteTicket(admin, HOTEL_B)).toBe(false);
  });

  it("CORPORATE_ADMIN depende del flag de su propio usuario", () => {
    const sinPermiso = user({
      corporateRole: "CORPORATE_ADMIN",
      hotels: [hotel({ permissionLevel: "ADMIN", canDeleteTickets: false })],
    });
    expect(canDeleteTicket(sinPermiso, HOTEL_A)).toBe(false);

    const conPermiso = user({
      corporateRole: "CORPORATE_ADMIN",
      hotels: [hotel({ permissionLevel: "ADMIN", canDeleteTickets: true })],
    });
    expect(canDeleteTicket(conPermiso, HOTEL_A)).toBe(true);
  });

  it("sin acceso al hotel no puede borrar nada ahí", () => {
    expect(canDeleteTicket(user({ corporateRole: "SUPERADMIN" }), HOTEL_B)).toBe(false);
  });
});

describe("canManageHotel", () => {
  it("ADMIN y superiores administran el hotel; STAFF no", () => {
    expect(canManageHotel(user(), HOTEL_A)).toBe(false);
    expect(canManageHotel(user({ hotels: [hotel({ permissionLevel: "ADMIN" })] }), HOTEL_A)).toBe(true);
    expect(canManageHotel(user({ corporateRole: "CORPORATE_ADMIN" }), HOTEL_A)).toBe(true);
    expect(canManageHotel(user({ corporateRole: "SUPERADMIN" }), HOTEL_A)).toBe(true);
  });
});

describe("permisos de organización", () => {
  it("solo SUPERADMIN da de alta hoteles, factura y otorga el permiso de borrado", () => {
    const superadmin = user({ corporateRole: "SUPERADMIN" });
    expect(canManageHotels(superadmin)).toBe(true);
    expect(canManageBilling(superadmin)).toBe(true);
    expect(canGrantDeletePermission(superadmin)).toBe(true);

    const corporate = user({ corporateRole: "CORPORATE_ADMIN" });
    expect(canManageHotels(corporate)).toBe(false);
    expect(canManageBilling(corporate)).toBe(false);
    expect(canGrantDeletePermission(corporate)).toBe(false);
  });

  it("una cuenta de plataforma no administra la organización de un cliente", () => {
    const owner = user({ isPlatformOwner: true, corporateRole: "SUPERADMIN" });
    expect(canManageHotels(owner)).toBe(false);
    expect(canViewCorporateArea(owner)).toBe(false);
    expect(canManagePlatform(owner)).toBe(true);
  });

  it("un cliente nunca administra la plataforma", () => {
    expect(canManagePlatform(user({ corporateRole: "SUPERADMIN" }))).toBe(false);
  });
});

describe("canViewCrossHotelReports", () => {
  it("un ADMIN con dos propiedades sí ve el reporte cruzado", () => {
    // El plan es explícito: no es exclusivo de los roles corporativos.
    const regional = user({
      hotels: [
        hotel({ id: HOTEL_A, permissionLevel: "ADMIN" }),
        hotel({ id: HOTEL_B, permissionLevel: "ADMIN" }),
      ],
    });
    expect(canViewCrossHotelReports(regional)).toBe(true);
  });

  it("un ADMIN de una sola propiedad no lo ve", () => {
    expect(
      canViewCrossHotelReports(user({ hotels: [hotel({ permissionLevel: "ADMIN" })] })),
    ).toBe(false);
  });

  it("un STAFF con dos hoteles tampoco: no es nivel de administración", () => {
    const staff = user({
      hotels: [hotel({ id: HOTEL_A }), hotel({ id: HOTEL_B })],
    });
    expect(canViewCrossHotelReports(staff)).toBe(false);
  });

  it("los roles corporativos siempre lo ven", () => {
    expect(canViewCrossHotelReports(user({ corporateRole: "CORPORATE_ADMIN" }))).toBe(true);
  });
});

describe("globalScope e isRestrictedToOwnDepartment", () => {
  it("resuelve el alcance sin hotel de por medio", () => {
    expect(globalScope(user({ isPlatformOwner: true }))).toBe("PLATFORM_OWNER");
    expect(globalScope(user({ corporateRole: "SUPERADMIN" }))).toBe("SUPERADMIN");
    expect(globalScope(user({ hotels: [hotel({ permissionLevel: "ADMIN" })] }))).toBe("ADMIN");
    expect(globalScope(user())).toBe("STAFF");
    expect(globalScope(user({ hotels: [] }))).toBe("NONE");
  });

  it("solo el STAFF queda restringido a su departamento", () => {
    expect(isRestrictedToOwnDepartment(user(), HOTEL_A)).toBe(true);
    expect(
      isRestrictedToOwnDepartment(user({ hotels: [hotel({ permissionLevel: "ADMIN" })] }), HOTEL_A),
    ).toBe(false);
  });
});
