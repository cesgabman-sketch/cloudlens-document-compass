import { useEffect, useRef, useState } from "react";
import { Camera, Download, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { Button } from "./ui/button";
import { hoyLocal } from "./SemaforoBadge";
import { achicarImagen } from "@/lib/imagen";
import { ErrorLectura, leerFotoIA } from "@/lib/lector-ia";
import { borrarDocumento, guardarDocumento, listarDocumentos } from "@/lib/db-documentos";
import { TIPOS_DOCUMENTO, cambiarItem, difiereTotal, documentoValido, totalDocumento, totalItem, type Documento, type ItemDocumento, type TipoDocumento } from "@/lib/documentos";
import { exportarDocumento } from "@/lib/documentos-excel";
import { limpiarDocumento } from "@/lib/documentos-filtrado";
import { exportarWord, imprimirDocumento, mailDocumento } from "@/lib/documentos-otros";
import { FileText, Mail, Printer } from "lucide-react";

const input = "w-full min-w-0 rounded-md border border-input bg-background px-2 py-2 text-sm";
const ETIQUETAS = { proveedor: "Proveedor (emisor)", cuitProveedor: "CUIT del proveedor", cliente: "Cliente / Razón social", cuitCliente: "CUIT del cliente", numero: "Número", fecha: "Fecha" } as const;
const moneda = (n: number | null) => n === null ? "Sin precio" : n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
const nuevoItem = (): ItemDocumento => ({ codigo: "", cantidad: 1, descripcion: "", precioUnitario: null, totalLeido: null, dudosos: [] });
const vacio = (): Documento => ({ id: crypto.randomUUID(), tipo: "Remito", proveedor: "", cuitProveedor: "", cliente: "", cuitCliente: "", numero: "", fecha: hoyLocal(), items: [nuevoItem()], camposDudosos: [] });

export function DocumentosGastos() {
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [actual, setActual] = useState<Documento | null>(null);
  const [foto, setFoto] = useState("");
  const [aviso, setAviso] = useState("");
  const [leyendo, setLeyendo] = useState(false);
  const [reintentable, setReintentable] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);
  useEffect(() => { listarDocumentos().then(setDocumentos).catch(() => setAviso("No se pudieron leer los documentos guardados.")); }, []);

  async function leer(file: File) {
    if (actual && !confirm("¿Descartar la revisión actual y leer otra foto?")) return;
    try { const imagen = await achicarImagen(file, 2400); setFoto(imagen); await procesarFoto(imagen); }
    catch { setAviso("No se pudo preparar la foto."); }
    finally { if (archivo.current) archivo.current.value = ""; }
  }
  async function procesarFoto(imagen: string) {
    setLeyendo(true); setAviso(""); setReintentable(false);
    try {
      const respuesta = await leerFotoIA(imagen, "documento");
      const datos = limpiarDocumento(respuesta);
      const items = Array.isArray(datos.items) && datos.items.length ? datos.items : [nuevoItem()];
      setActual({ ...datos, items, id: crypto.randomUUID() }); setFoto(imagen);
      if (!datos.items?.length) setAviso("Leí los datos generales pero no los renglones. Completalos a mano mirando la foto.");
    } catch (e) { setAviso(e instanceof Error ? e.message : "No se pudo leer la foto."); setReintentable(e instanceof ErrorLectura && e.retryable); }
    finally { setLeyendo(false); if (archivo.current) archivo.current.value = ""; }
  }
  function editar(i: number, campo: "codigo" | "cantidad" | "descripcion" | "precioUnitario", valor: string) {
    setActual(d => d ? { ...d, items: d.items.map((item, idx) => idx === i ? cambiarItem(item, campo, valor) : item) } : d);
  }
  function general(campo: "proveedor" | "cuitProveedor" | "cliente" | "cuitCliente" | "numero" | "fecha", valor: string) {
    setActual(d => d ? { ...d, [campo]: valor, camposDudosos: d.camposDudosos.filter(c => c !== campo) } : d);
  }
  function confirmar(d: Documento) {
    if (!documentoValido(d)) { setAviso("Completá proveedor, fecha, descripción y cantidad mayor a cero; el precio puede quedar vacío."); return false; }
    const diferencias = d.items.map((i, idx) => difiereTotal(i) ? idx + 1 : null).filter(i => i !== null);
    if (diferencias.length && !confirm(`El total leído no coincide con cantidad × precio en los renglones ${diferencias.join(", ")}. ¿Confirmás usar el total recalculado?`)) return false;
    if ((d.camposDudosos.length || d.items.some(i => i.dudosos.length)) && !confirm("Quedan datos o códigos dudosos. ¿Revisaste la foto y confirmás que son correctos?")) return false;
    return true;
  }
  async function guardar() {
    if (!actual || !confirmar(actual)) return;
    setOcupado(true);
    try { await guardarDocumento(actual); setDocumentos(await listarDocumentos()); setActual(null); setFoto(""); setAviso("Documento guardado en esta PC."); }
    catch { setAviso("No se pudo guardar el documento. Tu revisión sigue disponible."); }
    finally { setOcupado(false); }
  }
  async function excel(d: Documento) {
    if (!confirmar(d)) return;
    try { await exportarDocumento(d); setAviso("Excel exportado."); } catch { setAviso("No se pudo exportar el Excel."); }
  }
  async function borrar(d: Documento) {
    if (!confirm(`¿Eliminar ${d.tipo.toLowerCase()} ${d.numero || "sin número"}?`)) return;
    try { await borrarDocumento(d.id); setDocumentos(await listarDocumentos()); } catch { setAviso("No se pudo eliminar el documento."); }
  }
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-semibold">Convertidor de remitos, presupuestos y facturas</h2>
      <div className="flex flex-wrap gap-2">
        <Button disabled={leyendo || ocupado} onClick={() => archivo.current?.click()}><Camera />{leyendo ? "Leyendo foto…" : "Subir foto de documento"}</Button>
        <Button variant="outline" disabled={leyendo || ocupado} onClick={() => { if (!actual || confirm("¿Descartar la revisión actual?")) { setActual(vacio()); setFoto(""); setAviso(""); } }}><Plus />Nuevo documento</Button>
      </div>
      <input ref={archivo} type="file" aria-label="Foto de remito o presupuesto" accept="image/*" capture="environment" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) void leer(file); }} />
    </div>
    {aviso && <p role="status" className="rounded-md bg-muted p-3 text-sm">{aviso}</p>}
    {foto && !actual && <img src={foto} alt="Documento pendiente de lectura" className="max-h-72 max-w-full object-contain" />}
    {foto && reintentable && <Button variant="outline" disabled={leyendo} onClick={() => procesarFoto(foto)}>Reintentar lectura</Button>}
    {actual && <section className="space-y-4 border-t pt-4" aria-label="Revisión del documento">
      {foto && <img src={foto} alt="Remito o presupuesto subido" className="max-h-72 max-w-full object-contain" />}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm">Tipo de documento<select aria-label="Tipo de documento" className={input + (actual.camposDudosos.includes("tipo") ? " border-destructive bg-destructive/10" : "")} value={actual.tipo} onChange={e => setActual({ ...actual, tipo: e.target.value as TipoDocumento, camposDudosos: actual.camposDudosos.filter(c => c !== "tipo") })}>{TIPOS_DOCUMENTO.map(t => <option key={t}>{t}</option>)}</select></label>
        {(["proveedor", "cuitProveedor", "cliente", "cuitCliente", "numero", "fecha"] as const).map(c => <label key={c} className="text-sm">{ETIQUETAS[c]}<input aria-label={c === "numero" ? "Número de documento" : c === "fecha" ? "Fecha de documento" : ETIQUETAS[c]} type={c === "fecha" ? "date" : "text"} className={input + (actual.camposDudosos.includes(c) ? " border-destructive bg-destructive/10" : "")} value={actual[c] ?? ""} onChange={e => general(c, e.target.value)} /></label>)}
      </div>
      {(actual.camposDudosos.length > 0 || actual.items.some(i => i.dudosos.length)) && <p role="alert" className="border-l-4 border-destructive bg-destructive/10 p-3 text-sm text-destructive">Hay datos o códigos que no se leen con claridad. Revisá los campos resaltados.</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm"><thead className="bg-muted text-left"><tr>{["Código", "Cantidad", "Detalle/descripción", "P/unitario", "Total", ""].map((c, i) => <th key={i} className="p-2">{c}</th>)}</tr></thead><tbody>
          {actual.items.map((item, i) => <tr key={i} className={item.dudosos.length || difiereTotal(item) ? "border-b bg-destructive/10" : "border-b"}>
            {(["codigo", "cantidad", "descripcion", "precioUnitario"] as const).map(c => <td key={c} className="p-2"><input aria-label={`${c === "codigo" ? "Código" : c === "cantidad" ? "Cantidad" : c === "descripcion" ? "Descripción" : "Precio unitario"} ${i + 1}`} type={c === "cantidad" || c === "precioUnitario" ? "number" : "text"} min="0" step="any" className={input + (c === "descripcion" ? " min-w-48" : " w-32") + (item.dudosos.includes(c) ? " border-2 border-destructive" : "")} value={item[c] ?? ""} onChange={e => editar(i, c, e.target.value)} /></td>)}
            <td className="p-2"><div className="whitespace-nowrap font-medium">{moneda(totalItem(item))}</div>{item.totalLeido !== null && <p className={difiereTotal(item) ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>Leído: {moneda(item.totalLeido)}{difiereTotal(item) ? " · No coincide" : ""}</p>}{item.dudosos.length > 0 && <span className="text-xs text-destructive">Revisar: {item.dudosos.join(", ")}</span>}</td>
            <td className="p-2"><Button size="icon" variant="ghost" aria-label={`Eliminar renglón ${i + 1}`} title="Eliminar renglón" onClick={() => setActual({ ...actual, items: actual.items.filter((_, idx) => idx !== i) })}><Trash2 /></Button></td>
          </tr>)}
        </tbody></table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3"><Button variant="outline" onClick={() => setActual({ ...actual, items: [...actual.items, nuevoItem()] })}><Plus />Agregar renglón</Button><p className="font-semibold">{actual.items.some(i => totalItem(i) === null) ? "Total con precios disponibles" : "Total"}: {moneda(totalDocumento(actual))}</p></div>
      <div className="flex flex-wrap gap-2"><Button disabled={ocupado || !actual.items.length} onClick={guardar}><Save />Confirmar y guardar</Button><Button variant="outline" disabled={!actual.items.length} onClick={() => excel(actual)}><Download />Excel</Button><Button variant="outline" disabled={!actual.items.length} onClick={() => confirmar(actual) && exportarWord(actual)}><FileText />Word</Button><Button variant="outline" disabled={!actual.items.length} onClick={() => confirmar(actual) && imprimirDocumento(actual)}><Printer />Imprimir / PDF</Button><Button variant="outline" disabled={!actual.items.length} onClick={() => confirmar(actual) && mailDocumento(actual)}><Mail />Enviar por mail</Button><Button variant="ghost" onClick={() => { if (confirm("¿Descartar los cambios del documento?")) { setActual(null); setFoto(""); } }}><X />Descartar</Button></div>
    </section>}
    <section className="border-t pt-5"><h3 className="mb-3 text-lg font-semibold">Documentos guardados</h3>{documentos.length === 0 ? <p className="text-sm text-muted-foreground">No hay remitos ni presupuestos guardados.</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-muted-foreground"><tr>{["Tipo", "Proveedor", "Número", "Fecha", "Total", ""].map((c, i) => <th key={i} className="p-2">{c}</th>)}</tr></thead><tbody>{documentos.map(d => <tr key={d.id} className="border-t"><td className="p-2">{d.tipo}</td><td className="p-2">{d.proveedor}</td><td className="p-2">{d.numero || "—"}</td><td className="whitespace-nowrap p-2">{d.fecha.split("-").reverse().join("/")}</td><td className="whitespace-nowrap p-2">{d.items.every(i => totalItem(i) === null) ? "Sin precios" : moneda(totalDocumento(d))}</td><td className="p-2"><div className="flex"><Button variant="ghost" size="icon" title="Editar documento" aria-label={`Editar documento ${d.numero}`} onClick={() => { if (!actual || confirm("¿Descartar la revisión actual?")) { setActual(structuredClone(d)); setFoto(""); } }}><Pencil /></Button><Button variant="ghost" size="icon" title="Exportar a Excel" aria-label={`Exportar documento ${d.numero}`} onClick={() => excel(d)}><Download /></Button><Button variant="ghost" size="icon" title="Word" aria-label={`Word ${d.numero}`} onClick={() => exportarWord(d)}><FileText /></Button><Button variant="ghost" size="icon" title="Imprimir / PDF" aria-label={`Imprimir ${d.numero}`} onClick={() => imprimirDocumento(d)}><Printer /></Button><Button variant="ghost" size="icon" title="Enviar por mail" aria-label={`Mail ${d.numero}`} onClick={() => mailDocumento(d)}><Mail /></Button><Button variant="ghost" size="icon" title="Eliminar documento" aria-label={`Eliminar documento ${d.numero}`} onClick={() => borrar(d)}><Trash2 /></Button></div></td></tr>)}</tbody></table></div>}</section>
  </div>;
}