"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireHotelContext, requireUser } from "@/lib/hotel-scope";
import {
  canGrantDeletePermission,
  canManageHotelUsers,
  canManageOrganizationUsers,
} from "@/lib/auth/can";
import { createAuthToken } from "@/lib/tokens";
import { sendInviteEmail } from "@/lib/email";
import { actionError, actionOk, toActionError, UnauthorizedError, type ActionResult } from "@/lib/errors";

const inviteSchema = z.object({
  hotelId: z.string().min(1),
  name: z.string().trim().min(2).max(120),
  email: z.email(),
  permissionLevel: z.enum(["STAFF", "ADMIN"]),
  departmentId: z.string().min(1).nullable().optional(),
});

/// Alta de usuario por invitación: nunca se asigna una contraseña a nombre de
/// otra persona. Se crea el `User` como INVITED y el correo lleva un token de un
/// solo uso con el que define su propia contraseña.
export async function inviteUserToHotel(
  input: z.infer<typeof inviteSchema>,
): Promise<ActionResult<{ email: string }>> {
  try {
    const parsed = inviteSchema.safeParse(input);
    if (!parsed.success) return actionError("errors.validation");

    const ctx = await requireHotelContext(parsed.data.hotelId);
    if (!canManageHotelUsers(ctx.user, ctx.hotelId)) throw new UnauthorizedError();
    if (!ctx.user.organizationId) throw new UnauthorizedError();

    const email = parsed.data.email.toLowerCase();

    // El departamento debe ser de este hotel: los departamentos están escopados.
    if (parsed.data.departmentId) {
      const department = await prisma.department.findFirst({
        where: { id: parsed.data.departmentId, hotelId: ctx.hotelId },
        select: { id: true },
      });
      if (!department) return actionError("errors.notFound");
    }

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, organizationId: true, isPlatformOwner: true },
    });

    // Un correo que ya pertenece a otro cliente no se puede reclutar: sería un
    // puente entre organizaciones que deben permanecer aisladas.
    if (
      existing &&
      (existing.isPlatformOwner ||
        (existing.organizationId && existing.organizationId !== ctx.user.organizationId))
    ) {
      return actionError("auth.emailInUse");
    }

    const user =
      existing ??
      (await prisma.user.create({
        data: {
          name: parsed.data.name,
          email,
          organizationId: ctx.user.organizationId,
          status: "INVITED",
        },
        select: { id: true, organizationId: true, isPlatformOwner: true },
      }));

    await prisma.userHotelAccess.upsert({
      where: { userId_hotelId: { userId: user.id, hotelId: ctx.hotelId } },
      create: {
        userId: user.id,
        hotelId: ctx.hotelId,
        permissionLevel: parsed.data.permissionLevel,
        departmentId: parsed.data.departmentId ?? null,
      },
      update: {
        permissionLevel: parsed.data.permissionLevel,
        departmentId: parsed.data.departmentId ?? null,
      },
    });

    // Si ya tenía cuenta activa no hace falta invitación: solo se le dio acceso.
    const needsInvite = !existing;
    if (needsInvite) {
      const token = await createAuthToken(user.id, "INVITE");
      await sendInviteEmail(
        { name: parsed.data.name, email, preferredLocale: ctx.user.preferredLocale },
        {
          token,
          organizationName: ctx.user.organization?.name ?? "",
          inviterName: ctx.user.name,
        },
      );
    }

    revalidatePath(`/${ctx.hotelId}/admin/usuarios`);
    return actionOk({ email });
  } catch (error) {
    return toActionError(error);
  }
}

export async function resendInvite(
  hotelId: string,
  userId: string,
): Promise<ActionResult<void>> {
  try {
    const ctx = await requireHotelContext(hotelId);
    if (!canManageHotelUsers(ctx.user, ctx.hotelId)) throw new UnauthorizedError();

    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        organizationId: ctx.user.organizationId,
        status: "INVITED",
      },
      select: { id: true, name: true, email: true, preferredLocale: true },
    });
    if (!user) return actionError("errors.notFound");

    const token = await createAuthToken(user.id, "INVITE");
    await sendInviteEmail(user, {
      token,
      organizationName: ctx.user.organization?.name ?? "",
      inviterName: ctx.user.name,
    });

    return actionOk();
  } catch (error) {
    return toActionError(error);
  }
}

const accessSchema = z.object({
  hotelId: z.string().min(1),
  userId: z.string().min(1),
  permissionLevel: z.enum(["STAFF", "ADMIN"]),
  departmentId: z.string().min(1).nullable().optional(),
});

