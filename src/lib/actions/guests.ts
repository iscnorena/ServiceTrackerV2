"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireHotelContext } from "@/lib/hotel-scope";
import { syncRoomStatusByRoom } from "@/lib/room-status";
import { actionError, actionOk, toActionError, type ActionResult } from "@/lib/errors";

const guestSchema = z.object({
  hotelId: z.string().min(1),
  name: z.string().trim().min(2).max(120),
  email: z.email().optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional(),
});

export async function createGuest(
  input: z.infer<typeof guestSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = guestSchema.safeParse(input);
    if (!parsed.success) return actionError("errors.validation");

    const ctx = await requireHotelContext(parsed.data.hotelId);

    const guest = await prisma.guest.create({
      data: {
        hotelId: ctx.hotelId,
        name: parsed.data.name,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
      },
      select: { id: true },
    });

    revalidatePath(`/${ctx.hotelId}/huespedes`);
    return actionOk(guest);
  } catch (error) {
    return toActionError(error);
  }
}

const reservationSchema = z.object({
  hotelId: z.string().min(1),
  guestId: z.string().min(1),
  checkIn: z.string().min(1),
  checkOut: z.string().min(1),
  notes: z.string().trim().max(500).optional(),
  /// Una reserva puede abarcar varias habitaciones, y cada una lleva su propia
  /// persona de contacto: el titular no está físicamente en todos los cuartos.
  stays: z
    .array(
      z.object({
        roomId: z.string().min(1),
        contactName: z.string().trim().min(2).max(120),
        contactPhone: z.string().trim().max(40).optional(),
      }),
    )
    .min(1),
});

export async function createReservation(
  input: z.infer<typeof reservationSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = reservationSchema.safeParse(input);
    if (!parsed.success) return actionError("errors.validation");

    const ctx = await requireHotelContext(parsed.data.hotelId);

    const checkIn = new Date(parsed.data.checkIn);
    const checkOut = new Date(parsed.data.checkOut);
    if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) {
      return actionError("errors.validation");
    }
    if (checkOut <= checkIn) return actionError("reservations.invalidDates");

    const guest = await prisma.guest.findFirst({
      where: { id: parsed.data.guestId, hotelId: ctx.hotelId },
      select: { id: true },
    });
    if (!guest) return actionError("errors.notFound");

    const roomIds = parsed.data.stays.map((stay) => stay.roomId);
    const rooms = await prisma.room.findMany({
      where: { id: { in: roomIds }, hotelId: ctx.hotelId },
      select: { id: true, number: true },
    });
    if (rooms.length !== new Set(roomIds).size) return actionError("errors.notFound");

    // Se rechaza el traslape en vez de permitir dos ocupaciones simultáneas del
    // mismo cuarto: si no, un ticket por QR no sabría a qué contacto pertenece.
    const overlapping = await prisma.roomStay.findFirst({
      where: {
        roomId: { in: roomIds },
        checkIn: { lt: checkOut },
        checkOut: { gt: checkIn },
      },
      select: { room: { select: { number: true } } },
    });
    if (overlapping) {
      return actionError("reservations.roomTaken");
    }

    const reservation = await prisma.reservation.create({
      data: {
        hotelId: ctx.hotelId,
        guestId: guest.id,
        checkIn,
        checkOut,
        notes: parsed.data.notes || null,
        roomStays: {
          create: parsed.data.stays.map((stay) => ({
            roomId: stay.roomId,
            contactName: stay.contactName,
            contactPhone: stay.contactPhone || null,
            checkIn,
            checkOut,
          })),
        },
      },
      select: { id: true },
    });

    for (const roomId of roomIds) await syncRoomStatusByRoom(roomId);

    revalidatePath(`/${ctx.hotelId}/huespedes`);
    revalidatePath(`/${ctx.hotelId}/habitaciones`);
    return actionOk(reservation);
  } catch (error) {
    return toActionError(error);
  }
}
