export type Periodo = "diario" | "semanal" | "mensual";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Rango [desde, hasta] (YYYY-MM-DD, inclusive). Semana de lunes a domingo. */
export function rangoPeriodo(periodo: Periodo, fecha: string): { desde: string; hasta: string } {
  const d = new Date(Date.UTC(+fecha.slice(0, 4), +fecha.slice(5, 7) - 1, +fecha.slice(8, 10)));
  if (periodo === "diario") return { desde: fecha, hasta: fecha };
  if (periodo === "semanal") {
    const lunes = new Date(d);
    lunes.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    const domingo = new Date(lunes);
    domingo.setUTCDate(lunes.getUTCDate() + 6);
    return { desde: iso(lunes), hasta: iso(domingo) };
  }
  const fin = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return { desde: fecha.slice(0, 8) + "01", hasta: iso(fin) };
}

export const enRango = (f: string, r: { desde: string; hasta: string }) => f >= r.desde && f <= r.hasta;

export const fechaAR = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}`;
export const pesos = (n: number) => "$" + n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
