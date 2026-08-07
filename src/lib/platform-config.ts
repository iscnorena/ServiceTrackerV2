import "server-only";
import { prisma } from "@/lib/prisma";

export const DEFAULT_PLATFORM_CONFIG = {
  pricePerHotelMonthly: 1499,
  currency: "MXN",
  trialDays: 14,
  trialHotelLimit: 1,
};

export type PlatformConfigValues = {
  id: string;
  pricePerHotelMonthly: number;
  currency: string;
  trialDays: number;
  trialHotelLimit: number;
};

/// Siempre existe un único registro de configuración. Si la base está recién
/// creada se materializa con los valores por defecto, para que ninguna pantalla
/// tenga que manejar el caso "todavía no hay configuración".
export async function getPlatformConfig(): Promise<PlatformConfigValues> {
  const existing = await prisma.platformConfig.findFirst();
  const config =
    existing ??
    (await prisma.platformConfig.create({ data: DEFAULT_PLATFORM_CONFIG }));

  return {
    id: config.id,
    pricePerHotelMonthly: Number(config.pricePerHotelMonthly),
    currency: config.currency,
    trialDays: config.trialDays,
    trialHotelLimit: config.trialHotelLimit,
  };
}
