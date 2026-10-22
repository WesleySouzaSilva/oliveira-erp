import { describe, it, expect } from "vitest";

// Test the recurrence date calculation logic from useAcordos
function calcNextDate(dateStr: string, intervalo: string): string {
  // "yyyy-MM-dd" é dia puro: parse e escrita em UTC para a conta não mudar com o fuso da
  // máquina (em UTC-3, setMonth sobre o dia 01 acabava virando 02/05 e o teste falhava).
  const [ano, mes, dia] = dateStr.split("-").map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  switch (intervalo) {
    case "semanal": d.setUTCDate(d.getUTCDate() + 7); break;
    case "quinzenal": d.setUTCDate(d.getUTCDate() + 14); break;
    case "mensal": d.setUTCMonth(d.getUTCMonth() + 1); break;
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
