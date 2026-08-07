import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

/// Utilidad de desarrollo: imprime slugs de QR para probar la ruta pública.
async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  const now = new Date();
  const occupied = await prisma.room.findFirst({
    where: { roomStays: { some: { checkIn: { lte: now }, checkOut: { gte: now } } } },
    select: { number: true, qrSlug: true },
  });
  const free = await prisma.room.findFirst({
    where: { roomStays: { none: { checkIn: { lte: now }, checkOut: { gte: now } } } },
    select: { number: true, qrSlug: true },
  });
  console.log("OCUPADA", occupied?.number, occupied?.qrSlug);
  console.log("LIBRE", free?.number, free?.qrSlug);
  await prisma.$disconnect();
}
main();
