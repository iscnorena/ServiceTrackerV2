import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

/// Utilidad de desarrollo: pone la prueba de las organizaciones TRIALING al
/// borde del vencimiento, para probar los crons de aviso y de expiración sin
/// esperar días reales. Recibe los días restantes como argumento (default -1).
async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const days = Number(process.argv[2] ?? -1);

  const updated = await prisma.organization.updateMany({
    where: { subscriptionStatus: "TRIALING" },
    data: {
      trialEndsAt: new Date(Date.now() + days * 86_400_000),
      trialReminderSentAt: null,
    },
  });

  console.log(`organizaciones con prueba a ${days} días:`, updated.count);
  await prisma.$disconnect();
}

main();
