import type { Documento } from "./documentos";
import { totalDocumento } from "./documentos";
import { limpiarDocumento } from "./documentos-filtrado";
import { cabeceraDocumento, COLUMNAS_DOCUMENTO, filasDocumento } from "./documentos-salida";

const m = (n: number | null) => n === null ? "" : n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
const esc = (t: string) => t.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
const nombre = (d: Documento, ext: string) => `${d.tipo}-${d.numero || d.fecha}.${ext}`.replace(/[\\/:*?"<>|]/g, "-");

function html(d: Documento) {
  d = limpiarDocumento(d);
  const cab = cabeceraDocumento(d).map(([k, v]) => `<tr><th>${esc(k)}</th><td colspan="4">${esc(v)}</td></tr>`).join("");
  const filas = filasDocumento(d).map(fila => `<tr>${fila.map((valor, idx) => `<td>${esc(idx === 3 || idx === 4 ? m(typeof valor === "number" ? valor : null) : String(valor ?? ""))}</td>`).join("")}</tr>`).join("");
  return `<html><head><meta charset="utf-8"><title>${esc(d.tipo)} ${esc(d.numero)}</title><style>@page{size:A4}body{font-family:Arial;font-size:9pt}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:4px;overflow-wrap:anywhere;text-align:left}th{background:#eee}tr{break-inside:avoid}</style></head><body>
<table><tbody>${cab}<tr><td colspan="5" style="border:0">&nbsp;</td></tr>
<tr>${COLUMNAS_DOCUMENTO.map(c => `<th>${esc(c)}</th>`).join("")}</tr>${filas}
<tr><td colspan="4"><b>Total</b></td><td><b>${m(totalDocumento(d))}</b></td></tr></tbody></table></body></html>`;
}

function bajar(blob: Blob, archivo: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = archivo;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Word abre este .doc (HTML) y permite editarlo y guardarlo como .docx. */
export function exportarWord(d: Documento) {
  bajar(new Blob(["\ufeff", html(d)], { type: "application/msword" }), nombre(d, "doc"));
}

export function imprimirDocumento(d: Documento) {
  const f = document.createElement("iframe");
  f.style.position = "fixed"; f.style.width = "0"; f.style.height = "0"; f.style.border = "0";
  document.body.appendChild(f);
  const doc = f.contentDocument;
  if (!doc) { f.remove(); return; }
  doc.open(); doc.write(html(d)); doc.close();
  setTimeout(() => { f.contentWindow?.print(); setTimeout(() => f.remove(), 60_000); }, 300);
}

export function mailDocumento(d: Documento) {
  d = limpiarDocumento(d);
  const lineas = filasDocumento(d).map(fila => fila.map((valor, idx) => idx === 3 || idx === 4 ? m(typeof valor === "number" ? valor : null) || "sin precio" : String(valor ?? "")).join(" | "));
  const cab = cabeceraDocumento(d).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n");
  const cuerpo = `${cab}\n\n${COLUMNAS_DOCUMENTO.join(" | ")}\n${lineas.join("\n")}\nTotal: ${m(totalDocumento(d))}`;
  window.location.href = `mailto:?subject=${encodeURIComponent(`${d.tipo} ${d.numero} - ${d.proveedor}`)}&body=${encodeURIComponent(cuerpo)}`;
}
