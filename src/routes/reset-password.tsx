import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Elegir clave nueva — Foto a Documento" },
      { name: "description", content: "Elegí una clave nueva para tu cuenta de Foto a Documento." },
      { property: "og:title", content: "Elegir clave nueva — Foto a Documento" },
      { property: "og:description", content: "Recuperá el acceso a tu cuenta de Foto a Documento." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NuevaClave,
});

const input = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

function NuevaClave() {
  const [listo, setListo] = useState(false);
  const [enlaceValido, setEnlaceValido] = useState<boolean | null>(null);
  const [clave, setClave] = useState("");
  const [repetir, setRepetir] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    const esRecuperacion = window.location.hash.includes("type=recovery");
    const { data } = supabase.auth.onAuthStateChange((evento, sesion) => {
      if (evento === "PASSWORD_RECOVERY" || (esRecuperacion && sesion)) setEnlaceValido(true);
    });
    const t = window.setTimeout(() => {
      void supabase.auth.getSession().then(({ data: d }) => setEnlaceValido((v) => v ?? !!d.session));
    }, 1500);
    return () => { data.subscription.unsubscribe(); window.clearTimeout(t); };
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (cargando) return;
    setError("");
    if (clave !== repetir) { setError("Las dos claves no coinciden."); return; }
    setCargando(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password: clave });
      if (err) throw err;
      await supabase.auth.signOut({ scope: "local" });
      setListo(true);
    } catch (err) {
      const msg = (err as Error).message;
      setError(/weak|easy to guess|pwned/i.test(msg)
        ? "Esa clave es muy común y no es segura. Elegí otra más difícil (mezclá palabras, números y símbolos, al menos 8 caracteres)."
        : /different from the old|same/i.test(msg)
          ? "La clave nueva tiene que ser distinta de la anterior."
          : `No se pudo cambiar la clave: ${msg}`);
    } finally { setCargando(false); }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      <div className="w-full max-w-md space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Foto a Documento</h1>
        {listo ? (
          <div className="space-y-3">
            <p className="rounded-md bg-muted px-3 py-2 text-sm" role="status">
              ✓ Clave cambiada. Ya podés entrar con tu clave nueva, acá o en el programa de Windows.
            </p>
            <Link to="/auth" className="block w-full rounded-md bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground">Ir a entrar</Link>
          </div>
        ) : enlaceValido === false ? (
          <div className="space-y-3">
            <p className="rounded-md bg-muted px-3 py-2 text-sm text-destructive" role="alert">
              Este enlace venció o ya se usó. Pedí uno nuevo con «¿Olvidaste tu clave?».
            </p>
            <Link to="/auth" className="text-sm text-primary underline">Volver a entrar</Link>
          </div>
        ) : (
          <form onSubmit={guardar} className="space-y-2">
            <h2 className="text-lg font-semibold">Elegí tu clave nueva</h2>
            <input className={input} type="password" placeholder="Clave nueva" value={clave} onChange={(e) => setClave(e.target.value)} required minLength={8} />
            <input className={input} type="password" placeholder="Repetí la clave nueva" value={repetir} onChange={(e) => setRepetir(e.target.value)} required minLength={8} />
            <button disabled={cargando || enlaceValido !== true} className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
              {cargando ? "Un momento…" : enlaceValido === null ? "Verificando enlace…" : "Guardar clave nueva"}
            </button>
            {error && <p className="rounded-md bg-muted px-3 py-2 text-sm text-destructive" role="alert">{error}</p>}
          </form>
        )}
      </div>
    </main>
  );
}
