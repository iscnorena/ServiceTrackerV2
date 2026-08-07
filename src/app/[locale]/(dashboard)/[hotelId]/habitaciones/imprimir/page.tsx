import { getTranslations } from "next-intl/server";
import QRCode from "qrcode";
import { requireHotelContext } from "@/lib/hotel-scope";
import { prisma } from "@/lib/prisma";
import { PrintButton } from "@/components/rooms/print-button";

/// Hoja imprimible con el QR de cada habitación, una por página.
///
/// Se resuelve con CSS de impresión en vez de generar un PDF en el servidor: el
/// navegador ya sabe imprimir y guardar como PDF, y así el resultado usa las
/// fuentes y el idioma que el usuario tiene activos, sin una segunda plantilla
/// que mantener aparte.
export default async function PrintQrPage({
  params,
  searchParams,
}: {
  params: Promise<{ hotelId: string }>;
  searchParams: Promise<{ room?: string }>;
}) {
  const { hotelId } = await params;
  const { room: roomId } = await searchParams;
  const ctx = await requireHotelContext(hotelId);
  const t = await getTranslations("qr");

  const rooms = await prisma.room.findMany({
    where: { hotelId: ctx.hotelId, active: true, ...(roomId ? { id: roomId } : {}) },
    select: { id: true, number: true, qrSlug: true },
    orderBy: [{ floor: "asc" }, { number: "asc" }],
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const sheets = await Promise.all(
    rooms.map(async (room) => {
      const url = `${baseUrl}/qr/${room.qrSlug}`;
      return {
        id: room.id,
        number: room.number,
        url,
        // La URL en texto plano va impresa debajo del código: si el QR se
        // despega, se dobla o imprime borroso, todavía se puede teclear a mano.
        dataUrl: await QRCode.toDataURL(url, { width: 600, margin: 1 }),
      };
    }),
  );

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 print:hidden">
        <PrintButton />
      </div>

      {sheets.map((sheet) => (
        <section
          key={sheet.id}
          className="mb-8 break-after-page rounded-lg border bg-white p-10 text-center text-black print:mb-0 print:border-0"
        >
          <p className="text-sm tracking-wide text-neutral-600 uppercase">
            {ctx.access.name}
          </p>
          <h2 className="mt-2 mb-6 text-5xl font-bold">
            {t("printRoom", { number: sheet.number })}
          </h2>

          {/* Es un data: URI de un QR generado al vuelo, no un asset remoto:
              next/image no aporta nada y rompería la impresión. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={sheet.dataUrl}
            alt={`QR ${sheet.number}`}
            className="mx-auto size-64"
          />

          <p className="mt-6 text-lg">{t("printInstructions")}</p>
          <p className="mt-6 text-sm text-neutral-600">{t("printFallback")}</p>
          <p className="mt-1 font-mono text-base break-all">{sheet.url}</p>
        </section>
      ))}
    </div>
  );
}
