import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: Acceso,
});

type Modo = "entrar" | "crear" | "empresa";

const input = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

function Acceso() {
  const navegar = useNavigate();
  const [modo, setModo] = useState<Modo>("entrar");
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [nombreEmpresa, setNombreEmpresa] = useState("");
  const [codigo, setCodigo] = useState("");
  const [codigoNuevo, setCodigoNuevo] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [cargando, setCargando] = useState(false);

  /** Si ya entró: con empresa va al inicio; sin empresa, a elegir empresa. */
  async function continuar() {
    const { data, error: e } = await supabase.rpc("mi_empresa_id");
    if (e) { setError("No se pudo verificar la empresa. Probá de nuevo."); return; }
    if (data) {
      await navegar({ to: "/", replace: true });
      return;
    }
    setModo("empresa");
  }

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) await continuar();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    if (cargando) return;
    setError(""); setAviso(""); setCargando(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password: clave });
      if (err) throw err;
      await continuar();
    } catch (err) {
      setError((err as Error).message.includes("Invalid login credentials")
        ? "Email o clave incorrectos."
        : `No se pudo entrar: ${(err as Error).message}`);
    } finally { setCargando(false); }
  }

  async function crearCuenta(e: React.FormEvent) {
    e.preventDefault();
    if (cargando) return;
    setError(""); setAviso(""); setCargando(true);
    try {
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password: clave,
        options: { emailRedirectTo: window.location.origin },
      });
      if (err) throw err;
      if (data.session) {
        await continuar();
        return;
      }
      setAviso("Cuenta creada. Revisá tu email y tocá el enlace para confirmarla; después volvé a entrar acá.");
      setModo("entrar");
    } catch (err) {
      setError(`No se pudo crear la cuenta: ${(err as Error).message}`);
    } finally { setCargando(false); }
  }

  async function crearEmpresa(e: React.FormEvent) {
    e.preventDefault();
    if (cargando) return;
    setError(""); setAviso(""); setCargando(true);
    try {
      const { data, error: err } = await supabase.rpc("crear_empresa", { _nombre: nombreEmpresa });
      if (err) throw err;
      setCodigoNuevo((data as { codigo: string }).codigo);
      await navegar({ to: "/", replace: true });
    } catch (err) {
      setError(`No se pudo crear la empresa: ${(err as Error).message}`);
    } finally { setCargando(false); }
  }

  async function unirse(e: React.FormEvent) {
    e.preventDefault();
    if (cargando) return;
    setError(""); setAviso(""); setCargando(true);
    try {
      const { error: err } = await supabase.rpc("unirse_empresa", { _codigo: codigo });
      if (err) throw err;
      await navegar({ to: "/", replace: true });
    } catch (err) {
      setError((err as Error).message.includes("invalido")
        ? "El código de empresa no es válido."
        : `No se pudo unir a la empresa: ${(err as Error).message}`);
    } finally { setCargando(false); }
  }

  async function salirDeLaSesion() {
    await supabase.auth.signOut();
    setModo("entrar");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      <div className="w-full max-w-md space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Foto a Documento</h1>

        {modo === "empresa" ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              ¿Creás una empresa nueva o te unís a una existente con el código que te dio el dueño?
            </p>
            <form onSubmit={crearEmpresa} className="flex gap-2">
              <input className={input} placeholder="Nombre de la empresa nueva" value={nombreEmpresa} onChange={(e) => setNombreEmpresa(e.target.value)} required />
              <button disabled={cargando} className="whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
                Crear
              </button>
            </form>
            <form onSubmit={unirse} className="flex gap-2">
              <input className={input} placeholder="Código de empresa (ej: A1B2C3D4)" value={codigo} onChange={(e) => setCodigo(e.target.value)} required />
              <button disabled={cargando} className="whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
                Unirme
              </button>
            </form>
            <button onClick={salirDeLaSesion} className="text-xs text-muted-foreground underline">Cerrar sesión</button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2 text-sm">
              <button type="button" onClick={() => { setModo("entrar"); setError(""); setAviso(""); }} className={`flex-1 rounded-md border px-3 py-2 ${modo === "entrar" ? "bg-accent font-semibold" : ""}`}>Entrar</button>
              <button type="button" onClick={() => { setModo("crear"); setError(""); setAviso(""); }} className={`flex-1 rounded-md border px-3 py-2 ${modo === "crear" ? "bg-accent font-semibold" : ""}`}>Crear cuenta</button>
            </div>
            <form onSubmit={modo === "entrar" ? entrar : crearCuenta} className="space-y-2">
              <input className={input} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <input className={input} type="password" placeholder="Clave" value={clave} onChange={(e) => setClave(e.target.value)} required minLength={6} />
              <button disabled={cargando} className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
                {cargando ? "Un momento…" : modo === "entrar" ? "Entrar" : "Crear cuenta"}
              </button>
            </form>
            {aviso && <p className="rounded-md bg-muted px-3 py-2 text-sm" role="status">{aviso}</p>}
          </div>
        )}

        {codigoNuevo && (
          <p className="rounded-md bg-muted px-3 py-2 text-sm">
            Código de tu empresa (pasáselo a quien quieras que entre con sus datos): <strong>{codigoNuevo}</strong>
          </p>
        )}
        {error && <p className="rounded-md bg-muted px-3 py-2 text-sm text-destructive" role="alert">{error}</p>}
      </div>
    </main>
  );
}
