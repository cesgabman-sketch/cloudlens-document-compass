import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Licencias — Foto a Documento" },
      { name: "description", content: "Panel de administración de licencias por equipo." },
      { property: "og:title", content: "Licencias — Foto a Documento" },
      { property: "og:description", content: "Panel de administración de licencias por equipo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminLicencias,
});

interface Terminal {
  id: string;
  machine_id: string;
  nombre_pc: string;
  activada_at: string;
  ultima_conexion: string;
}

interface Licencia {
  id: string;
  clave: string;
  cliente: string;
  max_terminales: number;
  vencimiento: string | null;
  estado: "activa" | "suspendida" | "cancelada";
  created_at: string;
  terminales: Terminal[];
}

const fechaCorta = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-AR") : "—");

function AdminLicencias() {
  const [esAdmin, setEsAdmin] = useState<boolean | null>(null);
  const [licencias, setLicencias] = useState<Licencia[]>([]);
  const [mensaje, setMensaje] = useState("");
  const [cliente, setCliente] = useState("");
  const [cupo, setCupo] = useState(1);
  const [vencimiento, setVencimiento] = useState("");

  async function cargar() {
    const { data: usuario } = await supabase.auth.getUser();
    if (!usuario.user) {
      setEsAdmin(false);
      return;
    }
    const { data: rol } = await supabase.rpc("has_role", { _user_id: usuario.user.id, _role: "admin" });
    if (!rol) {
      setEsAdmin(false);
      return;
    }
    setEsAdmin(true);
    const { data, error } = await supabase.rpc("listar_licencias");
    if (error) setMensaje("No se pudieron cargar las licencias.");
    else setLicencias((data as unknown as Licencia[]) ?? []);
  }

  useEffect(() => {
    void cargar();
  }, []);

  async function crear() {
    if (!cliente.trim()) return;
    const args: { _cliente: string; _max_terminales: number; _vencimiento?: string } = {
      _cliente: cliente.trim(),
      _max_terminales: cupo,
    };
    if (vencimiento) args._vencimiento = vencimiento;
    const { data, error } = await supabase.rpc("crear_licencia", args);
    if (error) setMensaje("No se pudo crear la licencia.");
    else {
      setMensaje(`Licencia creada: ${(data as { clave?: string })?.clave ?? ""}`);
      setCliente("");
      setCupo(1);
      setVencimiento("");
      void cargar();
    }
  }

  async function cambiarEstado(id: string, estado: string) {
    await supabase.rpc("cambiar_estado_licencia", { _licencia_id: id, _estado: estado });
    void cargar();
  }

  async function liberar(id: string) {
    await supabase.rpc("liberar_terminal", { _terminal_id: id });
    void cargar();
  }

  if (esAdmin === null) return <p className="p-8 text-center text-muted-foreground">Cargando…</p>;

  if (!esAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4">
        <p className="text-muted-foreground">Esta sección es solo para el administrador.</p>
        <Link to="/" className="rounded-md border px-4 py-2 font-semibold">← Volver al inicio</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">🔑 Licencias</h1>
        <Link to="/" className="rounded-md border px-4 py-2 text-sm font-semibold">← Inicio</Link>
      </div>

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="font-semibold">Nueva licencia</h2>
        <div className="flex flex-wrap gap-2">
          <input
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            placeholder="Nombre del cliente o empresa"
            className="min-w-52 flex-1 rounded-md border bg-background px-3 py-2"
          />
          <label className="flex items-center gap-2 text-sm">
            PCs:
            <input
              type="number"
              min={1}
              value={cupo}
              onChange={(e) => setCupo(Math.max(1, Number(e.target.value) || 1))}
              className="w-20 rounded-md border bg-background px-3 py-2"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            Vence:
            <input
              type="date"
              value={vencimiento}
              onChange={(e) => setVencimiento(e.target.value)}
              className="rounded-md border bg-background px-3 py-2"
            />
          </label>
          <button onClick={crear} className="rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground">
            Generar clave
          </button>
        </div>
        {mensaje && <p className="text-sm text-muted-foreground">{mensaje}</p>}
      </section>

      {licencias.length === 0 && <p className="text-center text-muted-foreground">Todavía no hay licencias.</p>}

      {licencias.map((l) => (
        <section key={l.id} className="space-y-3 rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-mono text-lg font-bold tracking-widest">{l.clave}</p>
              <p className="text-sm text-muted-foreground">
                {l.cliente} · {l.terminales.length}/{l.max_terminales} PCs · vence {fechaCorta(l.vencimiento)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  l.estado === "activa" ? "bg-tab-gastos text-tab-foreground" : "bg-destructive/10 text-destructive"
                }`}
              >
                {l.estado}
              </span>
              {l.estado !== "activa" && (
                <button onClick={() => cambiarEstado(l.id, "activa")} className="rounded-md border px-3 py-1 text-sm">
                  Activar
                </button>
              )}
              {l.estado === "activa" && (
                <button onClick={() => cambiarEstado(l.id, "suspendida")} className="rounded-md border px-3 py-1 text-sm">
                  Suspender
                </button>
              )}
              {l.estado !== "cancelada" && (
                <button
                  onClick={() => cambiarEstado(l.id, "cancelada")}
                  className="rounded-md border border-destructive px-3 py-1 text-sm text-destructive"
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>
          {l.terminales.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1">PC</th>
                  <th className="py-1">Activada</th>
                  <th className="py-1">Última conexión</th>
                  <th className="py-1" />
                </tr>
              </thead>
              <tbody>
                {l.terminales.map((t) => (
                  <tr key={t.id} className="border-t">
                    <td className="py-1">{t.nombre_pc}</td>
                    <td className="py-1">{fechaCorta(t.activada_at)}</td>
                    <td className="py-1">{fechaCorta(t.ultima_conexion)}</td>
                    <td className="py-1 text-right">
                      <button
                        onClick={() => liberar(t.id)}
                        className="rounded-md border px-3 py-1 text-xs"
                        title="Libera el puesto para que el cliente active otra PC"
                      >
                        Liberar PC
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}
    </div>
  );
}
