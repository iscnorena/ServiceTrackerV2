import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it } from "vitest";
import { sentEmails, testSession } from "../setup";
import { createScenario, resetDatabase, type Scenario } from "../helpers/db";
import { prisma } from "@/lib/prisma";
import {
  acceptInvite,
  requestPasswordReset,
  resetPassword,
  signUpOrganization,
} from "@/lib/actions/auth";
import { inviteUserToHotel } from "@/lib/actions/users";
import { createAuthToken, verifyAuthToken } from "@/lib/tokens";

let scenario: Scenario;

beforeEach(async () => {
  await resetDatabase();
  scenario = await createScenario();
  sentEmails.length = 0;
});

describe("signUpOrganization", () => {
  it("crea la organización en prueba y a su primer usuario como SUPERADMIN", async () => {
    const result = await signUpOrganization({
      organizationName: "Cliente Nuevo",
      name: "Dueño",
      email: "Dueno@Nuevo.test",
      password: "Password123",
      locale: "es",
    });

    expect(result.ok).toBe(true);

    const user = await prisma.user.findUniqueOrThrow({
      // El correo se normaliza a minúsculas al guardar.
      where: { email: "dueno@nuevo.test" },
      include: { organization: true },
    });

    expect(user.corporateRole).toBe("SUPERADMIN");
    expect(user.status).toBe("ACTIVE");
    expect(user.organization?.subscriptionStatus).toBe("TRIALING");
    // La prueba dura lo que diga PlatformConfig (14 días en el escenario).
    const days = Math.round(
      (user.organization!.trialEndsAt!.getTime() - Date.now()) / 86_400_000,
    );
    expect(days).toBe(14);
  });

  it("guarda la contraseña hasheada, nunca en claro", async () => {
    await signUpOrganization({
      organizationName: "Otra",
      name: "Alguien",
      email: "alguien@otra.test",
      password: "Password123",
    });

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: "alguien@otra.test" },
    });
    expect(user.passwordHash).not.toBe("Password123");
    expect(await bcrypt.compare("Password123", user.passwordHash!)).toBe(true);
  });

  it("rechaza un correo que ya existe", async () => {
    const result = await signUpOrganization({
      organizationName: "Duplicado",
      name: "Alguien",
      email: scenario.superadminA.email,
      password: "Password123",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKey).toBe("auth.emailInUse");
  });

  it("rechaza contraseñas cortas", async () => {
    const result = await signUpOrganization({
      organizationName: "Corta",
      name: "Alguien",
      email: "corta@test.test",
      password: "1234",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKey).toBe("auth.passwordTooShort");
    expect(await prisma.organization.count({ where: { name: "Corta" } })).toBe(0);
  });
});

describe("recuperación de contraseña", () => {
  it("responde igual exista o no la cuenta, para no delatar quién tiene una", async () => {
    const existente = await requestPasswordReset(scenario.superadminA.email);
    const inexistente = await requestPasswordReset("nadie@ninguna.test");

    expect(existente.ok).toBe(true);
    expect(inexistente.ok).toBe(true);
    // Pero solo se manda correo cuando la cuenta existe de verdad.
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].to).toBe(scenario.superadminA.email);
  });

  it("cambia la contraseña y deja el token inservible", async () => {
    const token = await createAuthToken(scenario.superadminA.id, "PASSWORD_RESET");

    const first = await resetPassword({ token, password: "NuevaClave123" });
    expect(first.ok).toBe(true);

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: scenario.superadminA.id },
    });
    expect(await bcrypt.compare("NuevaClave123", user.passwordHash!)).toBe(true);

    // Un link de un solo uso: reutilizarlo no debe funcionar.
    const second = await resetPassword({ token, password: "OtraClave123" });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.errorKey).toBe("auth.tokenInvalid");
  });

  it("emitir un token nuevo invalida el anterior", async () => {
    const primero = await createAuthToken(scenario.superadminA.id, "PASSWORD_RESET");
    await createAuthToken(scenario.superadminA.id, "PASSWORD_RESET");

    expect(await verifyAuthToken(primero, "PASSWORD_RESET")).toBeNull();
  });

  it("un token expirado no sirve", async () => {
    const token = await createAuthToken(scenario.superadminA.id, "PASSWORD_RESET");
    await prisma.authToken.updateMany({
      where: { userId: scenario.superadminA.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    expect(await verifyAuthToken(token, "PASSWORD_RESET")).toBeNull();
  });

  it("un token de invitación no sirve para restablecer contraseña", async () => {
    // Tienen vidas distintas (7 días contra 1 hora): confundirlos alargaría la
    // ventana de un vector de secuestro de cuenta.
    const token = await createAuthToken(scenario.superadminA.id, "INVITE");
    const result = await resetPassword({ token, password: "NuevaClave123" });
    expect(result.ok).toBe(false);
  });
});

describe("aceptar invitación", () => {
  it("activa la cuenta con la contraseña que define el propio usuario", async () => {
    testSession.userId = scenario.adminA1.id;
    await inviteUserToHotel({
      hotelId: scenario.hotelA1.id,
      name: "Invitado",
      email: "invitado@a1.test",
      permissionLevel: "STAFF",
    });

    const invited = await prisma.user.findUniqueOrThrow({
      where: { email: "invitado@a1.test" },
      include: { authTokens: true },
    });
    expect(invited.status).toBe("INVITED");

    // El token en claro solo existe dentro del correo; aquí se emite uno nuevo
    // para poder ejercitar el flujo de aceptación.
    const token = await createAuthToken(invited.id, "INVITE");
    const result = await acceptInvite({ token, password: "MiClave1234" });
    expect(result.ok).toBe(true);

    const activated = await prisma.user.findUniqueOrThrow({
      where: { id: invited.id },
    });
    expect(activated.status).toBe("ACTIVE");
    expect(await bcrypt.compare("MiClave1234", activated.passwordHash!)).toBe(true);
  });

  it("una cuenta desactivada no puede aceptar una invitación", async () => {
    await prisma.user.update({
      where: { id: scenario.staffA1.id },
      data: { status: "DISABLED" },
    });
    const token = await createAuthToken(scenario.staffA1.id, "INVITE");

    const result = await acceptInvite({ token, password: "MiClave1234" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKey).toBe("auth.accountDisabled");
  });
});
