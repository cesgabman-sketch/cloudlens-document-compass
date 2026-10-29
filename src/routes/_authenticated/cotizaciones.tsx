import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { actualizarIndicadores, leerCache, pesos, type Indicadores } from "@/lib/indicadores";

export const Route = createFileRoute("/_authenticated/cotizaciones")({
  head: () => ({
    meta: [
      { title: "Cotizaciones del dólar y Riesgo País — Foto a Documento" },
      { name: "description", content: "Dólar oficial, blue, MEP, contado con liqui, tarjeta, mayorista y cripto, más el Riesgo País; funciona sin internet con la última cotización." },
      { property: "og:title", content: "Cotizaciones del dólar y Riesgo País — Foto a Documento" },
      { property: "og:description", content: "Todas las variantes del dólar en Argentina y el Riesgo País." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CotizacionesPage,
});

const NOMBRES: Record<string, string> = { bolsa: "MEP (Bolsa)", contadoconliqui: "Contado con liqui (CCL)" };
const fecha = (s: string) => new Date(s).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });

function CotizacionesPage() {
  const [datos, setDatos] = useState<Indicadores | null>(null);
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState("");

  async function actualizar() {
    if (!navigator.onLine) return setAviso("Sin internet: se muestra la última cotización guardada en la PC.");
    setCargando(true);
    try { setDatos(await actualizarIndicadores()); setAviso(""); }
    catch { setAviso("No se pudo actualizar. Se muestra la última cotización guardada en la PC."); }
    finally { setCargando(false); }
  }

  useEffect(() => { setDatos(leerCache()); void actualizar(); }, []);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6 text-foreground">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Cotizaciones y Riesgo País</h1>
          <p className="text-muted-foreground">
            {datos ? `Última sincronización: ${fecha(datos.sincronizado)}` : "Todavía no hay cotizaciones guardadas."}
          </p>
        </div>
        <nav className="flex gap-3 text-sm">
          <Link to="/" className="underline">Inicio</Link>
          <Link to="/gastos" className="underline">Gastos</Link>
        </nav>
      </header>

      {aviso && <p className="rounded-md bg-muted px-3 py-2 text-sm" role="status">{aviso}</p>}
      <button type="button" disabled={cargando} onClick={actualizar} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
        {cargando ? "Actualizando…" : "Actualizar ahora"}
      </button>

      {datos?.riesgo && (
        <section className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-medium text-muted-foreground">Riesgo País</h2>
          <p className="text-4xl font-bold">{datos.riesgo.valor.toLocaleString("es-AR")} <span className="text-lg font-normal">puntos básicos</span></p>
          <p className="text-sm text-muted-foreground">Al {datos.riesgo.fecha.split("-").reverse().join("/")}</p>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {datos?.dolares.map((d) => (
          <article key={d.casa} className="rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Dólar {NOMBRES[d.casa] ?? d.nombre}</h2>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div><p className="text-xs text-muted-foreground">Compra</p><p className="text-xl font-bold">{pesos(d.compra)}</p></div>
              <div><p className="text-xs text-muted-foreground">Venta</p><p className="text-xl font-bold">{pesos(d.venta)}</p></div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Actualizado {fecha(d.fechaActualizacion)}</p>
          </article>
        ))}
      </section>
      <p className="text-xs text-muted-foreground">Fuentes: DolarApi (dólares) y ArgentinaDatos (Riesgo País).</p>
    </main>
  );
}
