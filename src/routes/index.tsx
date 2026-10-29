import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { CHEQUES_EJEMPLO, ESTADOS, diasParaVencer, semaforo, type Cheque, type EstadoCheque } from "@/lib/cheques";
import { borrarCheque, guardarCheque, listarCheques } from "@/lib/db-cheques";
import { DatosEmpresa } from "@/components/DatosEmpresa";
import { BotonActualizar } from "@/components/BotonActualizar";
import { SemaforoBadge, hoyLocal } from "@/components/SemaforoBadge";
import { baseServidor, esEscritorio } from "@/lib/servidor";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gestión de Cheques — Consultas inteligentes" },
      { name: "description", content: "Registrá cheques y hacé consultas en lenguaje natural sobre tu cartera." },
      { property: "og:title", content: "Gestión de Cheques — Consultas inteligentes" },
      { property: "og:description", content: "Registrá cheques y hacé consultas en lenguaje natural sobre tu cartera." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const CLAVE = "cheques-registrados";
const SUGERENCIAS = [
  "¿Qué cheques vencen esta semana?",
  "¿Cuánto suma lo que tengo en cartera?",
  "¿Hay cheques rechazados? ¿De quién?",
  "Resumen por librador",
];

const vacio = { numero: "", banco: "", librador: "", monto: "", fechaEmision: "", fechaVencimiento: "", estado: "en cartera" as EstadoCheque };

/** Achica la foto (máx. 1600 px) para enviarla más rápido. */
function achicarImagen(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 1600 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => reject(new Error("No se pudo abrir la foto."));
    img.src = URL.createObjectURL(file);
  });
}

