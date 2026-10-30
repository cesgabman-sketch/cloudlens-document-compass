import type { Gasto } from "./gastos";
import { totalGastos } from "./gastos";

const m = (n: number) => n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
const f = (d: string) => d.split("-").reverse().join("/");
const esc = (t: string) => t.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
const COLS = ["Fecha", "Concepto", "Categoría", "Monto (ARS)"];

function bajar(blob: Blob, archivo: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = archivo;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function html(lista: Gasto[], titulo: string) {
  const filas = lista.map(g => `<tr><td>${f(g.fecha)}</td><td>${esc(g.concepto)}</td><td>${esc(g.categoria)}</td><td style="text-align:right">${m(g.monto)}</td></tr>`).join("");
  return `<html><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>@page{size:A4}body{font-family:Arial;font-size:10pt}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:4px;text-align:left}th{background:#eee}tr{break-inside:avoid}</style></head><body><h2>${esc(titulo)}</h2><table><thead><tr>${COLS.map(c => `<th>${c}</th>`).join("")}</tr></thead><tbody>${filas}<tr><td colspan="3"><b>Total</b></td><td style="text-align:right"><b>${m(totalGastos(lista))}</b></td></tr></tbody></table></body></html>`;
}

export async function gastosExcel(lista: Gasto[], titulo: string) {
  const { Workbook } = await import("exceljs");
  const wb = new Workbook();
  const h = wb.addWorksheet("Gastos");
  [12, 48, 18, 18].forEach((w, i) => { h.getColumn(i + 1).width = w; });
  h.getRow(1).values = COLS; h.getRow(1).font = { name: "Arial", bold: true };
  lista.forEach((g, i) => { h.getRow(i + 2).values = [f(g.fecha), g.concepto, g.categoria, g.monto]; });
  const fin = lista.length + 2;
  h.getCell(`C${fin}`).value = "Total";
  h.getCell(`D${fin}`).value = { formula: `SUM(D2:D${fin - 1})`, result: totalGastos(lista) };
  h.getCell(`C${fin}`).font = h.getCell(`D${fin}`).font = { name: "Arial", bold: true };
  for (let r = 2; r <= fin; r++) h.getCell(`D${r}`).numFmt = "#,##0.00";
  const datos = await wb.xlsx.writeBuffer();
  bajar(new Blob([new Uint8Array(datos)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${titulo}.xlsx`);
}

export function gastosWord(lista: Gasto[], titulo: string) {
  bajar(new Blob(["\ufeff", html(lista, titulo)], { type: "application/msword" }), `${titulo}.doc`);
}

/** Abre el diálogo de impresión; desde ahí se puede imprimir o "Guardar como PDF". */
export function gastosImprimir(lista: Gasto[], titulo: string) {
  const fr = document.createElement("iframe");
  fr.style.position = "fixed"; fr.style.width = "0"; fr.style.height = "0"; fr.style.border = "0";
  document.body.appendChild(fr);
  const doc = fr.contentDocument;
  if (!doc) { fr.remove(); return; }
  doc.open(); doc.write(html(lista, titulo)); doc.close();
  setTimeout(() => { fr.contentWindow?.print(); setTimeout(() => fr.remove(), 60_000); }, 300);
}

export function gastosMail(lista: Gasto[], titulo: string) {
  const cuerpo = `${titulo}\n\n${COLS.join(" | ")}\n${lista.map(g => `${f(g.fecha)} | ${g.concepto} | ${g.categoria} | ${m(g.monto)}`).join("\n")}\nTotal: ${m(totalGastos(lista))}`;
  window.location.href = `mailto:?subject=${encodeURIComponent(titulo)}&body=${encodeURIComponent(cuerpo)}`;
}
