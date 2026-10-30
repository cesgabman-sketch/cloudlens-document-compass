import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DatosEmpresa } from "@/components/DatosEmpresa";
import { BotonActualizar } from "@/components/BotonActualizar";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Foto a Documento" },
      { name: "description", content: "Gastos, documentos comerciales y cotizaciones de tu empresa, guardados en esta PC." },
      { property: "og:title", content: "Foto a Documento" },
      { property: "og:description", content: "Gastos, documentos comerciales y cotizaciones de tu empresa, guardados en esta PC." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

function Home() {
  const navegar = useNavigate();
  const queryClient = useQueryClient();
  const [esAdmin, setEsAdmin] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data: usuario } = await supabase.auth.getUser();
      if (!usuario.user) return;
      const { data } = await supabase.rpc("has_role", { _user_id: usuario.user.id, _role: "admin" });
      setEsAdmin(!!data);
    })();
  }, []);

  async function salir() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await navegar({ to: "/auth", replace: true });
  }

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-6 text-foreground">
      <header>
        <div className="flex items-start justify-between gap-3">
          <DatosEmpresa />
          <Button variant="outline" onClick={salir}>
            Cerrar sesión
          </Button>
        </div>
        <h1 className="mt-4 text-3xl font-bold">Foto a Documento</h1>
        <p className="text-muted-foreground">Sacá foto a notas y documentos y tené todo ordenado.</p>
        <nav className="mt-3 flex flex-wrap gap-2 text-sm font-semibold text-tab-foreground">
          <Link to="/gastos" className="rounded-t-lg bg-tab-gastos px-4 py-2 shadow">📷 Foto a Documento</Link>
          <Link to="/cotizaciones" className="rounded-t-lg bg-tab-cotizaciones px-4 py-2 shadow">💵 Cotizaciones</Link>
        </nav>
        <div className="mt-3">
          <BotonActualizar />
        </div>
      </header>
    </main>
  );
}
