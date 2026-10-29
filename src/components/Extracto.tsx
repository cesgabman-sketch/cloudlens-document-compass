import { useMemo, useState } from "react";
import { enRango, fechaAR, pesos, rangoPeriodo, type Periodo } from "@/lib/extracto";

export interface ColumnaExtracto<T> {
  titulo: string;
  valor: (fila: T) => string;
}

interface Props<T> {
  titulo: string;
  filas: T[];
  fecha: (fila: T) => string;
  monto: (fila: T) => number;
  columnas: ColumnaExtracto<T>[];
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function Extracto<T>({ titulo, filas, fecha, monto, columnas }: Props<T>) {
  const [periodo, setPeriodo] = useState<Periodo>("mensual");
  const [dia, setDia] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const rango = rangoPeriodo(periodo, dia);
  const lista = useMemo(
    () => filas.filter((f) => enRango(fecha(f), rango)).sort((a, b) => fecha(a).localeCompare(fecha(b))),
    [filas, rango.desde, rango.hasta],
  );
  const total = lista.reduce((s, f) => s + monto(f), 0);
  const encabezado = `${titulo} ${periodo} — del ${fechaAR(rango.desde)} al ${fechaAR(rango.hasta)}`;

  function imprimir() {
    const w = window.open("", "_blank");
    if (!w) return alert("El navegador bloqueó la ventana de impresión.");
    w.document.write(`<html><head><title>${esc(encabezado)}</title><style>
      body{font-family:Arial,sans-serif;padding:24px}table{border-collapse:collapse;width:100%;font-size:12px}
      th,td{border:1px solid #999;padding:4px 6px;text-align:left}th{background:#eee}.t{font-weight:bold;margin-top:12px}
      </style></head><body><h2>${esc(encabezado)}</h2><p>Emitido el ${new Date().toLocaleString("es-AR")}</p>
      <table><thead><tr>${columnas.map((c) => `<th>${esc(c.titulo)}</th>`).join("")}</tr></thead><tbody>
      ${lista.map((f) => `<tr>${columnas.map((c) => `<td>${esc(c.valor(f))}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${columnas.length}">Sin movimientos en el período.</td></tr>`}
      </tbody></table><p class="t">Cantidad: ${lista.length} · Total: ${pesos(total)}</p></body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  }

  function enviarMail() {
    const cuerpo = [
      encabezado,
      "",
      ...lista.map((f) => columnas.map((c) => c.valor(f)).join(" | ")),
      "",
      `Cantidad: ${lista.length} · Total: ${pesos(total)}`,
    ].join("\n");
    window.location.href = `mailto:?subject=${encodeURIComponent(encabezado)}&body=${encodeURIComponent(cuerpo.slice(0, 1800))}`;
  }

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h2 className="text-xl font-semibold">Extracto para imprimir o enviar</h2>
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          Período
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)} className="rounded-md border bg-background px-2 py-1">
            <option value="diario">Diario</option>
            <option value="semanal">Semanal (lunes a domingo)</option>
            <option value="mensual">Mensual</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Fecha de referencia
          <input type="date" value={dia} onChange={(e) => e.target.value && setDia(e.target.value)} className="rounded-md border bg-background px-2 py-1" />
        </label>
        <button onClick={imprimir} className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground">🖨️ Imprimir / guardar PDF</button>
        <button onClick={enviarMail} className="rounded-md border px-4 py-2 font-medium">✉️ Enviar por mail</button>
      </div>
      <p className="text-sm text-muted-foreground">
        Del {fechaAR(rango.desde)} al {fechaAR(rango.hasta)}: {lista.length} movimiento(s), total {pesos(total)}.
      </p>
    </section>
  );
}
