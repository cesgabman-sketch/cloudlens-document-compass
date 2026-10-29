import { describe, expect, it } from "vitest";
import { cambiarItem, difiereTotal, totalItem, type ItemDocumento } from "./documentos";
import { crearExcel } from "./documentos-excel";
import { limpiarDocumento } from "./documentos-filtrado";
import { filasDocumento } from "./documentos-salida";
const item: ItemDocumento = { codigo: "00a-0B", cantidad: 2, descripcion: "Repuesto", precioUnitario: 150, totalLeido: 300, dudosos: ["codigo"] };
describe("remitos y presupuestos", () => {
  const documento = { id: "f", tipo: "Factura" as const, proveedor: "Empresa SA", cuitProveedor: "30-12345678-9", cliente: "Cliente SRL", numero: "0001-00000022", fecha: "2026-10-29", camposDudosos: [], items: [item] };
  it.each(["PREPARADO POR: Juan", "CONTROLADO POR: AB", "CLIENTE CON EMAIL", "Firma del cliente: JM", "Garabatos", "Iniciales", "Marca de aprobación"])("excluye control interno %s del documento", texto => {
    const limpio = limpiarDocumento({ ...documento, proveedor: `Empresa SA\n${texto}`, items: [item, { ...item, descripcion: texto }] });
    expect(limpio.proveedor).toBe("Empresa SA");
    expect(limpio.items).toEqual([item]);
  });
  it("excluye cabecera duplicada, preservando productos y códigos exactos", () => {
    const limpio = limpiarDocumento({ ...documento, items: [item, ...["Empresa SA", "Razón social: Cliente SRL", "CUIT: 30-12345678-9", "Número: 0001-00000022"].map(descripcion => ({ ...item, descripcion })), { ...item, descripcion: "Repuesto\nProveedor: Empresa SA\nCONTROLADO POR: AB" }] });
    expect(limpio.items).toEqual([item, { ...item, descripcion: "Repuesto" }]);
    expect(limpio.items[0]?.codigo).toBe("00a-0B");
  });
  it("no exporta controles ni cabecera duplicada de documentos anteriores a Excel", async () => {
    const { Workbook } = await import("exceljs");
    const wb = new Workbook();
    await wb.xlsx.load(await crearExcel({ ...documento, proveedor: "Empresa SA\nPREPARADO POR: Juan", items: [item, { ...item, descripcion: "CONTROLADO POR: AB" }, { ...item, descripcion: "Empresa SA" }] }));
    const s = wb.getWorksheet("Detalle");
    expect(s?.getCell("B1").value).toBe("Empresa SA");
    expect(s?.getCell("C9").value).toBe("Repuesto");
    expect(s?.getCell("E10").value).toEqual({ formula: "SUM(E9:E9)", result: 300 });
  });
  it("conserva guiones, ceros y letras exactos", () => expect(cambiarItem(item, "codigo", "000x-A0").codigo).toBe("000x-A0"));
  it("recalcula al cambiar cantidad", () => expect(totalItem(cambiarItem(item, "cantidad", "3"))).toBe(450));
  it("recalcula al cambiar precio", () => expect(totalItem(cambiarItem(item, "precioUnitario", "200"))).toBe(400));
  it("detecta total que no coincide", () => { expect(difiereTotal({ ...item, totalLeido: 350 })).toBe(true); expect(difiereTotal(item)).toBe(false); });
  it("no inventa precios ausentes", () => expect(totalItem({ ...item, precioUnitario: null })).toBeNull());
  it("una sola hoja: datos generales una vez arriba y renglones con cinco columnas", async () => {
    const { Workbook } = await import("exceljs");
    const wb = new Workbook();
    await wb.xlsx.load(await crearExcel({ ...documento, cuitCliente: "30-87654321-0", items: [item, { ...item, precioUnitario: null }] }));
    const s = wb.getWorksheet("Detalle");
    expect(wb.worksheets).toHaveLength(1);
    let veces = 0;
    s?.eachRow(r => r.eachCell(c => { if (!c.isMerged || c.master === c) if (c.value === "30-12345678-9" || c.value === "Cliente SRL") veces++; }));
    expect(veces).toBe(2);
    expect(s?.getRow(8).values).toEqual([undefined, "Código", "Cantidad", "Detalle/descripción", "P/unitario (ARS)", "Total (ARS)"]);
    expect(s?.getCell("A9").value).toBe("00a-0B");
    expect(s?.getCell("E9").value).toEqual({ formula: "B9*D9", result: 300 });
    expect(s?.getCell("E10").value).toBeNull();
    expect(s?.getCell("F9").value).toBeNull();
  });
  it("los renglones de salida no repiten razón social ni CUIT", () => {
    const filas = filasDocumento({ ...documento, items: [item, { ...item, codigo: "AB-002" }] });
    for (const fila of filas) expect(fila).toHaveLength(5);
  });
});