export async function updateHotelAccess(
  input: z.infer<typeof accessSchema>,
): Promise<ActionResult<void>> {
  try {
    const parsed = accessSchema.safeParse(input);
    if (!parsed.success) return actionError("errors.validation");

    const ctx = await requireHotelContext(parsed.data.hotelId);
    if (!canManageHotelUsers(ctx.user, ctx.hotelId)) throw new UnauthorizedError();

    const access = await prisma.userHotelAccess.findFirst({
      where: {
        userId: parsed.data.userId,
        hotelId: ctx.hotelId,
        user: { organizationId: ctx.user.organizationId },
      },
      select: { id: true },
    });
    if (!access) return actionError("errors.notFound");

    await prisma.userHotelAccess.update({
      where: { id: access.id },
      data: {
        permissionLevel: parsed.data.permissionLevel,
        departmentId: parsed.data.departmentId ?? null,
        // Bajar a STAFF revoca el permiso de eliminar: un STAFF nunca puede,
        // ni siquiera si lo tenía otorgado como ADMIN.
        ...(parsed.data.permissionLevel === "STAFF" ? { canDeleteTickets: false } : {}),
      },
    });

    revalidatePath(`/${ctx.hotelId}/admin/usuarios`);
    return actionOk();
  } catch (error) {
    return toActionError(error);
  }
}

/// Otorgar/revocar el permiso sensible de eliminar tickets. Solo SUPERADMIN.
/// Para un ADMIN el permiso vive en su `UserHotelAccess` de ESE hotel; para un
/// CORPORATE_ADMIN vive en su `User`, porque su alcance es toda la organización.
export async function setCanDeleteTickets(
  userId: string,
  value: boolean,
  hotelId?: string,
): Promise<ActionResult<void>> {
  try {
    const actor = await requireUser();
    if (!canGrantDeletePermission(actor) || !actor.organizationId) {
      throw new UnauthorizedError();
    }

    const target = await prisma.user.findFirst({
      where: { id: userId, organizationId: actor.organizationId },
      select: { id: true, corporateRole: true },
    });
    if (!target) return actionError("errors.notFound");

    if (target.corporateRole === "CORPORATE_ADMIN") {
      await prisma.user.update({
        where: { id: target.id },
        data: { canDeleteTickets: value },
      });
      revalidatePath("/corporativo/usuarios");
      return actionOk();
    }

    if (target.corporateRole === "SUPERADMIN") {
      // Un SUPERADMIN siempre puede: el flag no aplica y no se toca.
      return actionOk();
    }

    if (!hotelId) return actionError("errors.validation");

    const access = await prisma.userHotelAccess.findFirst({
      where: { userId: target.id, hotelId, permissionLevel: "ADMIN" },
      select: { id: true },
    });
    // Un STAFF no aparece aquí a propósito: el permiso no es otorgable para él.
    if (!access) return actionError("errors.cannotDeleteTickets");

    await prisma.userHotelAccess.update({
      where: { id: access.id },
      data: { canDeleteTickets: value },
    });

    revalidatePath(`/${hotelId}/admin/usuarios`);
    return actionOk();
  } catch (error) {
    return toActionError(error);
  }
}

export async function setCorporateRole(
  userId: string,
  corporateRole: "NONE" | "CORPORATE_ADMIN" | "SUPERADMIN",
): Promise<ActionResult<void>> {
  try {
    const actor = await requireUser();
    if (!canManageOrganizationUsers(actor) || !actor.organizationId) {
      throw new UnauthorizedError();
    }
    // Nadie se degrada a sí mismo: dejaría a la organización sin superadmin.
    if (userId === actor.id) return actionError("errors.unauthorized");

    const target = await prisma.user.findFirst({
      where: { id: userId, organizationId: actor.organizationId },
      select: { id: true },
    });
    if (!target) return actionError("errors.notFound");

    await prisma.user.update({
      where: { id: target.id },
      data: {
        corporateRole,
        ...(corporateRole === "NONE" ? { canDeleteTickets: false } : {}),
      },
    });

    revalidatePath("/corporativo/usuarios");
    return actionOk();
  } catch (error) {
    return toActionError(error);
  }
}

/// Desactivar en vez de borrar: se conserva todo su historial (tickets que creó,
/// comentarios) y simplemente deja de poder entrar.
export async function setUserStatus(
  userId: string,
  status: "ACTIVE" | "DISABLED",
): Promise<ActionResult<void>> {
  try {
    const actor = await requireUser();
    if (!canManageOrganizationUsers(actor) || !actor.organizationId) {
      throw new UnauthorizedError();
    }
    if (userId === actor.id) return actionError("errors.unauthorized");

    const target = await prisma.user.findFirst({
      where: { id: userId, organizationId: actor.organizationId },
      select: { id: true },
    });
    if (!target) return actionError("errors.notFound");

    await prisma.user.update({ where: { id: target.id }, data: { status } });

    revalidatePath("/corporativo/usuarios");
    return actionOk();
  } catch (error) {
    return toActionError(error);
  }
}
