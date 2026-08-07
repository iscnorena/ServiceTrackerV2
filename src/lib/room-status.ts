import "server-only";
import { prisma } from "@/lib/prisma";

/// Recalcula `Room.status` a partir de los tickets abiertos y de la ocupación.
///
/// La regla clave (sección 4.3): si hay varios tickets abiertos simultáneos de
/// departamentos que afectan el estatus, la habitación solo vuelve a la normalidad
/// cuando **todos** están cerrados — no basta con resolver uno.
export async function syncRoomStatus(roomStayId: string): Promise<void> {
  const stay = await prisma.roomStay.findUnique({
    where: { id: roomStayId },
    select: { roomId: true },
  });
  if (!stay) return;

  await syncRoomStatusByRoom(stay.roomId);
}

export async function syncRoomStatusByRoom(roomId: string): Promise<void> {
  const now = new Date();

  const [openBlockingTickets, activeStay] = await Promise.all([
    prisma.ticket.count({
      where: {
        deletedAt: null,
        status: { in: ["PENDING", "IN_PROGRESS"] },
        department: { affectsRoomStatus: true },
        roomStay: { roomId },
      },
    }),
    prisma.roomStay.findFirst({
      where: { roomId, checkIn: { lte: now }, checkOut: { gte: now } },
      select: { id: true },
    }),
  ]);

  const status = openBlockingTickets > 0
    ? "MAINTENANCE"
    : activeStay
      ? "OCCUPIED"
      : "AVAILABLE";

  await prisma.room.update({ where: { id: roomId }, data: { status } });
}
