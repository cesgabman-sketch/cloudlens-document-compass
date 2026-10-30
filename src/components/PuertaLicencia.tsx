import { useEffect, useState, type ReactNode } from "react";
import { activarLicencia, licenciaDisponible, verificarLicencia, type EstadoLicencia } from "@/lib/licencia";

type Fase =
  | { tipo: "verificando" }
  | { tipo: "activar"; motivo?: string }
  | { tipo: "bloqueado"; motivo: string }
  | { tipo: "ok"; estado: EstadoLicencia };

/**
 * Puerta de licencia: en el programa de Windows exige una clave activada antes
 * de mostrar la app. En el navegador (vista web) no hace nada.
 */
export function PuertaLicencia({ children }: { children: ReactNode }) {
  const [fase, setFase] = useState<Fase>({ tipo: "verificando" });
  const esEscritorio = licenciaDisponible();

  useEffect(() => {
    if (!esEscritorio) return;
    let vivo = true;
    const verificar = () =>
      verificarLicencia().then((r) => {
        if (!vivo) return;
        if (r.acceso) setFase({ tipo: "ok", estado: r.estado });
        else if (r.activar) setFase({ tipo: "activar" });
        else setFase({ tipo: "bloqueado", motivo: r.motivo });
      });
    void verificar();
    // Revalidación periódica mientras el programa está abierto.
    const t = setInterval(verificar, 60 * 60 * 1000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [esEscritorio]);

  if (!esEscritorio) return <>{children}</>;

  if (fase.tipo === "ok") return <>{children}</>;

  if (fase.tipo === "verificando") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Verificando licencia…</p>
      </div>
    );
  }

  return (
    <PantallaActivacion
      motivoBloqueo={fase.tipo === "bloqueado" ? fase.motivo : undefined}
      onActivada={(estado) => setFase({ tipo: "ok", estado })}
    />
  );
}

function PantallaActivacion({ motivoBloqueo, onActivada }: { motivoBloqueo: string | undefined; onActivada: (e: EstadoLicencia) => void }) {
  const [clave, setClave] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(motivoBloqueo ?? "");

  async function activar() {
    setCargando(true);
    setError("");
    const r = await activarLicencia(clave);
    setCargando(false);
    if (r.ok && r.estado) onActivada(r.estado);
    else setError(r.motivo || "No se pudo activar.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-lg">
        <h1 className="text-center text-2xl font-bold text-foreground">📷 Foto a Documento</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Para usar el programa en esta PC, escribí la clave de licencia que te dio el proveedor.
          La activación necesita internet una sola vez.
        </p>
        <form
          className="mt-6 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void activar();
          }}
        >
          <input
            value={clave}
            onChange={(e) => setClave(e.target.value.toUpperCase())}
            placeholder="LIC-XXXX-XXXX"
            autoComplete="off"
            className="w-full rounded-md border bg-background px-3 py-2 text-center font-mono text-lg tracking-widest"
          />
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={cargando || !clave.trim()}
            className="w-full rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-60"
          >
            {cargando ? "⏳ Activando…" : "Activar programa"}
          </button>
        </form>
      </div>
    </div>
  );
}
