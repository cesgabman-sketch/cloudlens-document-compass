import type { Semaforo } from "@/lib/cheques";

const ESTILO: Record<Semaforo, { punto: string; texto: string }> = {
  rojo: { punto: "bg-semaforo-rojo", texto: "Vencido / hoy" },
  amarillo: { punto: "bg-semaforo-amarillo", texto: "Vence en 1–7 días" },
  verde: { punto: "bg-semaforo-verde", texto: "Más de 7 días" },
  cerrado: { punto: "bg-muted-foreground/40", texto: "Cerrado" },
};

export function SemaforoBadge({ valor, dias }: { valor: Semaforo; dias?: number }) {
  const e = ESTILO[valor];
  const detalle =
    valor === "cerrado" || dias === undefined ? e.texto : dias < 0 ? `Vencido hace ${-dias} d` : dias === 0 ? "Vence hoy" : `En ${dias} d`;
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className={`h-3 w-3 rounded-full ${e.punto}`} aria-hidden />
      <span className="text-xs">{detalle}</span>
    </span>
  );
}

export function hoyLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