function Index() {
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [cargado, setCargado] = useState(false);
  const [form, setForm] = useState(vacio);
  const [pregunta, setPregunta] = useState("");
  const [respuesta, setRespuesta] = useState("");
  const [error, setError] = useState("");
  const [pensando, setPensando] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const fotoRef = useRef<HTMLInputElement>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [dudosos, setDudosos] = useState<string[]>([]);
  const [fotoPreview, setFotoPreview] = useState("");
  const [avisoFoto, setAvisoFoto] = useState("");
  const [cola, setCola] = useState<Lectura[]>([]);
  const [posCola, setPosCola] = useState(0);
  const [guardadosCola, setGuardadosCola] = useState(0);

  useEffect(() => {
    listarCheques(CHEQUES_EJEMPLO)
      .then(setCheques)
      .catch(() => setError("No se pudieron leer los cheques guardados."))
      .finally(() => setCargado(true));
  }, []);

  type Lectura = {
    numero: string | null; banco: string | null; librador: string | null; monto: number | null;
    fechaEmision: string | null; fechaVencimiento: string | null; camposDudosos: string[];
  };

  /** Muestra en el formulario el cheque `i` de la cola leída de la foto. */
  function mostrarLectura(lista: Lectura[], i: number) {
    const d = lista[i];
    if (!d) return;
    setForm({
      ...vacio,
      numero: d.numero ?? "",
      banco: d.banco ?? "",
      librador: d.librador ?? "",
      monto: d.monto != null ? String(d.monto) : "",
      fechaEmision: d.fechaEmision ?? "",
      fechaVencimiento: d.fechaVencimiento ?? "",
    });
    const faltan = (["numero", "banco", "librador", "monto", "fechaEmision", "fechaVencimiento"] as const).filter((k) => d[k] == null);
    const marcar = [...new Set([...(d.camposDudosos ?? []), ...faltan])];
    setDudosos(marcar);
    const prefijo = lista.length > 1 ? `Cheque ${i + 1} de ${lista.length}. ` : "";
    setAvisoFoto(
      prefijo +
        (marcar.length
          ? "Revisá los campos marcados en rojo (pueden estar mal leídos o sobrescritos). Corregilos y tocá Confirmar, o Anular si el cheque tiene errores."
          : "¿Están correctos los datos? Tocá Confirmar para guardarlo o Anular para descartarlo."),
    );
  }

  /** Pasa al siguiente cheque de la foto o termina. */
  function siguiente(guardados: number) {
    const prox = posCola + 1;
    if (cola.length && prox < cola.length) {
      setPosCola(prox);
      mostrarLectura(cola, prox);
      return;
    }
    const total = cola.length;
    setCola([]);
    setPosCola(0);
    setForm(vacio);
    setDudosos([]);
    setFotoPreview("");
    setAvisoFoto(
      total > 0
        ? `Listo: se guardaron ${guardados} de ${total} cheque${total > 1 ? "s" : ""} de la foto${total - guardados ? ` (${total - guardados} anulado${total - guardados > 1 ? "s" : ""})` : ""}.`
        : "",
    );
  }

  /** Descarta el cheque que se está revisando (error, fecha mal leída, sobrescrito) sin guardarlo. */
  function anular() {
    if (!confirm("¿Anular este cheque? No se va a guardar.")) return;
    siguiente(guardadosCola);
  }

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.numero || !form.monto || !form.fechaVencimiento) {
      setAvisoFoto("Completá número, monto y vencimiento antes de guardar.");
      return;
    }
    const nuevo: Cheque = { ...form, id: crypto.randomUUID(), monto: Number(form.monto) };
    await guardarCheque(nuevo);
    setCheques((c) => [nuevo, ...c]);
    if (cola.length === 0) {
      setForm(vacio);
      setDudosos([]);
      setFotoPreview("");
      setAvisoFoto("");
      return;
    }
    const g = guardadosCola + 1;
    setGuardadosCola(g);
    siguiente(g);
  }

  function editar(k: keyof typeof vacio, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
    setDudosos((d) => d.filter((x) => x !== k));
  }

  const campo = (k: string) =>
    `w-full rounded-md border bg-background px-3 py-2 text-sm ${dudosos.includes(k) ? "border-destructive ring-2 ring-destructive/40" : "border-input"}`;

  async function leerFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!navigator.onLine) {
      setAvisoFoto("Sin conexión a internet: la lectura de fotos necesita internet. Podés cargar el cheque a mano.");
      return;
    }
    setLeyendo(true);
    setAvisoFoto("");
    setDudosos([]);
    setCola([]);
    setPosCola(0);
    setGuardadosCola(0);
    try {
      const imagen = await achicarImagen(file);
      setFotoPreview(imagen);
      const base = baseServidor();
      const res = await fetch(`${base}/api/leer-cheque`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagen }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "No se pudo leer la foto.");
      const lista: Lectura[] = Array.isArray(d.cheques) ? d.cheques : [];
      if (lista.length === 0) throw new Error("No se encontraron cheques legibles en la foto.");
      setCola(lista);
      mostrarLectura(lista, 0);
    } catch (err) {
      setAvisoFoto((err as Error).message);
    } finally {
      setLeyendo(false);
    }
  }

  async function eliminar(id: string) {
    await borrarCheque(id);
    setCheques((l) => l.filter((x) => x.id !== id));
  }

  async function consultar(texto: string) {
    const q = texto.trim();
    if (!q || pensando) return;
    setPregunta(q);
    setRespuesta("");
    setError("");
    setPensando(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const base = baseServidor();
      if (esEscritorio() && !navigator.onLine) throw new Error("Sin conexión a internet: el asistente necesita internet. El resto del programa funciona igual.");
      const res = await fetch(`${base}/api/consulta-cheques`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pregunta: q, cheques }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || d.message || "No se pudo obtener respuesta.");
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        setRespuesta((r) => r + dec.decode(value, { stream: true }));
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setPensando(false);
    }
  }

  const input = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
  const hoy = cargado ? hoyLocal() : "";
  const proximos = hoy
    ? cheques.filter((c) => semaforo(c, hoy) !== "cerrado").sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento)).slice(0, 10)
    : [];

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-6 text-foreground">
      <header>
        <DatosEmpresa />
        <h1 className="mt-4 text-3xl font-bold">Gestión de Cheques</h1>
        <p className="text-muted-foreground">Registrá cheques y preguntá lo que necesites sobre ellos.</p>
        <nav className="mt-3 flex flex-wrap gap-2 text-sm font-semibold text-tab-foreground">
          <Link to="/cheques" className="rounded-t-lg bg-tab-cheques px-4 py-2 shadow">🧾 Cheques</Link>
          <Link to="/gastos" className="rounded-t-lg bg-tab-gastos px-4 py-2 shadow">💰 Gastos diarios</Link>
          <Link to="/combustible" className="rounded-t-lg bg-tab-combustible px-4 py-2 shadow">⛽ Combustible</Link>
          <Link to="/cotizaciones" className="rounded-t-lg bg-tab-cotizaciones px-4 py-2 shadow">💵 Cotizaciones</Link>
        </nav>
        <div className="mt-3">
          <BotonActualizar />
        </div>
      </header>

      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-xl font-semibold">Consultar al asistente</h2>
        <form onSubmit={(e) => { e.preventDefault(); consultar(pregunta); }} className="flex gap-2">
          <input className={input} placeholder="Ej: ¿Qué cheques de Transportes del Sur siguen en cartera?" value={pregunta} onChange={(e) => setPregunta(e.target.value)} />
          {pensando ? (
            <button type="button" onClick={() => abortRef.current?.abort()} className="rounded-md bg-secondary px-4 text-sm font-medium text-secondary-foreground">Detener</button>
          ) : (
            <button className="rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Preguntar</button>
          )}
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGERENCIAS.map((s) => (
            <button key={s} onClick={() => consultar(s)} className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-accent">{s}</button>
          ))}
        </div>
        {(respuesta || pensando || error) && (
          <div className="mt-4 whitespace-pre-wrap rounded-md bg-muted p-4 text-sm">
            {error ? <span className="text-destructive">{error}</span> : respuesta || "Analizando los cheques…"}
          </div>
        )}
      </section>

      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Registrar cheque</h2>
          <button type="button" disabled={leyendo} onClick={() => fotoRef.current?.click()} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
            {leyendo ? "Leyendo la foto…" : "📷 Cargar desde foto"}
          </button>
          <input ref={fotoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={leerFoto} />
        </div>
        {(fotoPreview || avisoFoto) && (
          <div className="mb-3 flex gap-3 rounded-md bg-muted p-3 text-sm">
            {fotoPreview && <img src={fotoPreview} alt="Foto del cheque" className="h-24 rounded object-contain" />}
            <p className={dudosos.length ? "text-destructive" : ""}>{avisoFoto}</p>
          </div>
        )}
        <form onSubmit={agregar} className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <input className={campo("numero")} placeholder="Número" value={form.numero} onChange={(e) => editar("numero", e.target.value)} />
          <input className={campo("banco")} placeholder="Banco" value={form.banco} onChange={(e) => editar("banco", e.target.value)} />
          <input className={campo("librador")} placeholder="Librador" value={form.librador} onChange={(e) => editar("librador", e.target.value)} />
          <input className={campo("monto")} type="number" placeholder="Monto" value={form.monto} onChange={(e) => editar("monto", e.target.value)} />
          <label className="text-xs text-muted-foreground">Emisión<input className={campo("fechaEmision")} type="date" value={form.fechaEmision} onChange={(e) => editar("fechaEmision", e.target.value)} /></label>
          <label className="text-xs text-muted-foreground">Vencimiento<input className={campo("fechaVencimiento")} type="date" value={form.fechaVencimiento} onChange={(e) => editar("fechaVencimiento", e.target.value)} /></label>
          <label className="text-xs text-muted-foreground">Estado
            <select className={input} value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value as EstadoCheque })}>
              {ESTADOS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          {cola.length > 0 ? (
            <div className="flex gap-2 self-end">
              <button className="flex-1 rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground">Confirmar</button>
              <button type="button" onClick={anular} className="flex-1 rounded-md border border-destructive py-2 text-sm font-medium text-destructive">Anular</button>
            </div>
          ) : (
            <button className="self-end rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground">Agregar</button>
          )}
        </form>
      </section>

      <section className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <div className="flex items-center justify-between p-4">
          <h2 className="text-xl font-semibold">Próximos 10 vencimientos</h2>
          <Link to="/cheques" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Ver todos los cheques</Link>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>{["Semáforo", "Vence", "Número", "Proveedor", "Monto", "Estado", ""].map((h) => <th key={h} className="p-3">{h}</th>)}</tr>
          </thead>
          <tbody>
            {proximos.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-3"><SemaforoBadge valor={semaforo(c, hoy)} dias={diasParaVencer(c.fechaVencimiento, hoy)} /></td>
                <td className="p-3">{c.fechaVencimiento}</td>
                <td className="p-3">{c.numero}</td>
                <td className="p-3">{c.librador}</td>
                <td className="p-3">${c.monto.toLocaleString("es-AR")}</td>
                <td className="p-3 capitalize">{c.estado}</td>
                <td className="p-3"><button onClick={() => eliminar(c.id)} className="text-xs text-destructive">Eliminar</button></td>
              </tr>
            ))}
            {proximos.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No hay cheques pendientes.</td></tr>}
          </tbody>
        </table>
      </section>
    </main>
  );
}
