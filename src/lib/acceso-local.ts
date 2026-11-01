import { supabase } from '@/integrations/supabase/client';

export interface IdentidadLocal { userId: string; empresaId: string }
declare global {
  interface Window {
    accesoLocal?: { leer: () => Promise<IdentidadLocal | null>; guardar: (datos: IdentidadLocal) => Promise<boolean>; borrar: () => Promise<boolean> };
  }
}
export function permiteAccesoLocal(escritorio: boolean, sinConexion: boolean, identidad: IdentidadLocal | null): boolean {
  return escritorio && sinConexion && !!identidad?.userId && !!identidad.empresaId;
}
export async function accesoSinInternet(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.accesoLocal || navigator.onLine) return false;
  return permiteAccesoLocal(true, true, await window.accesoLocal.leer());
}
export async function recordarAcceso(empresaId: string, userId?: string): Promise<void> {
  if (!window.accesoLocal) return;
  const id = userId ?? (await supabase.auth.getUser()).data.user?.id;
  if (id) await window.accesoLocal.guardar({ userId: id, empresaId });
}
export async function verificarAcceso(): Promise<boolean> {
  if (await accesoSinInternet()) return true;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return false;
  if (window.accesoLocal) {
    const empresa = await supabase.rpc('mi_empresa_id');
    if (empresa.data && !empresa.error) await recordarAcceso(empresa.data, data.user.id);
  }
  return true;
}
export async function borrarAccesoLocal(): Promise<void> { await window.accesoLocal?.borrar(); }