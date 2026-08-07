import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

/// Utilidad de desarrollo: adelanta el reloj de las plantillas recurrentes para
/// poder probar el cron sin esperar al siguiente ciclo real.
async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const updated = await prisma.recurringTicketTemplate.updateMany({
    data: { nextRunAt: new Date(Date.now() - 86_400_000) },
  });

  console.log("plantillas marcadas como vencidas:", updated.count);
  console.log("tickets antes del cron:", await prisma.ticket.count());

  await prisma.$disconnect();
}

main();
