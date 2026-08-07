import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthorizedCron } from "@/lib/cron";
import { sendBillingEmail } from "@/lib/email";

/// Pasa a EXPIRED las organizaciones cuya prueba venció sin pagar.
///
/// Corre una vez al día: es el máximo que permite Vercel Hobby y es suficiente,
/// porque un vencimiento de prueba no necesita precisión de minutos (sección 7.1).
/// El acceso operativo se restringe, pero no se borra nada — el cliente conserva
/// su información por si decide contratar después.
export async function GET(request: Request): Promise<NextResponse> {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const expired = await prisma.organization.findMany({
    where: {
      subscriptionStatus: "TRIALING",
      trialEndsAt: { lt: new Date() },
    },
    select: {
      id: true,
      name: true,
      users: {
        where: { corporateRole: "SUPERADMIN", status: "ACTIVE" },
        select: { name: true, email: true, preferredLocale: true },
      },
    },
  });

  for (const organization of expired) {
    await prisma.organization.update({
      where: { id: organization.id },
      data: { subscriptionStatus: "EXPIRED" },
    });

    await Promise.all(
      organization.users.map((user) =>
        sendBillingEmail(user, "trialExpired", { organizationName: organization.name }),
      ),
    );
  }

  return NextResponse.json({ expired: expired.length });
}
