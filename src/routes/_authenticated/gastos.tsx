import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIAS, esGastoValido, totalGastos, type CampoGasto, type Gasto } from "@/lib/gastos";
import { Extracto } from "@/components/Extracto";
import { borrarGasto, guardarGastos, listarGastos } from "@/lib/db-gastos";
import { achicarImagen, baseIA } from "@/lib/imagen";
import { hoyLocal } from "@/components/SemaforoBadge";
import { DocumentosGastos } from "@/components/DocumentosGastos";
import { Button } from "@/components/ui/button";
import { BotonActualizar } from "@/components/BotonActualizar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, FileText, Mail, Pencil, Printer, Trash2 } from "lucide-react";
import { gastosExcel, gastosImprimir, gastosMail, gastosWord } from "@/lib/gastos-salida";

export const Route = createFileRoute("/_authenticated/gastos")({
  head: () => ({
    meta: [
      { title: "Gastos, remitos y presupuestos — Foto a Documento" },
      { name: "description", content: "Cargá gastos diarios a mano o con la foto de borradores, cuadernos y tickets, con aviso en rojo de lo que hay que revisar." },
      { property: "og:title", content: "Gastos, remitos y presupuestos — Foto a Documento" },
      { property: "og:description", content: "Revisá gastos y documentos comerciales, conservá códigos exactos y exportá a Excel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GastosPage,
});

interface Fila { fecha: string; concepto: string; monto: string; categoria: string; dudosos: CampoGasto[]; incluir: boolean }

const peso = (n: number) => n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
const nuevoId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
const NOMBRES: Record<CampoGasto, string> = { fecha: "fecha", concepto: "concepto", monto: "monto", categoria: "categoría" };

function GastosPage() {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [hoy, setHoy] = useState("");
  const [manual, setManual] = useState({ fecha: "", concepto: "", monto: "", categoria: "Otros" });
  const [filas, setFilas] = useState<Fila[]>([]);
  const [foto, setFoto] = useState("");
  const [leyendo, setLeyendo] = useState(false);
  const [aviso, setAviso] = useState("");
  const [mes, setMes] = useState("");
  const archivo = useRef<HTMLInputElement>(null);
  const [editando, setEditando] = useState<Gasto | null>(null);

  useEffect(() => {
    const h = hoyLocal();
    setHoy(h);
    setMes(h.slice(0, 7));
    setManual((m) => ({ ...m, fecha: h }));
    listarGastos().then(setGastos).catch(() => setAviso("No se pudieron leer los gastos guardados."));
  }, []);

  const delMes = useMemo(() => gastos.filter((g) => !mes || g.fecha.startsWith(mes)), [gastos, mes]);
  const porCategoria = useMemo(() => {
    const r: Record<string, number> = {};
    delMes.forEach((g) => (r[g.categoria] = (r[g.categoria] ?? 0) + g.monto));
    return Object.entries(r).sort((a, b) => b[1] - a[1]);
  }, [delMes]);

  async function agregarManual(e: React.FormEvent) {
    e.preventDefault();
    const g: Gasto = { id: nuevoId(), fecha: manual.fecha, concepto: manual.concepto.trim(), monto: Number(manual.monto), categoria: manual.categoria, origen: "manual" };
    if (!esGastoValido(g)) return setAviso("Completá fecha, concepto y un monto mayor a cero.");
    await guardarGastos([g]);
    setGastos(await listarGastos());
    setManual({ fecha: hoy, concepto: "", monto: "", categoria: manual.categoria });
    setAviso("Gasto guardado.");
  }

  async function leerFoto(file: File) {
    setAviso("");
    setFilas([]);
    if (!navigator.onLine) return setAviso("Sin internet no se pueden leer fotos. Cargá los gastos a mano o probá cuando vuelva la conexión.");
    setLeyendo(true);
    try {
      const imagen = await achicarImagen(file, 2000);
      setFoto(imagen);
      const res = await fetch(`${baseIA()}/api/leer-gastos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imagen }) });
      const datos = await res.json();
      if (!res.ok) throw new Error(datos.error ?? "No se pudo leer la foto.");
      const leidos = (datos.gastos ?? []) as { fecha: string | null; concepto: string | null; monto: number | null; categoria: string | null; camposDudosos: string[] }[];
      if (!leidos.length) return setAviso("No encontré gastos legibles en la foto.");
      setFilas(
        leidos.map((l) => {
          const dudosos = l.camposDudosos.filter((c): c is CampoGasto => c in NOMBRES);
          if (!l.fecha) dudosos.push("fecha");
          if (!l.concepto) dudosos.push("concepto");
          if (!l.monto) dudosos.push("monto");
          return {
            fecha: l.fecha ?? "",
            concepto: l.concepto ?? "",
            monto: l.monto ? String(l.monto) : "",
            categoria: l.categoria && CATEGORIAS.some(c => c === l.categoria) ? l.categoria : "Otros",
            dudosos: [...new Set(dudosos)],
            incluir: true,
          };
        }),
      );
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "No se pudo leer la foto.");
    } finally {
      setLeyendo(false);
      if (archivo.current) archivo.current.value = "";
    }
  }

  const editar = (i: number, campo: keyof Fila, valor: string | boolean) =>
    setFilas((fs) => fs.map((f, j) => (j !== i ? f : { ...f, [campo]: valor, dudosos: campo in NOMBRES ? f.dudosos.filter((d) => d !== campo) : f.dudosos })));

  const pendientes = filas.filter((f) => f.incluir && f.dudosos.length).length;

  async function guardarLectura() {
    const lista: Gasto[] = filas
      .filter((f) => f.incluir)
      .map((f) => ({ id: nuevoId(), fecha: f.fecha, concepto: f.concepto.trim(), monto: Number(f.monto), categoria: f.categoria, origen: "foto" }));
    if (lista.some((g) => !esGastoValido(g))) return setAviso("Hay renglones incompletos: revisá fecha, concepto y monto (o destildalos).");
    if (!lista.length) return setAviso("Seleccioná al menos un gasto.");
    if (pendientes && !confirm("Quedan renglones dudosos. ¿Revisaste la foto y confirmás que los datos son correctos?")) return;
    await guardarGastos(lista);
    setGastos(await listarGastos());
    setFilas([]);
    setFoto("");
    setAviso(`Listo: se guardaron ${lista.length} gasto(s) de la foto.`);
  }

  async function borrar(id: string) {
    if (!confirm("¿Borrar este gasto?")) return;
    await borrarGasto(id);
    setGastos(await listarGastos());
  }

  const input = "w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm";
  const rojo = (f: Fila, c: CampoGasto) => (f.dudosos.includes(c) ? " border-2 border-destructive bg-destructive/10" : "");
  async function guardarEdicion(e: React.FormEvent) {
    e.preventDefault();
    if (!editando || !esGastoValido(editando)) return setAviso("Completá fecha, concepto y un importe mayor a cero.");
    try { await guardarGastos([editando]); setGastos(await listarGastos()); setEditando(null); setAviso("Gasto actualizado."); }
    catch { setAviso("No se pudo guardar el cambio."); }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-6 text-foreground">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Gastos diarios</h1>
          <p className="text-muted-foreground">Borradores, cuadernos y tickets en papel.</p>
        </div>
        <nav className="flex items-center gap-3 text-sm">
          <BotonActualizar />
          <Link to="/" className="underline">Inicio</Link>
        </nav>
      </header>

      <Tabs defaultValue="gastos" className="space-y-6">
      <TabsList className="h-auto flex-wrap"><TabsTrigger value="gastos">Foto a Documento</TabsTrigger><TabsTrigger value="documentos">Remitos y presupuestos</TabsTrigger></TabsList>
      <TabsContent value="documentos"><DocumentosGastos /></TabsContent>
      <TabsContent value="gastos" className="space-y-6">
      <Extracto
        titulo="Extracto de gastos"
        filas={gastos}
        fecha={(g) => g.fecha}
        monto={(g) => g.monto}
        columnas={[
          { titulo: "Fecha", valor: (g) => g.fecha.split("-").reverse().join("/") },
          { titulo: "Concepto", valor: (g) => g.concepto },
          { titulo: "Categoría", valor: (g) => g.categoria },
          { titulo: "Monto", valor: (g) => "$" + g.monto.toLocaleString("es-AR") },
        ]}
      />

      {aviso && <p className="rounded-md bg-muted px-3 py-2 text-sm" role="status">{aviso}</p>}

      <section className="border-t pt-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">Cargar desde foto</h2>
          <Button type="button" disabled={leyendo} onClick={() => archivo.current?.click()}>
            {leyendo ? "Leyendo la foto…" : "📷 Subir foto de nota o ticket"}
          </Button>
          <input ref={archivo} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && leerFoto(e.target.files[0])} />
        </div>
        {foto && <img src={foto} alt="Foto subida" className="mb-4 max-h-64 rounded-md border" />}
        {filas.length > 0 && (
          <div className="space-y-3">
            {pendientes > 0 && (
              <p className="rounded-md border-2 border-destructive bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                ⚠ {pendientes} renglón(es) con datos tachados o ilegibles. Corregí los campos marcados en rojo antes de guardar.
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr><th className="p-1">Guardar</th><th className="p-1">Fecha</th><th className="p-1">Concepto</th><th className="p-1">Categoría</th><th className="p-1">Importe</th></tr>
                </thead>
                <tbody>
                  {filas.map((f, i) => (
                    <tr key={i} className={!f.incluir ? "opacity-50" : f.dudosos.length ? "bg-destructive/10" : ""}>
                      <td className="p-1 text-center"><input type="checkbox" aria-label={`Guardar renglón ${i + 1}`} checked={f.incluir} onChange={(e) => editar(i, "incluir", e.target.checked)} /></td>
                      <td className="p-1"><input type="date" aria-label="Fecha" className={input + rojo(f, "fecha")} value={f.fecha} onChange={(e) => editar(i, "fecha", e.target.value)} /></td>
                      <td className="p-1"><input aria-label="Concepto" className={input + rojo(f, "concepto")} value={f.concepto} onChange={(e) => editar(i, "concepto", e.target.value)} /></td>
                      <td className="p-1">
                        <select aria-label="Categoría" className={input + rojo(f, "categoria")} value={f.categoria} onChange={(e) => editar(i, "categoria", e.target.value)}>
                          {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
                        </select>
                        {f.dudosos.length > 0 && <p className="mt-1 text-xs text-destructive">Revisar: {f.dudosos.map((d) => NOMBRES[d]).join(", ")}</p>}
                      </td>
                      <td className="p-1"><input type="number" aria-label="Monto" min="0" step="0.01" className={input + rojo(f, "monto")} value={f.monto} onChange={(e) => editar(i, "monto", e.target.value)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <Button type="button" onClick={guardarLectura}>
                Guardar {filas.filter((f) => f.incluir).length} gasto(s)
              </Button>
              <Button type="button" variant="secondary" onClick={() => { setFilas([]); setFoto(""); }}>Descartar</Button>
            </div>
            <p className="font-semibold">Total de la foto: {peso(filas.filter(f => f.incluir).reduce((s, f) => s + (Number(f.monto) || 0), 0))}</p>
          </div>
        )}
      </section>

      <section className="border-t pt-5">
        <h2 className="mb-3 text-xl font-semibold">Cargar a mano</h2>
        <form onSubmit={agregarManual} className="grid gap-2 sm:grid-cols-5">
          <input type="date" aria-label="Fecha" className={input} value={manual.fecha} onChange={(e) => setManual({ ...manual, fecha: e.target.value })} />
          <input aria-label="Concepto" placeholder="Concepto" className={input + " sm:col-span-2"} value={manual.concepto} onChange={(e) => setManual({ ...manual, concepto: e.target.value })} />
          <input type="number" aria-label="Monto" placeholder="Monto" min="0" step="0.01" className={input} value={manual.monto} onChange={(e) => setManual({ ...manual, monto: e.target.value })} />
          <select aria-label="Categoría" className={input} value={manual.categoria} onChange={(e) => setManual({ ...manual, categoria: e.target.value })}>
            {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
          </select>
          <Button type="submit" className="sm:col-span-5 sm:justify-self-start">Agregar gasto</Button>
        </form>
      </section>

      <section className="border-t pt-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">Gastos registrados</h2>
          <label className="flex items-center gap-2 text-sm">Mes <input type="month" className={input + " w-auto"} value={mes} onChange={(e) => setMes(e.target.value)} /></label>
        </div>
        <p className="mb-3 text-lg font-semibold">Total: {peso(totalGastos(delMes))}</p>
        {delMes.length > 0 && <div className="mb-4 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => gastosExcel(delMes, `Gastos ${mes || "todos"}`).catch(() => setAviso("No se pudo exportar el Excel."))}><Download />Excel</Button>
          <Button variant="outline" onClick={() => gastosWord(delMes, `Gastos ${mes || "todos"}`)}><FileText />Word</Button>
          <Button variant="outline" onClick={() => gastosImprimir(delMes, `Gastos ${mes || "todos"}`)}><Printer />Imprimir / PDF</Button>
          <Button variant="outline" onClick={() => gastosMail(delMes, `Gastos ${mes || "todos"}`)}><Mail />Enviar por mail</Button>
        </div>}
        {porCategoria.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2 text-sm">
            {porCategoria.map(([c, m]) => <span key={c} className="rounded-full bg-muted px-3 py-1">{c}: {peso(m)}</span>)}
          </div>
        )}
        {editando && <form onSubmit={guardarEdicion} className="mb-4 grid gap-2 sm:grid-cols-2" aria-label="Editar gasto">
          <input type="date" aria-label="Fecha del gasto a editar" className={input} value={editando.fecha} onChange={e => setEditando({ ...editando, fecha: e.target.value })} />
          <input aria-label="Concepto del gasto a editar" className={input} value={editando.concepto} onChange={e => setEditando({ ...editando, concepto: e.target.value })} />
          <select aria-label="Categoría del gasto a editar" className={input} value={editando.categoria} onChange={e => setEditando({ ...editando, categoria: e.target.value })}>{CATEGORIAS.map(c => <option key={c}>{c}</option>)}</select>
          <input type="number" step="0.01" aria-label="Importe del gasto a editar" className={input} value={editando.monto} onChange={e => setEditando({ ...editando, monto: Number(e.target.value) })} />
          <div className="flex gap-2"><Button type="submit">Guardar cambios</Button><Button type="button" variant="outline" onClick={() => setEditando(null)}>Cancelar</Button></div>
        </form>}
        {delMes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay gastos en este período.</p>
        ) : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="text-left text-muted-foreground"><tr><th className="p-1">Fecha</th><th className="p-1">Concepto</th><th className="p-1">Categoría</th><th className="p-1 text-right">Monto</th><th></th></tr></thead>
            <tbody>
              {delMes.map((g) => (
                <tr key={g.id} className="border-t">
                  <td className="p-1">{g.fecha.split("-").reverse().join("/")}</td>
                  <td className="p-1">{g.concepto}{g.origen === "foto" && <span className="ml-1 text-xs text-muted-foreground">(foto)</span>}</td>
                  <td className="p-1">{g.categoria}</td>
                  <td className="p-1 text-right">{peso(g.monto)}</td>
                  <td className="p-1 text-right"><div className="flex justify-end"><Button variant="ghost" size="icon" title="Editar gasto" aria-label={`Editar gasto ${g.concepto}`} onClick={() => setEditando({ ...g })}><Pencil /></Button><Button variant="ghost" size="icon" title="Borrar gasto" aria-label={`Borrar gasto ${g.concepto}`} onClick={() => borrar(g.id)}><Trash2 /></Button></div></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </section>
      </TabsContent>
      </Tabs>
    </main>
  );
}
