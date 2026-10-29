import { describe, expect, it } from "vitest";
import { preciosDesdeArgly, preciosDesdeCSV } from "./precios-oficiales";

const csv = `provincia,localidad,direccion,producto,tipohorario,precio,empresabandera
TUCUMAN,SAN MIGUEL DE TUCUMAN,Av 1,Gas Oil Grado 2,Diurno,1500,YPF
TUCUMAN,SAN MIGUEL DE TUCUMAN,Av 1,Gas Oil Grado 2,Nocturno,1400,YPF
TUCUMAN,SAN MIGUEL DE TUCUMAN,Av 2,Gas Oil Grado 2,Diurno,1600,SHELL C.A.P.S.A.
SALTA,SALTA,Av 3,Gas Oil Grado 2,Diurno,1700,YPF`;

describe("precios oficiales", () => {
  it("CSV: solo YPF diurno de la ciudad", () => expect(preciosDesdeCSV(csv, "Tucumán", "San Miguel de Tucumán")?.precios).toEqual({ gasoil_g2: 1500 }));
  it("CSV: todo el país promedia YPF de todas las provincias", () => expect(preciosDesdeCSV(csv, "", "")?.precios).toEqual({ gasoil_g2: 1600 }));
  it("CSV: si la ciudad no tiene YPF diurno, usa lo que haya", () => {
    const soloNocturno = `provincia,localidad,direccion,producto,tipohorario,precio,empresabandera
TUCUMAN,TAFI DEL VALLE,Av 9,Gas Oil Grado 2,Nocturno,1800,YPF`;
    const r = preciosDesdeCSV(soloNocturno, "TUCUMAN", "TAFI DEL VALLE");
    expect(r?.precios).toEqual({ gasoil_g2: 1800 });
    expect(r?.alcance).toContain("horario diurno y nocturno");
  });
  it("CSV: si la ciudad no tiene YPF, cae a toda la provincia", () => {
    const r = preciosDesdeCSV(csv, "TUCUMAN", "CONCEPCION");
    expect(r?.precios).toEqual({ gasoil_g2: 1500 });
    expect(r?.alcance).toContain("toda la provincia");
  });
  it("CSV: acepta precios con coma decimal y nombres de producto variantes", () => {
    const variante = `provincia,localidad,direccion,producto,tipohorario,precio,empresabandera
TUCUMAN,SAN MIGUEL DE TUCUMAN,Av 1,Nafta Super,Diurno,"1.234,56",YPF`;
    expect(preciosDesdeCSV(variante, "TUCUMAN", "SAN MIGUEL DE TUCUMAN")?.precios).toEqual({ nafta_super: 1234.56 });
  });
  it("CSV: usa el último precio de cada estación y descarta precios viejos", () => {
    const hist = `provincia,localidad,direccion,producto,tipohorario,precio,empresabandera,fecha_vigencia
TUCUMAN,SAN MIGUEL DE TUCUMAN,Av 1,Gas Oil Grado 2,Diurno,1000,YPF,2026-08-01 00:00:00
TUCUMAN,SAN MIGUEL DE TUCUMAN,Av 1,Gas Oil Grado 2,Diurno,1500,YPF,2026-10-01 00:00:00
TUCUMAN,SAN MIGUEL DE TUCUMAN,Av 2,Gas Oil Grado 2,Diurno,700,YPF,2025-01-01 00:00:00
TUCUMAN,SAN MIGUEL DE TUCUMAN,Av 3,Gas Oil Grado 2,Diurno,1600,YPF,2026-09-15 00:00:00`;
    const r = preciosDesdeCSV(hist, "TUCUMAN", "SAN MIGUEL DE TUCUMAN");
    expect(r?.precios).toEqual({ gasoil_g2: 1550 });
    expect(r?.vigencia).toBe("2026-10-01");
  });
  it("Argly: sin YPF usa todas las marcas y lo avisa", () => {
    const r = preciosDesdeArgly([{ empresa: "SHELL", localidad: "SAN MIGUEL DE TUCUMAN", direccion: "x", combustible: "Nafta Súper", precios: { día: 2300 } }], "TUCUMAN", "SAN MIGUEL DE TUCUMAN");
    expect(r?.precios).toEqual({ nafta_super: 2300 });
    expect(r?.alcance).toContain("no hay datos de YPF");
  });
});
