import { createFileRoute } from "@tanstack/react-router";
import { CSV_OFICIAL, preciosDesdeArgly, preciosDesdeCSV, type FilaArgly } from "@/lib/precios-oficiales";

// Fuel prices for a province/city: official Secretaría de Energía CSV first (often unreachable
// from outside Argentina), then the Argly public mirror of the same data.
const CORS = { "Access-Control-Allow-Origin": "app://cheques", "Access-Control-Allow-Methods": "GET, OPTIONS" };

export const Route = createFileRoute("/api/precios-combustible")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const q = new URL(request.url).searchParams;
        const prov = q.get("provincia") ?? "TUCUMAN";
        const loc = q.get("localidad") ?? "SAN MIGUEL DE TUCUMAN";
        const ok = (r: object) => Response.json({ ...r, consultado: new Date().toISOString() }, { headers: { ...CORS, "Cache-Control": "public, max-age=3600" } });
        try {
          const res = await fetch(CSV_OFICIAL, { signal: AbortSignal.timeout(8000) });
          if (res.ok) {
            const r = preciosDesdeCSV(await res.text(), prov, loc);
            if (r) return ok(r);
          }
        } catch (e) {
          console.warn("precios-combustible oficial no disponible", e);
        }
        try {
          const res = await fetch(`https://api.argly.com.ar/v1/combustibles?provincia=${encodeURIComponent(prov)}`, { signal: AbortSignal.timeout(20000) });
          if (!res.ok) throw new Error(`Argly HTTP ${res.status}`);
          const r = preciosDesdeArgly(((await res.json()).data ?? []) as FilaArgly[], prov, loc);
          if (r) return ok(r);
          return Response.json({ error: "No se encontraron precios para esa provincia o ciudad." }, { headers: CORS });
        } catch (e) {
          console.error("precios-combustible", e);
          return Response.json({ error: "No se pudo consultar los precios oficiales ahora." }, { headers: CORS });
        }
      },
    },
  },
});
