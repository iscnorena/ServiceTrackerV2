import type { TicketPriority, TicketStatus } from "@/generated/prisma/enums";

/// Multiplicador de prioridad sobre el SLA base del departamento (sección 4.3):
/// HIGH sin ajuste, MEDIUM x2, LOW x4. Ejemplo con SLA base de 30 min →
/// HIGH vence en 30, MEDIUM en 60, LOW en 120.
export const PRIORITY_SLA_MULTIPLIER: Record<TicketPriority, number> = {
  HIGH: 1,
  MEDIUM: 2,
  LOW: 4,
};

/// Estados en los que un ticket ya no corre contra el reloj del SLA.
const CLOSED_STATUSES: TicketStatus[] = ["RESOLVED", "CANCELLED"];

/// Calcula la fecha de vencimiento del SLA al crear (o reprioriza) un ticket.
/// Devuelve `null` si el departamento no maneja SLA — en ese caso el ticket
/// simplemente no genera alertas.
export function calculateSlaDueAt(
  defaultSlaMinutes: number | null | undefined,
  priority: TicketPriority,
  from: Date = new Date(),
): Date | null {
  if (defaultSlaMinutes == null || defaultSlaMinutes <= 0) return null;
  const minutes = defaultSlaMinutes * PRIORITY_SLA_MULTIPLIER[priority];
  return new Date(from.getTime() + minutes * 60_000);
}

/// Un ticket está vencido si tenía SLA, sigue abierto, y ya pasó la fecha.
export function isSlaOverdue(
  ticket: { slaDueAt: Date | null; status: TicketStatus },
  now: Date = new Date(),
): boolean {
  if (!ticket.slaDueAt) return false;
  if (CLOSED_STATUSES.includes(ticket.status)) return false;
  return ticket.slaDueAt.getTime() < now.getTime();
}

/// Minutos restantes (negativo si ya venció). `null` si el ticket no maneja SLA.
export function minutesUntilSlaDue(
  ticket: { slaDueAt: Date | null; status: TicketStatus },
  now: Date = new Date(),
): number | null {
  if (!ticket.slaDueAt) return null;
  if (CLOSED_STATUSES.includes(ticket.status)) return null;
  return Math.round((ticket.slaDueAt.getTime() - now.getTime()) / 60_000);
}

/// Se cumplió el SLA si el ticket se resolvió antes de su fecha límite.
/// Los tickets sin SLA quedan fuera del cálculo de cumplimiento (devuelve null).
export function metSla(ticket: {
  slaDueAt: Date | null;
  resolvedAt: Date | null;
}): boolean | null {
  if (!ticket.slaDueAt || !ticket.resolvedAt) return null;
  return ticket.resolvedAt.getTime() <= ticket.slaDueAt.getTime();
}
