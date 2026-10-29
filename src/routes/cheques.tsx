import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { CHEQUES_EJEMPLO, ESTADOS, diasParaVencer, esChequeValido, semaforo, type Cheque, type Semaforo } from "@/lib/cheques";
import { Extracto } from "@/components/Extracto";
import { borrarCheque, guardarCheque, importarCheques, listarCheques } from "@/lib/db-cheques";
import { ConsultaBCRA, type PedidoBCRA } from "@/components/ConsultaBCRA";
import { SemaforoBadge, hoyLocal } from "@/components/SemaforoBadge";

export const Route = createFileRoute("/cheques")({
  head: () => ({
    meta: [
      { title: "Cheques — Listado con semáforo de vencimientos" },
      { name: "description", content: "Todos los cheques con filtros por fecha, proveedor, monto y estado, y semáforo de vencimientos." },
      { property: "og:title", content: "Cheques — Listado con semáforo de vencimientos" },
      { property: "og:description", content: "Filtrá cheques por fecha, proveedor, monto y estado." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChequesPage,
});

const filtrosVacios = { desde: "", hasta: "", proveedor: "", montoMin: "", montoMax: "", estado: "", color: "" };

function ChequesPage() {
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [hoy, setHoy] = useState("");
  const [f, setF] = useState(filtrosVacios);
  const [aviso, setAviso] = useState("");
  const archivo = useRef<HTMLInputElement>(null);
  const [pedidoBCRA, setPedidoBCRA] = useState<PedidoBCRA | null>(null);

  useEffect(() => {
    setHoy(hoyLocal());
    listarCheques(CHEQUES_EJEMPLO).then(setCheques).catch(() => setAviso("No se pudieron leer los cheques guardados."));
  }, []);

  const proveedores = useMemo(() => [...new Set(cheques.map((c) => c.librador).filter(Boolean))].sort(), [cheques]);

  const filtrados = useMemo(() => {
    if (!hoy) return [];
    return cheques
      .filter((c) => {
        if (f.desde && c.fechaVencimiento < f.desde) return false;
        if (f.hasta && c.fechaVencimiento > f.hasta) return false;
        if (f.proveedor && !c.librador.toLowerCase().includes(f.proveedor.toLowerCase())) return false;
        if (f.montoMin && c.monto < Number(f.montoMin)) return false;
        if (f.montoMax && c.monto > Number(f.montoMax)) return false;
        if (f.estado && c.estado !== f.estado) return false;
        if (f.color && semaforo(c, hoy) !== f.color) return false;
        return true;
      })
      .sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento));
  }, [cheques, f, hoy]);

  const conteo = useMemo(() => {
    const r: Record<Semaforo, number> = { rojo: 0, amarillo: 0, verde: 0, cerrado: 0 };
    if (hoy) cheques.forEach((c) => r[semaforo(c, hoy)]++);
    return r;
  }, [cheques, hoy]);

  const total = filtrados.reduce((s, c) => s + c.monto, 0);

  async function cambiarEstado(c: Cheque, estado: Cheque["estado"]) {
    const nuevo = { ...c, estado };
    await guardarCheque(nuevo);
    setCheques((l) => l.map((x) => (x.id === c.id ? nuevo : x)));
  }

  async function eliminar(id: string) {
    if (!confirm("¿Eliminar este cheque?")) return;
    await borrarCheque(id);
    setCheques((l) => l.filter((x) => x.id !== id));
  }

  function exportar() {
    const blob = new Blob([JSON.stringify({ tipo: "cheques", version: 1, exportado: new Date().toISOString(), cheques }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `cheques-${hoyLocal()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setAviso(`Se exportaron ${cheques.length} cheques.`);
  }

  async function importar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const datos = JSON.parse(await file.text());
      const lista: unknown[] = Array.isArray(datos) ? datos : datos?.cheques;
      if (!Array.isArray(lista)) throw new Error();
      const validos = lista.filter(esChequeValido);
      if (validos.length === 0) throw new Error();
      await importarCheques(validos);
      setCheques(await listarCheques(CHEQUES_EJEMPLO));
      setAviso(`Se importaron ${validos.length} cheques${validos.length < lista.length ? ` (${lista.length - validos.length} ignorados por datos incompletos)` : ""}. Los que ya existían se actualizaron.`);
    } catch {
      setAviso("El archivo no es una lista de cheques válida.");
    }
  }

  const input = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
  const etiqueta = "text-xs text-muted-foreground";

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6 text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Cheques</h1>
          <Link to="/" className="text-sm text-primary underline">← Volver al inicio y al asistente</Link>
        </div>
        <div className="flex gap-2">
          <button onClick={exportar} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Exportar cheques</button>
          <button onClick={() => archivo.current?.click()} className="rounded-md border px-4 py-2 text-sm font-medium">Importar cheques</button>
          <input ref={archivo} type="file" accept="application/json,.json" className="hidden" onChange={importar} />
        </div>
      </header>

      {aviso && <p className="rounded-md bg-muted p-3 text-sm">{aviso}</p>}

      <Extracto
        titulo="Extracto de cheques"
        filas={cheques}
        fecha={(c) => c.fechaVencimiento}
        monto={(c) => c.monto}
        columnas={[
          { titulo: "Vence", valor: (c) => c.fechaVencimiento.split("-").reverse().join("/") },
          { titulo: "N°", valor: (c) => c.numero },
          { titulo: "Banco", valor: (c) => c.banco },
          { titulo: "Librador", valor: (c) => c.librador },
          { titulo: "Monto", valor: (c) => "$" + c.monto.toLocaleString("es-AR") },
          { titulo: "Estado", valor: (c) => c.estado },
        ]}
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {(["rojo", "amarillo", "verde", "cerrado"] as Semaforo[]).map((k) => (
          <button key={k} onClick={() => setF({ ...f, color: f.color === k ? "" : k })}
            className={`rounded-xl border bg-card p-4 text-left shadow-sm ${f.color === k ? "ring-2 ring-primary" : ""}`}>
            <SemaforoBadge valor={k} />
            <div className="mt-1 text-2xl font-bold">{conteo[k]}</div>
          </button>
        ))}
      </section>

      <section className="grid grid-cols-2 gap-3 rounded-xl border bg-card p-4 shadow-sm md:grid-cols-7">
        <label className={etiqueta}>Vence desde<input type="date" className={input} value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} /></label>
        <label className={etiqueta}>Vence hasta<input type="date" className={input} value={f.hasta} onChange={(e) => setF({ ...f, hasta: e.target.value })} /></label>
        <label className={`${etiqueta} md:col-span-2`}>Proveedor / librador
          <input list="proveedores" className={input} value={f.proveedor} onChange={(e) => setF({ ...f, proveedor: e.target.value })} placeholder="Todos" />
          <datalist id="proveedores">{proveedores.map((p) => <option key={p} value={p} />)}</datalist>
        </label>
        <label className={etiqueta}>Monto mín.<input type="number" className={input} value={f.montoMin} onChange={(e) => setF({ ...f, montoMin: e.target.value })} /></label>
        <label className={etiqueta}>Monto máx.<input type="number" className={input} value={f.montoMax} onChange={(e) => setF({ ...f, montoMax: e.target.value })} /></label>
        <label className={etiqueta}>Estado
          <select className={input} value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value })}>
            <option value="">Todos</option>
            {ESTADOS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <div className="col-span-2 flex items-center justify-between text-sm md:col-span-7">
          <span>{filtrados.length} cheques · Total ${total.toLocaleString("es-AR")}</span>
          <button onClick={() => setF(filtrosVacios)} className="text-primary underline">Limpiar filtros</button>
        </div>
      </section>

      <section className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>{["Semáforo", "Vence", "Número", "Banco", "Proveedor", "Monto", "Estado", ""].map((h) => <th key={h} className="p-3">{h}</th>)}</tr>
          </thead>
          <tbody>
            {filtrados.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-3"><SemaforoBadge valor={semaforo(c, hoy)} dias={diasParaVencer(c.fechaVencimiento, hoy)} /></td>
                <td className="p-3">{c.fechaVencimiento}</td>
                <td className="p-3">{c.numero}</td>
                <td className="p-3">{c.banco}</td>
                <td className="p-3">{c.librador}</td>
                <td className="p-3">${c.monto.toLocaleString("es-AR")}</td>
                <td className="p-3">
                  <select className="rounded border bg-background px-2 py-1 text-xs" value={c.estado} onChange={(e) => cambiarEstado(c, e.target.value as Cheque["estado"])}>
                    {ESTADOS.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </td>
                <td className="p-3 whitespace-nowrap"><button onClick={() => setPedidoBCRA({ banco: c.banco, numero: c.numero, n: Date.now() })} className="mr-3 text-xs text-primary underline">Consultar BCRA</button><button onClick={() => eliminar(c.id)} className="text-xs text-destructive">Eliminar</button></td>
              </tr>
            ))}
            {filtrados.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No hay cheques con esos filtros.</td></tr>}
          </tbody>
        </table>
      </section>

      <ConsultaBCRA pedido={pedidoBCRA} />
    </main>
  );
}
