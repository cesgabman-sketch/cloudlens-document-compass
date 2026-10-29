import { useEffect, useState } from "react";

// Queries the BCRA public API (CORS open) for reported cheques and bounced cheques by CUIT.
const API = "https://api.bcra.gob.ar";
interface Entidad { codigoEntidad: number; denominacion: string }

const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\b(BANCO|DE|LA|DEL|S\.?A\.?U?\.?|ARGENTINA)\b/g, "").replace(/[^A-Z0-9]/g, "");

/** Finds the BCRA bank code for a bank name typed by the user. */
export function buscarEntidad(entidades: Entidad[], banco: string): number | null {
  const b = normalizar(banco);
  if (!b) return null;
  const e = entidades.find((x) => normalizar(x.denominacion) === b) ?? entidades.find((x) => normalizar(x.denominacion).includes(b) || b.includes(normalizar(x.denominacion)));
  return e?.codigoEntidad ?? null;
}

export interface PedidoBCRA { banco: string; numero: string; n: number }

export function ConsultaBCRA({ pedido }: { pedido?: PedidoBCRA | null }) {
  const [entidades, setEntidades] = useState<Entidad[]>([]);
  const [modo, setModo] = useState<"denunciado" | "rechazados">("denunciado");
  const [entidad, setEntidad] = useState("");
  const [numero, setNumero] = useState("");
  const [cuit, setCuit] = useState("");
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState<{ tono: "ok" | "alerta" | "info"; texto: string; detalle?: string[] } | null>(null);

  useEffect(() => {
    fetch(`${API}/cheques/v1.0/entidades`).then((r) => r.json()).then((d) => setEntidades((d.results ?? []).sort((a: Entidad, b: Entidad) => a.denominacion.localeCompare(b.denominacion)))).catch(() => {});
  }, []);

  useEffect(() => {
    if (!pedido) return;
    setModo("denunciado");
    setNumero(pedido.numero.replace(/\D/g, ""));
    const cod = buscarEntidad(entidades, pedido.banco);
    setEntidad(cod ? String(cod) : "");
    setResultado(cod ? null : { tono: "info", texto: `No encontré "${pedido.banco}" en la lista del BCRA. Elegí el banco a mano.` });
    document.getElementById("consulta-bcra")?.scrollIntoView({ behavior: "smooth" });
  }, [pedido, entidades]);

  async function consultar(e: React.FormEvent) {
    e.preventDefault();
    if (!navigator.onLine) return setResultado({ tono: "info", texto: "Sin internet no se puede consultar al BCRA." });
    setCargando(true);
    setResultado(null);
    try {
      if (modo === "denunciado") {
        if (!entidad || !/^\d+$/.test(numero)) throw new Error("Elegí el banco y escribí el número de cheque (solo números).");
        const r = await fetch(`${API}/cheques/v1.0/denunciados/${entidad}/${numero}`);
        const d = await r.json();
        if (!r.ok) throw new Error(d.errorMessages?.join(" ") ?? "El BCRA no respondió.");
        const x = d.results;
        setResultado(
          x.denunciado
            ? { tono: "alerta", texto: `⚠ El cheque ${x.numeroCheque} de ${x.denominacionEntidad} FIGURA DENUNCIADO (robado, extraviado o adulterado). No lo aceptes.`, detalle: (x.detalles ?? []).map((t: { sucursal: number; numeroCuenta: number; causal: string }) => `Sucursal ${t.sucursal} · cuenta ${t.numeroCuenta} · ${t.causal}`) }
            : { tono: "ok", texto: `✓ El cheque ${x.numeroCheque} de ${x.denominacionEntidad} no figura denunciado. Datos del BCRA al ${String(x.fechaProcesamiento).split("-").reverse().join("/")}.` },
        );
      } else {
        const c = cuit.replace(/\D/g, "");
        if (c.length !== 11) throw new Error("El CUIT debe tener 11 números.");
        const r = await fetch(`${API}/CentralDeDeudores/v1.0/Deudas/ChequesRechazados/${c}`);
        const d = await r.json();
        if (r.status === 404) return setResultado({ tono: "ok", texto: `✓ El CUIT ${c} no registra cheques rechazados en el BCRA.` });
        if (!r.ok) throw new Error(d.errorMessages?.join(" ") ?? "El BCRA no respondió.");
        const res = d.results;
        const detalle: string[] = [];
        for (const causal of res.causales ?? [])
          for (const ent of causal.entidades ?? [])
            for (const ch of ent.detalle ?? [])
              detalle.push(`${causal.causal} · cheque ${ch.nroCheque} · ${Number(ch.monto).toLocaleString("es-AR", { style: "currency", currency: "ARS" })} · rechazo ${ch.fechaRechazo}${ch.fechaPago ? ` · pagado ${ch.fechaPago}` : " · SIN PAGAR"}`);
        setResultado(detalle.length
          ? { tono: "alerta", texto: `⚠ ${res.denominacion ?? c} registra ${detalle.length} cheque(s) rechazado(s).`, detalle }
          : { tono: "ok", texto: `✓ ${res.denominacion ?? c} no registra cheques rechazados.` });
      }
    } catch (e) {
      setResultado({ tono: "info", texto: e instanceof Error ? e.message : "No se pudo consultar al BCRA." });
    } finally {
      setCargando(false);
    }
  }

  const input = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
  const tab = (m: typeof modo, t: string) => (
    <button type="button" onClick={() => { setModo(m); setResultado(null); }} className={`rounded-md px-3 py-1.5 text-sm font-medium ${modo === m ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>{t}</button>
  );
  const color = resultado?.tono === "alerta" ? "border-destructive bg-destructive/10 text-destructive" : resultado?.tono === "ok" ? "border-[var(--semaforo-verde)] bg-muted" : "bg-muted";

  return (
    <section id="consulta-bcra" className="rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="text-xl font-semibold">Consulta en el BCRA</h2>
      <p className="mb-3 text-sm text-muted-foreground">Base oficial del Banco Central: cheques denunciados y cheques rechazados por CUIT.</p>
      <div className="mb-3 flex gap-2">{tab("denunciado", "Cheque denunciado")}{tab("rechazados", "Rechazados por CUIT")}</div>
      <form onSubmit={consultar} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        {modo === "denunciado" ? (
          <>
            <select aria-label="Banco" className={input} value={entidad} onChange={(e) => setEntidad(e.target.value)}>
              <option value="">{entidades.length ? "Elegí el banco" : "Cargando bancos…"}</option>
              {entidades.map((x) => <option key={x.codigoEntidad} value={x.codigoEntidad}>{x.denominacion}</option>)}
            </select>
            <input aria-label="Número de cheque" placeholder="Número de cheque" inputMode="numeric" className={input} value={numero} onChange={(e) => setNumero(e.target.value)} />
          </>
        ) : (
          <input aria-label="CUIT del librador" placeholder="CUIT del librador (11 números)" inputMode="numeric" className={input + " sm:col-span-2"} value={cuit} onChange={(e) => setCuit(e.target.value)} />
        )}
        <button disabled={cargando} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">{cargando ? "Consultando…" : "Consultar"}</button>
      </form>
      {resultado && (
        <div className={`mt-3 rounded-md border-2 px-3 py-2 text-sm ${color}`} role="status">
          <p className="font-medium">{resultado.texto}</p>
          {resultado.detalle && <ul className="mt-1 list-disc pl-5">{resultado.detalle.map((d, i) => <li key={i}>{d}</li>)}</ul>}
        </div>
      )}
    </section>
  );
}
