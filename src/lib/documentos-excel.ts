import type { Documento } from "./documentos";
import { totalItem } from "./documentos";
import { limpiarDocumento } from "./documentos-filtrado";
import { cabeceraDocumento, COLUMNAS_DOCUMENTO, filasDocumento } from "./documentos-salida";

export async function crearExcel(d: Documento) {
  d = limpiarDocumento(d);
  // Imported only when exporting: no Excel runtime in SSR or the initial page.
  const { Workbook } = await import("exceljs");
  const wb = new Workbook();
  const hoja = wb.addWorksheet("Detalle");
  [16, 12, 48, 18, 18].forEach((w, i) => { hoja.getColumn(i + 1).width = w; });
  const cab = cabeceraDocumento(d);
  cab.forEach(([k, v], idx) => {
    const r = idx + 1;
    hoja.getCell(`A${r}`).value = k;
    hoja.getCell(`A${r}`).font = { name: "Arial", size: 11, bold: true };
    hoja.mergeCells(`B${r}:E${r}`);
    hoja.getCell(`B${r}`).value = v;
    hoja.getCell(`B${r}`).numFmt = "@";
  });
  const enc = cab.length + 2;
  hoja.getRow(enc).values = COLUMNAS_DOCUMENTO;
  const filas = filasDocumento(d);
  d.items.forEach((i, idx) => {
    const fila = enc + 1 + idx;
    const valores = [...(filas[idx] ?? [])];
    valores[4] = null;
    const row = hoja.getRow(fila);
    row.values = valores;
    row.getCell(5).value = totalItem(i) === null ? null : { formula: `B${fila}*D${fila}`, result: totalItem(i) ?? 0 };
    row.getCell(1).numFmt = "@";
    if (i.totalLeido !== null) row.getCell(5).note = `Total leído en la foto: ${i.totalLeido} ARS. Source: documento revisado por el usuario.`;
  });
  const fin = enc + d.items.length + 1;
  hoja.getCell(`C${fin}`).value = "Total conocido (ARS)";
  hoja.getCell(`E${fin}`).value = { formula: `SUM(E${enc + 1}:E${fin - 1})`, result: d.items.reduce((s, i) => s + (totalItem(i) ?? 0), 0) };
  hoja.eachRow(row => row.eachCell(cell => { cell.font = { name: "Arial", size: 11, bold: cell.font?.bold === true }; }));
  hoja.getRow(enc).font = { name: "Arial", size: 11, bold: true };
  hoja.getCell(`C${fin}`).font = hoja.getCell(`E${fin}`).font = { name: "Arial", size: 11, bold: true };
  for (let r = enc + 1; r <= fin; r++) for (const c of ["D", "E"]) hoja.getCell(`${c}${r}`).numFmt = '#,##0.00;(#,##0.00);"-"';
  hoja.pageSetup = { orientation: "portrait", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: `${enc}:${enc}` };
  wb.calcProperties.fullCalcOnLoad = true;
  return wb.xlsx.writeBuffer();
}
export async function exportarDocumento(d: Documento) {
  const datos = await crearExcel(d);
  const url = URL.createObjectURL(new Blob([new Uint8Array(datos)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${d.tipo}-${d.numero || d.fecha}.xlsx`.replace(/[\\/:*?"<>|]/g, "-");
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
