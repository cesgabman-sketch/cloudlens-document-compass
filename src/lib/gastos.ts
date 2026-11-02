export const CATEGORIAS = ["Combustible", "Comida", "Repuestos", "Ferretería", "Peajes", "Viáticos", "Otros"] as const;

export interface Gasto {
  id: string;
  fecha: string; // YYYY-MM-DD
  concepto: string;
  monto: number;
  categoria: string;
  origen: "manual" | "foto";
}

/** Campos que la IA puede marcar como dudosos en una nota o ticket. */
export type CampoGasto = "fecha" | "concepto" | "monto" | "categoria";

export const esGastoValido = (g: Partial<Gasto>): g is Gasto =>
  typeof g.id === "string" &&
  typeof g.fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(g.fecha) &&
  typeof g.concepto === "string" && g.concepto.trim() !== "" &&
  typeof g.monto === "number" && Number.isFinite(g.monto) && g.monto > 0 &&
  typeof g.categoria === "string";

export const totalGastos = (lista: Gasto[]) => lista.reduce((s, g) => s + g.monto, 0);

/** Un solo mes muestra ese período; una foto de varios meses muestra todos. */
export function mesDeGastosGuardados(lista: Gasto[]): string {
  const meses = new Set(lista.map(g => g.fecha.slice(0, 7)));
  return meses.size === 1 ? lista[0]?.fecha.slice(0, 7) ?? "" : "";
}
