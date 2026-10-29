// Exchange rates and country risk. Fetched directly from public APIs (CORS open),
// cached on the PC so the last values show offline. Browser-only.
export interface Dolar { casa: string; nombre: string; compra: number | null; venta: number | null; fechaActualizacion: string }
export interface Indicadores { dolares: Dolar[]; riesgo: { valor: number; fecha: string } | null; sincronizado: string }

const CLAVE = "indicadores-cache";

export function leerCache(): Indicadores | null {
  try { const t = localStorage.getItem(CLAVE); return t ? JSON.parse(t) : null; } catch { return null; }
}

export async function actualizarIndicadores(): Promise<Indicadores> {
  const [d, r] = await Promise.allSettled([
    fetch("https://dolarapi.com/v1/dolares", { signal: AbortSignal.timeout(15000) }).then((x) => { if (!x.ok) throw new Error(); return x.json() as Promise<Dolar[]>; }),
    fetch("https://api.argentinadatos.com/v1/finanzas/indices/riesgo-pais/ultimo", { signal: AbortSignal.timeout(15000) }).then((x) => { if (!x.ok) throw new Error(); return x.json() as Promise<{ valor: number; fecha: string }>; }),
  ]);
  const previo = leerCache();
  if (d.status === "rejected" && r.status === "rejected") throw new Error("Sin conexión con las cotizaciones.");
  const datos: Indicadores = {
    dolares: d.status === "fulfilled" ? d.value : previo?.dolares ?? [],
    riesgo: r.status === "fulfilled" ? r.value : previo?.riesgo ?? null,
    sincronizado: new Date().toISOString(),
  };
  localStorage.setItem(CLAVE, JSON.stringify(datos));
  return datos;
}

export const pesos = (n: number | null) => (n == null ? "—" : n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }));
