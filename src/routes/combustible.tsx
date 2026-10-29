import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { COMBUSTIBLES, UNIDADES, costo, litros, type Combustible, type Precios, type Unidad } from "@/lib/flota";
import { borrarUso, guardarUso, listarUsos, type RegistroUso } from "@/lib/db-flota";
import { preciosDesdeCSV } from "@/lib/precios-oficiales";
import { baseServidor } from "@/lib/servidor";
import { hoyLocal } from "@/components/SemaforoBadge";

export const Route = createFileRoute("/combustible")({
  head: () => ({
    meta: [
      { title: "Combustible y maquinaria — Calculadora de flota" },
      { name: "description", content: "Calculá el gasto de combustible por kilómetros u horas con precios YPF de San Miguel de Tucumán." },
      { property: "og:title", content: "Combustible y maquinaria — Calculadora de flota" },
      { property: "og:description", content: "Costo de combustible por unidad con precios YPF de Tucumán." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CombustiblePage,
});

const CLAVE_PRECIOS = "precios-combustible";
const CLAVE_ZONA = "zona-ypf";
const PROVINCIAS = ["BUENOS AIRES", "CAPITAL FEDERAL", "CATAMARCA", "CHACO", "CHUBUT", "CORDOBA", "CORRIENTES", "ENTRE RIOS", "FORMOSA", "JUJUY", "LA PAMPA", "LA RIOJA", "MENDOZA", "MISIONES", "NEUQUEN", "RIO NEGRO", "SALTA", "SAN JUAN", "SAN LUIS", "SANTA CRUZ", "SANTA FE", "SANTIAGO DEL ESTERO", "TIERRA DEL FUEGO", "TUCUMAN"];
interface Zona { vincular: boolean; provincia: string; localidad: string }
const ZONA_BASE: Zona = { vincular: true, provincia: "TUCUMAN", localidad: "SAN MIGUEL DE TUCUMAN" };
const CLAVE_CONSUMOS = "consumos-flota";
// Starting values until the first online update (reference only).
const PRECIOS_BASE: Precios = { nafta_super: 0, nafta_premium: 0, gasoil_g2: 0, gasoil_g3: 0 };

interface Guardado { precios: Precios; origen: "ypf" | "manual" | "sin datos"; fecha: string | null; estaciones?: number; zona?: string; fuente?: string; vigencia?: string | undefined }

const peso = (n: number) => n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
const nuevoId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));

function CombustiblePage() {
  const [p, setP] = useState<Guardado>({ precios: PRECIOS_BASE, origen: "sin datos", fecha: null });
  const [consumos, setConsumos] = useState<Record<string, number>>({});
  const [actualizando, setActualizando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [unidadId, setUnidadId] = useState(UNIDADES[0]?.id ?? "");
  const [uso, setUso] = useState("");
  const [usos, setUsos] = useState<RegistroUso[]>([]);
  const [zona, setZona] = useState<Zona>(ZONA_BASE);

  useEffect(() => {
    try {
      const g = localStorage.getItem(CLAVE_PRECIOS);
      if (g) setP(JSON.parse(g));
      const c = localStorage.getItem(CLAVE_CONSUMOS);
      if (c) setConsumos(JSON.parse(c));
      const z = localStorage.getItem(CLAVE_ZONA);
      const zg: Zona = z ? { ...ZONA_BASE, ...JSON.parse(z) } : ZONA_BASE;
      setZona(zg);
      if (zg.vincular && navigator.onLine) void actualizar(true, zg);
    } catch { /* ignore broken cache */ }
    listarUsos().then(setUsos).catch(() => {});
  }, []);

  const guardarPrecios = (g: Guardado) => { setP(g); localStorage.setItem(CLAVE_PRECIOS, JSON.stringify(g)); };

  const cambiarZona = (z: Partial<Zona>) => { const n = { ...zona, ...z }; setZona(n); localStorage.setItem(CLAVE_ZONA, JSON.stringify(n)); };

  async function actualizar(silencioso = false, z: Zona = zona) {
    if (!navigator.onLine) return setAviso("Sin internet: se usan los últimos precios guardados en la PC.");
    setActualizando(true);
    let errorPC = "";
    try {
      let d: { precios: Partial<Precios>; estaciones: number; alcance: string; fuente: string; vigencia?: string | undefined } | null = null;
      const pc = (globalThis as { preciosOficiales?: { csv: () => Promise<string> } }).preciosOficiales;
      if (pc) {
        try {
          d = preciosDesdeCSV(await pc.csv(), z.provincia, z.localidad);
          if (!d) errorPC = "El sitio oficial respondió pero no tiene estaciones YPF cargadas para esa zona.";
        } catch (e) {
          errorPC = `No se pudo leer el sitio oficial desde esta PC (${e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, "") : "error"}).`;
        }
      }
      if (!d) {
        const res = await fetch(`${baseServidor()}/api/precios-combustible?${new URLSearchParams({ provincia: z.provincia, localidad: z.localidad })}`);
        const j = await res.json().catch(() => ({ error: "El servidor de respaldo no respondió bien." }));
        if (!res.ok || j.error) throw new Error(j.error ?? "No se pudieron traer los precios.");
        d = j;
      }
      const r = d!;
      setP((prev) => { const g: Guardado = { precios: { ...prev.precios, ...r.precios }, origen: "ypf", fecha: new Date().toISOString(), estaciones: r.estaciones, zona: r.alcance, fuente: r.fuente, vigencia: r.vigencia }; localStorage.setItem(CLAVE_PRECIOS, JSON.stringify(g)); return g; });
      setAviso(errorPC && !silencioso ? `${errorPC} Se usó la copia pública: ${r.alcance}.` : silencioso ? "" : `Precios actualizados: ${r.alcance}.`);
    } catch (e) {
      const detalle = [errorPC, e instanceof Error ? e.message : "Error"].filter(Boolean).join(" · ");
      setAviso(`${detalle} Se usan los últimos precios guardados; podés cargarlos a mano.`);
    } finally {
      setActualizando(false);
    }
  }

  const cambiarPrecio = (c: Combustible, v: string) =>
    guardarPrecios({ precios: { ...p.precios, [c]: Number(v) || 0 }, origen: "manual", fecha: new Date().toISOString() });

  const unidad: Unidad = useMemo(() => {
    const u = UNIDADES.find((x) => x.id === unidadId)!;
    return { ...u, consumo: consumos[u.id] ?? u.consumo };
  }, [unidadId, consumos]);

  const n = Number(uso) || 0;
  const precio = p.precios[unidad.combustible];
  const lts = litros(unidad, n);
  const total = costo(unidad, n, precio);

  function cambiarConsumo(v: string) {
    const c = { ...consumos, [unidad.id]: Number(v) || 0 };
    setConsumos(c);
    localStorage.setItem(CLAVE_CONSUMOS, JSON.stringify(c));
  }

  async function registrar() {
    if (n <= 0 || precio <= 0) return setAviso("Cargá el uso y asegurate de tener precio para ese combustible.");
    await guardarUso({ id: nuevoId(), fecha: hoyLocal(), unidad: unidad.nombre, medida: unidad.medida, uso: n, litros: lts, precio, costo: total });
    setUsos(await listarUsos());
    setUso("");
    setAviso("Uso registrado.");
  }

  const input = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
  const etiquetaOrigen = p.origen === "ypf" ? `${p.zona ?? "YPF"} · ${p.fuente ?? "oficial"}` : p.origen === "manual" ? "cargados a mano" : "sin precios todavía";

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-6 text-foreground">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Combustible y maquinaria</h1>
          <p className="text-muted-foreground">Costo por kilómetros u horas de uso.</p>
        </div>
        <nav className="flex gap-3 text-sm">
          <Link to="/" className="underline">Inicio</Link>
          <Link to="/cheques" className="underline">Cheques</Link>
          <Link to="/gastos" className="underline">Gastos</Link>
        </nav>
      </header>

      {aviso && <p className="rounded-md bg-muted px-3 py-2 text-sm" role="status">{aviso}</p>}

      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-semibold">Precios por litro</h2>
            <p className="text-sm text-muted-foreground">
              Origen: {etiquetaOrigen}
              {p.fecha && ` · ${new Date(p.fecha).toLocaleString("es-AR")}`}
              {p.origen === "ypf" && p.estaciones ? ` · promedio de ${p.estaciones} estación(es)` : ""}
              {p.origen === "ypf" && p.vigencia ? ` · precios vigentes al ${p.vigencia.split("-").reverse().join("/")}` : ""}
            </p>
          </div>
          {zona.vincular && <button type="button" disabled={actualizando} onClick={() => actualizar()} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
            {actualizando ? "Consultando…" : "Actualizar precios YPF"}
          </button>}
        </div>
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg bg-muted p-3 text-sm">
          <label className="flex items-center gap-2 font-medium">
            <input type="checkbox" checked={zona.vincular} onChange={(e) => cambiarZona({ vincular: e.target.checked })} />
            Vincular con precios oficiales de YPF
          </label>
          {zona.vincular && (
            <>
              <label>Provincia
                <select className={input} value={zona.provincia} onChange={(e) => cambiarZona({ provincia: e.target.value, localidad: "" })}>
                  <option value="">TODO EL PAÍS</option>
                  {PROVINCIAS.map((pr) => <option key={pr} value={pr}>{pr}</option>)}
                </select>
              </label>
              <label>Ciudad (opcional)
                <input className={input} placeholder="Toda la provincia" value={zona.localidad} onChange={(e) => cambiarZona({ localidad: e.target.value.toUpperCase() })} />
              </label>
            </>
          )}
          {!zona.vincular && <span className="text-muted-foreground">Cargá los precios a mano abajo.</span>}
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          {(Object.keys(COMBUSTIBLES) as Combustible[]).map((c) => (
            <label key={c} className="text-sm">
              {COMBUSTIBLES[c]}
              <input type="number" min="0" step="0.01" className={input} value={p.precios[c] || ""} placeholder="Sin precio" onChange={(e) => cambiarPrecio(c, e.target.value)} />
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-xl font-semibold">Calculadora</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">Unidad
            <select className={input} value={unidadId} onChange={(e) => setUnidadId(e.target.value)}>
              {UNIDADES.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          </label>
          <label className="text-sm">{unidad.medida === "km" ? "Kilómetros recorridos" : "Horas de uso (horómetro)"}
            <input type="number" min="0" className={input} value={uso} onChange={(e) => setUso(e.target.value)} />
          </label>
          <label className="text-sm">Consumo ({unidad.medida === "km" ? "litros cada 100 km" : "litros por hora"})
            <input type="number" min="0" step="0.1" className={input} value={unidad.consumo || ""} onChange={(e) => cambiarConsumo(e.target.value)} />
          </label>
        </div>
        <div className="mt-4 rounded-lg bg-muted p-4">
          <p className="text-sm text-muted-foreground">{COMBUSTIBLES[unidad.combustible]} · {precio > 0 ? `${peso(precio)} por litro` : "sin precio"}</p>
          <p className="text-2xl font-bold">{peso(total)}</p>
          <p className="text-sm">{lts.toLocaleString("es-AR", { maximumFractionDigits: 1 })} litros</p>
        </div>
        <button type="button" onClick={registrar} className="mt-3 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Registrar este uso</button>
      </section>

      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-xl font-semibold">Usos registrados</h2>
        {usos.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no hay usos registrados.</p> : (
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground"><tr><th className="p-1">Fecha</th><th className="p-1">Unidad</th><th className="p-1">Uso</th><th className="p-1">Litros</th><th className="p-1 text-right">Costo</th><th></th></tr></thead>
            <tbody>
              {usos.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-1">{r.fecha.split("-").reverse().join("/")}</td>
                  <td className="p-1">{r.unidad}</td>
                  <td className="p-1">{r.uso} {r.medida === "km" ? "km" : "h"}</td>
                  <td className="p-1">{r.litros.toLocaleString("es-AR", { maximumFractionDigits: 1 })}</td>
                  <td className="p-1 text-right">{peso(r.costo)}</td>
                  <td className="p-1 text-right"><button type="button" className="text-xs text-destructive underline" onClick={async () => { await borrarUso(r.id); setUsos(await listarUsos()); }}>Borrar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
