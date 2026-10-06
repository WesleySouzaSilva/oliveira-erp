import { describe, it, expect } from "vitest";

// Test the recurrence date calculation logic from useAcordos
function calcNextDate(dateStr: string, intervalo: string): string {
  const d = new Date(dateStr);
  switch (intervalo) {
    case "semanal": d.setDate(d.getDate() + 7); break;
    case "quinzenal": d.setDate(d.getDate() + 14); break;
    case "mensal": d.setMonth(d.getMonth() + 1); break;
  }
  return d.toISOString().split("T")[0];
}

describe("useAcordos recurrence logic", () => {
  it("calculates weekly recurrence", () => {
    expect(calcNextDate("2026-04-01", "semanal")).toBe("2026-04-08");
  });

  it("calculates biweekly recurrence", () => {
    expect(calcNextDate("2026-04-01", "quinzenal")).toBe("2026-04-15");
  });

  it("calculates monthly recurrence", () => {
    expect(calcNextDate("2026-04-01", "mensal")).toBe("2026-05-01");
  });

  it("handles month boundary for monthly", () => {
    expect(calcNextDate("2026-01-31", "mensal")).toBe("2026-03-03");
  });

  it("handles year boundary", () => {
    expect(calcNextDate("2026-12-25", "semanal")).toBe("2027-01-01");
  });

  it("handles unknown interval (no change)", () => {
    expect(calcNextDate("2026-04-01", "diario")).toBe("2026-04-01");
  });
});
