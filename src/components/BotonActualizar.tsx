import { useState } from "react";

declare global {
  interface Window {
    actualizar?: {
      estado: () => Promise<{ actualizado: boolean }>;
      buscar: () => Promise<{ ok: boolean; archivos: number }>;
      reiniciar: () => Promise<void>;
    };
  }
}

/** Botón de actualización automática: solo aparece en el programa de Windows. */
export function BotonActualizar() {
  const [estado, setEstado] = useState<"idle" | "buscando" | "listo" | "error">("idle");
  const [mensaje, setMensaje] = useState("");

  if (typeof window === "undefined" || !window.actualizar) return null;

  async function buscar() {
    setEstado("buscando");
    setMensaje("Buscando y descargando la versión nueva…");
    try {
      await window.actualizar!.buscar();
      setEstado("listo");
      setMensaje("Actualización descargada. Tocá Reiniciar para aplicarla.");
    } catch (e) {
      setEstado("error");
      const motivo = e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, "") : "";
      setMensaje(`No se pudo actualizar${motivo ? ` (${motivo})` : ""}. Revisá que la PC tenga internet y probá de nuevo.`);
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
