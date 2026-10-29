import { describe, expect, it } from "vitest";
import { costo, litros, promediarPrecios } from "./flota";

describe("flota", () => {
  it("vehículo: litros por 100 km", () => expect(litros({ medida: "km", consumo: 10 }, 250)).toBe(25));
  it("maquinaria: litros por hora", () => expect(litros({ medida: "horas", consumo: 8 }, 5)).toBe(40));
  it("costo = litros × precio", () => expect(costo({ medida: "km", consumo: 10 }, 100, 1500)).toBe(15000));
  it("promedia precios oficiales por producto", () =>
    expect(promediarPrecios([{ producto: "Gas Oil Grado 2", precio: 1400 }, { producto: "Gas Oil Grado 2", precio: 1500 }, { producto: "GNC", precio: 700 }])).toEqual({ gasoil_g2: 1450 }));
});
