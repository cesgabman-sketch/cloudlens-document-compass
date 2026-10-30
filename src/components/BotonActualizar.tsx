import { useState } from "react";
import { listarGastos } from "@/lib/db-gastos";
import { listarDocumentos } from "@/lib/db-documentos";
import { listarCheques } from "@/lib/db-cheques";

declare global {
  interface Window {
    actualizar?: {
      estado: () => Promise<{ actualizado: boolean }>;
      buscar: () => Promise<{ ok: boolean; archivos: number }>;
      reiniciar: () => Promise<void>;
    };
    respaldo?: {
      guardar: (json: string) => Promise<string>;
      ultimo: () => Promise<string | null>;
    };
  }
}

/** Botón de actualización automática: solo aparece en el programa de Windows. */
export function BotonActualizar() {
  const [estado, setEstado] = useState<"idle" | "buscando" | "listo" | "error">("idle");
  const [mensaje, setMensaje] = useState("");

  if (typeof window === "undefined" || !window.actualizar) return null;

  // Copia de seguridad forzada ANTES de descargar nada: si falla, no se actualiza.
  async function copiaDeSeguridad(): Promise<void> {
    if (!window.respaldo) return;
    const [gastos, documentos, cheques] = await Promise.all([listarGastos(), listarDocumentos(), listarCheques([])]);
    const json = JSON.stringify(
      { tipo: "foto-a-documento", version: 1, exportado: new Date().toISOString(), gastos, documentos, cheques },
      null,
      2,
    );
    await window.respaldo.guardar(json);
  }

  async function buscar() {
    setEstado("buscando");
    setMensaje("Guardando copia de seguridad de tus datos…");
    try {
      await copiaDeSeguridad();
    } catch {
      setEstado("error");
      setMensaje("No se pudo guardar la copia de seguridad. Para proteger tus datos, la actualización se canceló.");
      return;
    }
    setMensaje("Copia guardada en Documentos → Copias Foto a Documento. Descargando la versión nueva…");
    try {
      await window.actualizar!.buscar();
      setEstado("listo");
      setMensaje("Actualización descargada y verificada. Tus datos están a salvo en la copia de seguridad. Tocá Reiniciar para aplicarla.");
    } catch (e) {
      setEstado("error");
      const motivo = e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, "") : "";
      setMensaje(`No se pudo actualizar${motivo ? ` (${motivo})` : ""}. Tus datos no se tocaron. Revisá que la PC tenga internet y probá de nuevo.`);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {estado === "listo" ? (
        <button
          onClick={() => window.actualizar!.reiniciar()}
          className="rounded-md bg-tab-gastos px-4 py-2 font-semibold text-tab-foreground shadow"
        >
          🔄 Reiniciar y aplicar actualización
        </button>
      ) : (
        <button
          onClick={buscar}
          disabled={estado === "buscando"}
          className="rounded-md border px-4 py-2 font-semibold shadow-sm disabled:opacity-60"
        >
          {estado === "buscando" ? "⏳ Actualizando…" : "🔄 Actualizar programa"}
        </button>
      )}
      {mensaje && <span className={estado === "error" ? "text-destructive" : "text-muted-foreground"}>{mensaje}</span>}
    </div>
  );
}
