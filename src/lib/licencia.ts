// Licenciamiento por equipo (node-locking) para el programa de Windows.
// La clave se valida contra la nube; el estado queda guardado en la PC firmado
// con el identificador del hardware (ver electron/main.cjs), así una copia del
// programa en otra máquina no pasa la verificación.
import { supabase } from "@/integrations/supabase/client";

export interface EstadoLicencia {
  clave: string;
  cliente: string;
  vencimiento: string | null;
  ultimaValidacion: string; // ISO
}

export const DIAS_GRACIA_OFFLINE = 7;
export const HORAS_ENTRE_VALIDACIONES = 12;

declare global {
  interface Window {
    licencia?: {
      machineId: () => Promise<string>;
      nombrePc: () => Promise<string>;
      leer: () => Promise<EstadoLicencia | null>;
      guardar: (datos: EstadoLicencia) => Promise<boolean>;
      borrar: () => Promise<boolean>;
    };
  }
}

export function licenciaDisponible(): boolean {
  return typeof window !== "undefined" && !!window.licencia;
}

/** ¿Pasó el tiempo suficiente desde la última validación online como para revalidar? */
export function debeRevalidar(estado: EstadoLicencia, ahora: Date): boolean {
  const horas = (ahora.getTime() - new Date(estado.ultimaValidacion).getTime()) / 3_600_000;
  return horas >= HORAS_ENTRE_VALIDACIONES;
}

/** Sin internet, el programa sigue abriendo durante el período de gracia. */
export function dentroDeGraciaOffline(estado: EstadoLicencia, ahora: Date): boolean {
  const dias = (ahora.getTime() - new Date(estado.ultimaValidacion).getTime()) / 86_400_000;
  return dias <= DIAS_GRACIA_OFFLINE;
}

export type ResultadoLicencia =
  | { acceso: true; estado: EstadoLicencia }
  | { acceso: false; motivo: string; activar?: boolean };

/** Verifica la licencia guardada: revalida online si corresponde, con gracia offline. */
export async function verificarLicencia(): Promise<ResultadoLicencia> {
  if (!window.licencia) return { acceso: false, motivo: "Solo disponible en el programa de Windows." };
  const estado = await window.licencia.leer();
  if (!estado || !estado.clave) return { acceso: false, motivo: "", activar: true };
  if (!debeRevalidar(estado, new Date())) return { acceso: true, estado };
  try {
    const machineId = await window.licencia.machineId();
    const { data, error } = await supabase.rpc("estado_licencia", { _clave: estado.clave, _machine_id: machineId });
    if (error) throw error;
    if (data && (data as { ok?: boolean }).ok) {
      const d = data as { cliente?: string; vencimiento?: string | null };
      const nuevo: EstadoLicencia = {
        ...estado,
        cliente: d.cliente ?? estado.cliente,
        vencimiento: d.vencimiento ?? null,
        ultimaValidacion: new Date().toISOString(),
      };
      await window.licencia.guardar(nuevo);
      return { acceso: true, estado: nuevo };
    }
    return { acceso: false, motivo: ((data as { motivo?: string })?.motivo) || "La licencia ya no es válida." };
  } catch {
    if (dentroDeGraciaOffline(estado, new Date())) return { acceso: true, estado };
    return {
      acceso: false,
      motivo: `Hace más de ${DIAS_GRACIA_OFFLINE} días que el programa no se conecta a internet. Conectá la PC una vez para seguir usándolo.`,
    };
  }
}

/** Activa la clave en esta PC (la registra en la nube si queda cupo). */
export async function activarLicencia(clave: string): Promise<{ ok: boolean; motivo?: string; estado?: EstadoLicencia }> {
  if (!window.licencia) return { ok: false, motivo: "Solo disponible en el programa de Windows." };
  const limpia = clave.toUpperCase().trim();
  if (!limpia) return { ok: false, motivo: "Escribí la clave de licencia." };
  try {
    const machineId = await window.licencia.machineId();
    const nombrePc = await window.licencia.nombrePc();
    const { data, error } = await supabase.rpc("activar_licencia", { _clave: limpia, _machine_id: machineId, _nombre_pc: nombrePc });
    if (error) throw error;
    const d = data as { ok?: boolean; motivo?: string; cliente?: string; vencimiento?: string | null };
    if (!d?.ok) return { ok: false, motivo: d?.motivo || "No se pudo activar la licencia." };
    const estado: EstadoLicencia = {
      clave: limpia,
      cliente: d.cliente ?? "",
      vencimiento: d.vencimiento ?? null,
      ultimaValidacion: new Date().toISOString(),
    };
    await window.licencia.guardar(estado);
    return { ok: true, estado };
  } catch {
    return { ok: false, motivo: "No hay conexión a internet. La activación necesita internet una sola vez." };
  }
}

export async function desactivarLicencia(): Promise<void> {
  await window.licencia?.borrar();
}
