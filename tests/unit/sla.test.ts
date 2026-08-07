import { describe, expect, it } from "vitest";
import {
  calculateSlaDueAt,
  isSlaOverdue,
  metSla,
  minutesUntilSlaDue,
  PRIORITY_SLA_MULTIPLIER,
} from "@/lib/sla";

const BASE = new Date("2026-03-01T10:00:00.000Z");

describe("calculateSlaDueAt", () => {
  it("aplica el multiplicador de prioridad sobre el SLA del departamento", () => {
    // El ejemplo textual de la sección 4.3: base de 30 min → HIGH 30, MEDIUM 60, LOW 120
    expect(calculateSlaDueAt(30, "HIGH", BASE)).toEqual(
      new Date("2026-03-01T10:30:00.000Z"),
    );
    expect(calculateSlaDueAt(30, "MEDIUM", BASE)).toEqual(
      new Date("2026-03-01T11:00:00.000Z"),
    );
    expect(calculateSlaDueAt(30, "LOW", BASE)).toEqual(
      new Date("2026-03-01T12:00:00.000Z"),
    );
  });

  it("los multiplicadores son los del plan", () => {
    expect(PRIORITY_SLA_MULTIPLIER).toEqual({ HIGH: 1, MEDIUM: 2, LOW: 4 });
  });

  it("devuelve null si el departamento no maneja SLA", () => {
    expect(calculateSlaDueAt(null, "HIGH", BASE)).toBeNull();
    expect(calculateSlaDueAt(undefined, "HIGH", BASE)).toBeNull();
  });

  it("trata un SLA de cero o negativo como ausencia de SLA", () => {
    // Un SLA de 0 min haría que todo naciera vencido; se ignora a propósito.
    expect(calculateSlaDueAt(0, "HIGH", BASE)).toBeNull();
    expect(calculateSlaDueAt(-15, "HIGH", BASE)).toBeNull();
  });
});

describe("isSlaOverdue", () => {
  const past = new Date("2026-03-01T09:00:00.000Z");
  const future = new Date("2026-03-01T11:00:00.000Z");

  it("marca vencido un ticket abierto cuya fecha ya pasó", () => {
    expect(isSlaOverdue({ slaDueAt: past, status: "PENDING" }, BASE)).toBe(true);
    expect(isSlaOverdue({ slaDueAt: past, status: "IN_PROGRESS" }, BASE)).toBe(true);
  });

  it("no marca vencido lo que ya cerró, aunque la fecha haya pasado", () => {
    // Un ticket resuelto tarde ya no corre contra el reloj: eso lo mide metSla.
    expect(isSlaOverdue({ slaDueAt: past, status: "RESOLVED" }, BASE)).toBe(false);
    expect(isSlaOverdue({ slaDueAt: past, status: "CANCELLED" }, BASE)).toBe(false);
  });

  it("no marca vencido lo que aún tiene tiempo", () => {
    expect(isSlaOverdue({ slaDueAt: future, status: "PENDING" }, BASE)).toBe(false);
  });

  it("un ticket sin SLA nunca vence", () => {
    expect(isSlaOverdue({ slaDueAt: null, status: "PENDING" }, BASE)).toBe(false);
  });
});

describe("minutesUntilSlaDue", () => {
  it("devuelve minutos restantes y negativo si ya venció", () => {
    expect(
      minutesUntilSlaDue(
        { slaDueAt: new Date("2026-03-01T10:45:00.000Z"), status: "PENDING" },
        BASE,
      ),
    ).toBe(45);

    expect(
      minutesUntilSlaDue(
        { slaDueAt: new Date("2026-03-01T09:30:00.000Z"), status: "PENDING" },
        BASE,
      ),
    ).toBe(-30);
  });

  it("devuelve null si no aplica", () => {
    expect(minutesUntilSlaDue({ slaDueAt: null, status: "PENDING" }, BASE)).toBeNull();
    expect(
      minutesUntilSlaDue({ slaDueAt: BASE, status: "RESOLVED" }, BASE),
    ).toBeNull();
  });
});

describe("metSla", () => {
  it("se cumple si se resolvió antes o justo en la fecha límite", () => {
    const due = new Date("2026-03-01T11:00:00.000Z");
    expect(metSla({ slaDueAt: due, resolvedAt: new Date("2026-03-01T10:59:00.000Z") })).toBe(true);
    expect(metSla({ slaDueAt: due, resolvedAt: due })).toBe(true);
  });

  it("no se cumple si se resolvió después", () => {
    expect(
      metSla({
        slaDueAt: new Date("2026-03-01T11:00:00.000Z"),
        resolvedAt: new Date("2026-03-01T11:01:00.000Z"),
      }),
    ).toBe(false);
  });

  it("queda fuera del cálculo si no hubo SLA o sigue abierto", () => {
    // Devolver null y no false es lo que impide que los tickets sin SLA
    // inflen artificialmente el porcentaje de cumplimiento.
    expect(metSla({ slaDueAt: null, resolvedAt: BASE })).toBeNull();
    expect(metSla({ slaDueAt: BASE, resolvedAt: null })).toBeNull();
  });
});
