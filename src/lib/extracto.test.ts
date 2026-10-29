import { describe, expect, it } from "vitest";
import { rangoPeriodo } from "./extracto";

describe("rangoPeriodo", () => {
  it("diario es solo ese día", () => expect(rangoPeriodo("diario", "2026-10-19")).toEqual({ desde: "2026-10-19", hasta: "2026-10-19" }));
  it("semanal va de lunes a domingo", () => expect(rangoPeriodo("semanal", "2026-10-22")).toEqual({ desde: "2026-10-19", hasta: "2026-10-25" }));
  it("mensual cubre el mes entero", () => expect(rangoPeriodo("mensual", "2026-02-10")).toEqual({ desde: "2026-02-01", hasta: "2026-02-28" }));
});
