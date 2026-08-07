import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { ShiftNotesManager } from "@/components/shift-notes/shift-notes-manager";
import { requireHotelContext, hotelFilter } from "@/lib/hotel-scope";
import { prisma } from "@/lib/prisma";

export default async function ShiftNotesPage({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;
  const ctx = await requireHotelContext(hotelId);
  const t = await getTranslations("shiftNotes");

  const [notes, departments] = await Promise.all([
    prisma.shiftNote.findMany({
      where: hotelFilter(ctx),
      select: {
        id: true,
        content: true,
        createdAt: true,
        author: { select: { name: true } },
        department: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.department.findMany({
      where: { hotelId: ctx.hotelId, active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <>
      <PageHeader title={t("title")} />
      <ShiftNotesManager
        hotelId={hotelId}
        notes={notes}
        departments={departments}
        defaultDepartmentId={ctx.access.departmentId}
      />
    </>
  );
}
