import { NextResponse } from "next/server";
import { differenceInCalendarDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { isAuthorizedCron } from "@/lib/cron";
import { sendBillingEmail } from "@/lib/email";

/// Avisa a las organizaciones cuya prueba termina en 3 días o menos.
///
/// `trialReminderSentAt` evita que el correo salga un día tras otro durante los
/// últimos 3 días: el aviso sirve una vez, repetirlo tres veces es spam.
export async function GET(request: Request): Promise<NextResponse> {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const threshold = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const expiring = await prisma.organization.findMany({
    where: {
      subscriptionStatus: "TRIALING",
      trialEndsAt: { gte: now, lte: threshold },
      trialReminderSentAt: null,
    },
    select: {
      id: true,
      name: true,
      trialEndsAt: true,
      users: {
        where: { corporateRole: "SUPERADMIN", status: "ACTIVE" },
        select: { name: true, email: true, preferredLocale: true },
      },
    },
  });

  for (const organization of expiring) {
    const days = organization.trialEndsAt
      ? Math.max(differenceInCalendarDays(organization.trialEndsAt, now), 0)
      : 0;

    await Promise.all(
      organization.users.map((user) =>
        sendBillingEmail(user, "trialEnding", {
          organizationName: organization.name,
          days,
        }),
      ),
    );

    await prisma.organization.update({
      where: { id: organization.id },
      data: { trialReminderSentAt: now },
    });
  }

  return NextResponse.json({ notified: expiring.length });
}
