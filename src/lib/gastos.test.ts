import { describe, expect, it } from "vitest";
import { esGastoValido, totalGastos } from "./gastos";

const g = { id: "1", fecha: "2026-10-19", concepto: "Nafta", monto: 1500, categoria: "Combustible", origen: "manual" as const };

describe("gastos", () => {
  it("acepta un gasto completo", () => expect(esGastoValido(g)).toBe(true));
  it("rechaza monto cero o sin concepto", () => {
    expect(esGastoValido({ ...g, monto: 0 })).toBe(false);
    expect(esGastoValido({ ...g, concepto: " " })).toBe(false);
  });
  it("suma el total", () => expect(totalGastos([g, { ...g, id: "2", monto: 500 }])).toBe(2000));
});
