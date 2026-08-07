"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getPlatformConfig } from "@/lib/platform-config";
import { createAuthToken, verifyAuthToken } from "@/lib/tokens";
import { sendPasswordResetEmail } from "@/lib/email";
import { actionError, actionOk, toActionError, type ActionResult } from "@/lib/errors";

const MIN_PASSWORD_LENGTH = 8;

const signupSchema = z.object({
  organizationName: z.string().trim().min(2).max(120),
  name: z.string().trim().min(2).max(120),
  email: z.email(),
  password: z.string().min(MIN_PASSWORD_LENGTH),
  locale: z.string().optional(),
});

/// Alta de un cliente nuevo: crea la `Organization` en prueba y su primer usuario
/// como `SUPERADMIN` de esa organización (sección 4.6).
export async function signUpOrganization(
  input: z.infer<typeof signupSchema>,
): Promise<ActionResult<{ email: string }>> {
  try {
    const parsed = signupSchema.safeParse(input);
    if (!parsed.success) {
      const short = parsed.error.issues.some(
        (issue) => issue.path[0] === "password",
      );
      return actionError(short ? "auth.passwordTooShort" : "errors.validation");
    }

    const email = parsed.data.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return actionError("auth.emailInUse");

    const config = await getPlatformConfig();
    const trialEndsAt = new Date(
      Date.now() + config.trialDays * 24 * 60 * 60 * 1000,
    );

    await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: parsed.data.organizationName,
          subscriptionStatus: "TRIALING",
          trialEndsAt,
        },
      });

      await tx.user.create({
        data: {
          name: parsed.data.name,
          email,
          passwordHash: await bcrypt.hash(parsed.data.password, 10),
          organizationId: organization.id,
          corporateRole: "SUPERADMIN",
          status: "ACTIVE",
          preferredLocale: parsed.data.locale,
        },
      });
    });

    return actionOk({ email });
  } catch (error) {
    return toActionError(error);
  }
}

/// Siempre responde igual exista o no el correo: si respondiera distinto, la
/// pantalla se convertiría en un oráculo para saber quién tiene cuenta.
export async function requestPasswordReset(
  email: string,
): Promise<ActionResult<void>> {
  try {
    const parsed = z.email().safeParse(email);
    if (!parsed.success) return actionOk();

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.toLowerCase() },
      select: { id: true, name: true, email: true, preferredLocale: true, status: true },
    });

    if (user && user.status !== "DISABLED") {
      const token = await createAuthToken(user.id, "PASSWORD_RESET");
      await sendPasswordResetEmail(user, { token });
    }

    return actionOk();
  } catch (error) {
    return toActionError(error);
  }
}

const setPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(MIN_PASSWORD_LENGTH),
});

export async function resetPassword(
  input: z.infer<typeof setPasswordSchema>,
): Promise<ActionResult<void>> {
  return setPasswordWithToken(input, "PASSWORD_RESET");
}

/// Aceptar una invitación: el usuario define su propia contraseña y pasa a ACTIVE.
/// Nadie asigna contraseñas a nombre de otra persona.
export async function acceptInvite(
  input: z.infer<typeof setPasswordSchema>,
): Promise<ActionResult<void>> {
  return setPasswordWithToken(input, "INVITE");
}

async function setPasswordWithToken(
  input: z.infer<typeof setPasswordSchema>,
  type: "INVITE" | "PASSWORD_RESET",
): Promise<ActionResult<void>> {
  try {
    const parsed = setPasswordSchema.safeParse(input);
    if (!parsed.success) return actionError("auth.passwordTooShort");

    const verified = await verifyAuthToken(parsed.data.token, type);
    if (!verified) return actionError("auth.tokenInvalid");
    if (verified.user.status === "DISABLED") {
      return actionError("auth.accountDisabled");
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: verified.userId },
        data: { passwordHash, status: "ACTIVE" },
      }),
      prisma.authToken.update({
        where: { id: verified.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return actionOk();
  } catch (error) {
    return toActionError(error);
  }
}
