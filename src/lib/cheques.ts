export type EstadoCheque = "en cartera" | "depositado" | "cobrado" | "rechazado" | "endosado";

export interface Cheque {
  id: string;
  numero: string;
  banco: string;
  librador: string;
  monto: number;
  fechaEmision: string;
  fechaVencimiento: string;
  estado: EstadoCheque;
  observaciones?: string;
}

export const ESTADOS: EstadoCheque[] = ["en cartera", "depositado", "cobrado", "rechazado", "endosado"];

export const CHEQUES_EJEMPLO: Cheque[] = [
  { id: "1", numero: "00012345", banco: "Banco Nación", librador: "Transportes del Sur SRL", monto: 1250000, fechaEmision: "2026-09-15", fechaVencimiento: "2026-10-22", estado: "en cartera" },
  { id: "2", numero: "00098765", banco: "Banco Galicia", librador: "Agro Pampa SA", monto: 870000, fechaEmision: "2026-09-01", fechaVencimiento: "2026-10-05", estado: "cobrado" },
  { id: "3", numero: "00045678", banco: "Banco Santander", librador: "Ferretería Central", monto: 340000, fechaEmision: "2026-09-20", fechaVencimiento: "2026-10-18", estado: "rechazado", observaciones: "Sin fondos suficientes" },
  { id: "4", numero: "00033221", banco: "Banco Provincia", librador: "Transportes del Sur SRL", monto: 2100000, fechaEmision: "2026-10-01", fechaVencimiento: "2026-11-10", estado: "en cartera" },
  { id: "5", numero: "00077889", banco: "Banco Macro", librador: "Logística Andina", monto: 560000, fechaEmision: "2026-10-05", fechaVencimiento: "2026-10-25", estado: "depositado" },
];

export function chequesComoTexto(cheques: Cheque[]): string {
  return cheques
    .map(
      (c) =>
        `- N° ${c.numero} | ${c.banco} | Librador: ${c.librador} | Monto: $${c.monto.toLocaleString("es-AR")} | Emisión: ${c.fechaEmision} | Vence: ${c.fechaVencimiento} | Estado: ${c.estado}${c.observaciones ? ` | Obs: ${c.observaciones}` : ""}`,
    )
    .join("\n");
}

export type Semaforo = "rojo" | "amarillo" | "verde" | "cerrado";

/** Días entre hoy y el vencimiento (negativo = vencido). Fechas YYYY-MM-DD. */
export function diasParaVencer(fechaVencimiento: string, hoy: string): number {
  const a = Date.UTC(+hoy.slice(0, 4), +hoy.slice(5, 7) - 1, +hoy.slice(8, 10));
  const b = Date.UTC(+fechaVencimiento.slice(0, 4), +fechaVencimiento.slice(5, 7) - 1, +fechaVencimiento.slice(8, 10));
  return Math.round((b - a) / 86400000);
}

/** Rojo: vence hoy o vencido sin cobrar (o rechazado). Amarillo: 1 a 7 días. Verde: más de 7. */
export function semaforo(c: Pick<Cheque, "estado" | "fechaVencimiento">, hoy: string): Semaforo {
  if (c.estado === "cobrado" || c.estado === "endosado") return "cerrado";
  if (c.estado === "rechazado") return "rojo";
  const d = diasParaVencer(c.fechaVencimiento, hoy);
  if (d <= 0) return "rojo";
  if (d <= 7) return "amarillo";
  return "verde";
}

export function esChequeValido(x: unknown): x is Cheque {
  const c = x as Cheque;
  return !!c && typeof c.id === "string" && typeof c.numero === "string" && typeof c.monto === "number" &&
    /^\d{4}-\d{2}-\d{2}$/.test(c.fechaVencimiento) && ESTADOS.includes(c.estado);
}
