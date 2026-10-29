import { describe, expect, it } from "vitest";
import { semaforo } from "./cheques";
const hoy = "2026-10-19";
const c = (fechaVencimiento: string, estado: any = "en cartera") => ({ fechaVencimiento, estado });
describe("semáforo", () => {
  it("rojo si vence hoy", () => expect(semaforo(c("2026-10-19"), hoy)).toBe("rojo"));
  it("rojo si vencido sin cobrar", () => expect(semaforo(c("2026-10-10"), hoy)).toBe("rojo"));
  it("amarillo a 1 día", () => expect(semaforo(c("2026-10-20"), hoy)).toBe("amarillo"));
  it("amarillo a 7 días", () => expect(semaforo(c("2026-10-26"), hoy)).toBe("amarillo"));
  it("verde a 8 días", () => expect(semaforo(c("2026-10-27"), hoy)).toBe("verde"));
  it("cobrado no alerta aunque esté vencido", () => expect(semaforo(c("2026-10-01", "cobrado"), hoy)).toBe("cerrado"));
});
