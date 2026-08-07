import { beforeEach, describe, expect, it } from "vitest";
import { testSession, sentEmails } from "../setup";
import { createScenario, resetDatabase, type Scenario } from "../helpers/db";
import { prisma } from "@/lib/prisma";
import { createDepartment, updateDepartment } from "@/lib/actions/departments";
import { createHotel } from "@/lib/actions/hotels";
import { inviteUserToHotel, setCanDeleteTickets } from "@/lib/actions/users";
import { getTicketFormOptions } from "@/lib/queries/tickets";
import { requireHotelContext } from "@/lib/hotel-scope";

let scenario: Scenario;

beforeEach(async () => {
  await resetDatabase();
  scenario = await createScenario();
  sentEmails.length = 0;
});

function actingAs(userId: string) {
  testSession.userId = userId;
}

describe("departamentos", () => {
  it("un departamento nuevo aparece de inmediato en los selectores de ticket", async () => {
    // Es la promesa del catálogo dinámico: sin deploy ni migración de por medio.
    actingAs(scenario.adminA1.id);

    const created = await createDepartment({
      hotelId: scenario.hotelA1.id,
      name: "Teléfonos",
      defaultSlaMinutes: 15,
      affectsRoomStatus: false,
    });
    expect(created.ok).toBe(true);

    const ctx = await requireHotelContext(scenario.hotelA1.id);
    const options = await getTicketFormOptions(ctx);
    expect(options.departments.map((d) => d.name)).toContain("Teléfonos");
  });

  it("un STAFF no puede crear departamentos", async () => {
    actingAs(scenario.staffA1.id);

    const result = await createDepartment({
      hotelId: scenario.hotelA1.id,
      name: "Intento",
      defaultSlaMinutes: null,
      affectsRoomStatus: false,
    });

    expect(result.ok).toBe(false);
  });

  it("rechaza nombres duplicados dentro del mismo hotel", async () => {
    actingAs(scenario.adminA1.id);

    const result = await createDepartment({
      hotelId: scenario.hotelA1.id,
      name: "Mantenimiento",
      defaultSlaMinutes: 30,
      affectsRoomStatus: true,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKey).toBe("departments.duplicateName");
  });

  it("permite el mismo nombre en hoteles distintos", async () => {
    // Los departamentos están escopados por hotel: no es un catálogo global,
    // así que "Recepción" puede existir en A1 y en A2 al mismo tiempo.
    actingAs(scenario.superadminA.id);

    const result = await createDepartment({
      hotelId: scenario.hotelA2.id,
      name: "Recepción",
      defaultSlaMinutes: 60,
      affectsRoomStatus: false,
    });

    expect(result.ok).toBe(true);
    expect(
      await prisma.department.count({ where: { name: "Recepción" } }),
    ).toBe(2);
  });

  it("desactivar un departamento lo saca de los selectores sin borrar su historial", async () => {
    actingAs(scenario.adminA1.id);

    await updateDepartment(scenario.reception.id, {
      hotelId: scenario.hotelA1.id,
      name: "Recepción",
      defaultSlaMinutes: 60,
      affectsRoomStatus: false,
      active: false,
    });

    const ctx = await requireHotelContext(scenario.hotelA1.id);
    const options = await getTicketFormOptions(ctx);
    expect(options.departments.map((d) => d.name)).not.toContain("Recepción");

    expect(
      await prisma.department.findUnique({ where: { id: scenario.reception.id } }),
    ).not.toBeNull();
  });
});

describe("alta de hoteles y límite de prueba", () => {
  it("solo un SUPERADMIN da de alta hoteles", async () => {
    actingAs(scenario.adminA1.id);
    expect((await createHotel({ name: "Hotel nuevo" })).ok).toBe(false);

    actingAs(scenario.corporateA.id);
    expect((await createHotel({ name: "Hotel nuevo" })).ok).toBe(false);

    actingAs(scenario.superadminA.id);
    expect((await createHotel({ name: "Hotel nuevo" })).ok).toBe(true);
  });

  it("bloquea el alta al alcanzar el límite durante la prueba", async () => {
    await prisma.organization.update({
      where: { id: scenario.orgA.id },
      data: { subscriptionStatus: "TRIALING", trialEndsAt: new Date(Date.now() + 86_400_000) },
    });
    actingAs(scenario.superadminA.id);

    // El escenario ya tiene 2 hoteles activos y el límite de prueba es 1.
    const result = await createHotel({ name: "Tercero" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKey).toBe("hotels.trialLimitReached");
  });

  it("un hotel creado queda dentro de la organización de quien lo crea", async () => {
    actingAs(scenario.superadminB.id);
    const result = await createHotel({ name: "Hotel de B" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const hotel = await prisma.hotel.findUniqueOrThrow({
      where: { id: result.data.id },
    });
    expect(hotel.organizationId).toBe(scenario.orgB.id);
  });
});

describe("invitación de usuarios", () => {
  it("crea el usuario como INVITED, sin contraseña, y envía el correo", async () => {
    actingAs(scenario.adminA1.id);

    const result = await inviteUserToHotel({
      hotelId: scenario.hotelA1.id,
      name: "Nuevo Staff",
      email: "nuevo@a1.test",
      permissionLevel: "STAFF",
      departmentId: scenario.maintenance.id,
    });

    expect(result.ok).toBe(true);

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: "nuevo@a1.test" },
      include: { hotelAccess: true, authTokens: true },
    });

    // Nadie asigna contraseñas a nombre de otra persona.
    expect(user.passwordHash).toBeNull();
    expect(user.status).toBe("INVITED");
    expect(user.organizationId).toBe(scenario.orgA.id);
    expect(user.hotelAccess[0].hotelId).toBe(scenario.hotelA1.id);
    expect(user.authTokens[0].type).toBe("INVITE");
    // El token se guarda hasheado, nunca en claro.
    expect(user.authTokens[0].tokenHash).toHaveLength(64);
    expect(sentEmails).toContainEqual({ to: "nuevo@a1.test", kind: "invite" });
  });

  it("no permite reclutar un correo que ya pertenece a otra organización", async () => {
    // Sería un puente entre clientes que deben permanecer aislados.
    actingAs(scenario.adminA1.id);

    const result = await inviteUserToHotel({
      hotelId: scenario.hotelA1.id,
      name: "Ajeno",
      email: scenario.superadminB.email,
      permissionLevel: "STAFF",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKey).toBe("auth.emailInUse");
  });

  it("rechaza un departamento que no es de ese hotel", async () => {
    actingAs(scenario.superadminA.id);

    const result = await inviteUserToHotel({
      hotelId: scenario.hotelA1.id,
      name: "Cruzado",
      email: "cruzado@a1.test",
      permissionLevel: "STAFF",
      departmentId: scenario.departmentB.id,
    });

    expect(result.ok).toBe(false);
  });
});

describe("otorgar el permiso de eliminar tickets", () => {
  it("solo un SUPERADMIN puede otorgarlo", async () => {
    actingAs(scenario.adminA1.id);
    expect(
      (await setCanDeleteTickets(scenario.adminA1.id, true, scenario.hotelA1.id)).ok,
    ).toBe(false);

    actingAs(scenario.superadminA.id);
    expect(
      (await setCanDeleteTickets(scenario.adminA1.id, true, scenario.hotelA1.id)).ok,
    ).toBe(true);
  });

  it("a un STAFF no se le puede otorgar", async () => {
    actingAs(scenario.superadminA.id);

    const result = await setCanDeleteTickets(
      scenario.staffA1.id,
      true,
      scenario.hotelA1.id,
    );

    expect(result.ok).toBe(false);
    const access = await prisma.userHotelAccess.findFirstOrThrow({
      where: { userId: scenario.staffA1.id },
    });
    expect(access.canDeleteTickets).toBe(false);
  });

  it("no se puede otorgar a un usuario de otra organización", async () => {
    actingAs(scenario.superadminA.id);

    const result = await setCanDeleteTickets(scenario.superadminB.id, true);
    expect(result.ok).toBe(false);
  });
});
