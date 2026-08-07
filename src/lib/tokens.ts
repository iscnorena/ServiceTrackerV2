import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { AuthTokenType } from "@/generated/prisma/enums";

/// Vida de cada tipo de token. Corta para reset (es un vector de secuestro de
/// cuenta), larga para invitación (alguien puede tardar días en revisar su correo).
const TTL_MS: Record<AuthTokenType, number> = {
  INVITE: 7 * 24 * 60 * 60 * 1000,
  PASSWORD_RESET: 60 * 60 * 1000,
};

/// El token viaja en texto plano solo dentro del link del correo. En la base se
/// guarda hasheado, igual que una contraseña: si alguien lee la tabla no puede
/// suplantar a nadie.
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createAuthToken(
  userId: string,
  type: AuthTokenType,
): Promise<string> {
  const token = randomBytes(32).toString("base64url");

  // Al emitir uno nuevo, el anterior del mismo tipo deja de servir: si alguien
  // pide "olvidé mi contraseña" dos veces, el primer link ya no funciona.
  await prisma.$transaction([
    prisma.authToken.updateMany({
      where: { userId, type, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.authToken.create({
      data: {
        userId,
        type,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + TTL_MS[type]),
      },
    }),
  ]);

  return token;
}

export type VerifiedToken = {
  id: string;
  userId: string;
  user: { id: string; name: string; email: string; status: string };
};

/// Valida sin consumir: sirve para pintar el formulario antes de que el usuario
/// escriba su contraseña nueva.
export async function verifyAuthToken(
  token: string,
  type: AuthTokenType,
): Promise<VerifiedToken | null> {
  const record = await prisma.authToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      userId: true,
      type: true,
      usedAt: true,
      expiresAt: true,
      user: { select: { id: true, name: true, email: true, status: true } },
    },
  });

  if (!record) return null;
  if (record.type !== type) return null;
  if (record.usedAt) return null;
  if (record.expiresAt < new Date()) return null;

  return { id: record.id, userId: record.userId, user: record.user };
}

export async function consumeAuthToken(tokenId: string): Promise<void> {
  await prisma.authToken.update({
    where: { id: tokenId },
    data: { usedAt: new Date() },
  });
}
