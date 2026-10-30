import { describe, expect, it } from "vitest";
import { debeRevalidar, dentroDeGraciaOffline, DIAS_GRACIA_OFFLINE, HORAS_ENTRE_VALIDACIONES, type EstadoLicencia } from "./licencia";

const estado = (haceHoras: number): EstadoLicencia => ({
  clave: "LIC-AAAA-BBBB",
  cliente: "Cliente de prueba",
  vencimiento: null,
  ultimaValidacion: new Date(Date.now() - haceHoras * 3_600_000).toISOString(),
});

describe("licencia", () => {
  it("revalida solo después de las horas configuradas", () => {
    expect(debeRevalidar(estado(HORAS_ENTRE_VALIDACIONES - 1), new Date())).toBe(false);
    expect(debeRevalidar(estado(HORAS_ENTRE_VALIDACIONES + 1), new Date())).toBe(true);
  });

  it("el período de gracia offline dura los días configurados", () => {
    expect(dentroDeGraciaOffline(estado(24 * (DIAS_GRACIA_OFFLINE - 1)), new Date())).toBe(true);
    expect(dentroDeGraciaOffline(estado(24 * (DIAS_GRACIA_OFFLINE + 1)), new Date())).toBe(false);
  });

  it("los límites son 12 horas entre validaciones y 7 días de gracia", () => {
    expect(HORAS_ENTRE_VALIDACIONES).toBe(12);
    expect(DIAS_GRACIA_OFFLINE).toBe(7);
  });
});
