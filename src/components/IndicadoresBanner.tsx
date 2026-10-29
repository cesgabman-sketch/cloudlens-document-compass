import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { actualizarIndicadores, leerCache, pesos, type Indicadores } from "@/lib/indicadores";

const PRINCIPALES = ["oficial", "blue", "bolsa", "contadoconliqui", "tarjeta"];

/** Top banner with dollar quotes and country risk; shows the last saved values offline. */
export function IndicadoresBanner() {
  const [datos, setDatos] = useState<Indicadores | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setDatos(leerCache());
    const cargar = () => actualizarIndicadores().then((d) => { setDatos(d); setOffline(false); }).catch(() => setOffline(true));
    if (navigator.onLine) cargar(); else setOffline(true);
    const t = setInterval(() => navigator.onLine && cargar(), 10 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  if (!datos) return null;
  const dolares = PRINCIPALES.map((c) => datos.dolares.find((d) => d.casa === c)).filter(Boolean);
  return (
    <Link to="/cotizaciones" className="block border-b-4 border-cartel-destacado bg-cartel px-4 py-2 text-sm text-cartel-foreground">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-1">
        {dolares.map((d) => <span key={d!.casa}>💵 <b className="text-cartel-destacado">{d!.nombre}</b> {pesos(d!.venta)}</span>)}
        {datos.riesgo && <span className="rounded bg-cartel-destacado px-2 font-semibold text-cartel">📈 Riesgo País {datos.riesgo.valor} pb</span>}
        <span className="ml-auto text-xs opacity-80">
          {offline ? "Sin conexión · última actualización " : "Actualizado "}
          {new Date(datos.sincronizado).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}
        </span>
      </div>
    </Link>
  );
}
