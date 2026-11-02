import type { Documento } from './documentos';
import type { LecturaGasto } from '@/routes/api/leer-gastos';
import type { LecturaCheque } from '@/routes/api/leer-cheque';
import { baseIA } from './imagen';
import { supabase } from '@/integrations/supabase/client';

type ModoLectura = 'gastos' | 'documento' | 'cheque';
type ResultadoPuente = { ok: boolean; error?: string; retryable?: boolean; datos?: unknown };
declare global {
  interface Window {
    lectorIA?: {
      estado: () => Promise<{ configurado: boolean }>;
      guardarProbar: (clave: string) => Promise<ResultadoPuente>;
      borrar: () => Promise<ResultadoPuente>;
      leer: (datos: { imagen: string; modo: ModoLectura }) => Promise<ResultadoPuente>;
    };
  }
}
export class ErrorLectura extends Error {
  constructor(message: string, public retryable = false) { super(message); }
}
export function elegirLector(configurado: boolean): 'google' | 'servidor' { return configurado ? 'google' : 'servidor'; }
export function leerFotoIA(imagen: string, modo: 'gastos'): Promise<{ gastos: LecturaGasto[] }>;
export function leerFotoIA(imagen: string, modo: 'documento'): Promise<Omit<Documento, 'id'>>;
export function leerFotoIA(imagen: string, modo: 'cheque'): Promise<{ cheques: LecturaCheque[] }>;
export async function leerFotoIA(imagen: string, modo: ModoLectura): Promise<unknown> {
  if (!navigator.onLine) throw new ErrorLectura('Sin internet no se pueden leer fotos. Podés cargar los datos a mano.', true);
  const propio = window.lectorIA && (await window.lectorIA.estado()).configurado;
  if (elegirLector(!!propio) === 'google' && window.lectorIA) {
    const result = await window.lectorIA.leer({ imagen, modo });
    if (!result.ok) throw new ErrorLectura(result.error ?? 'No se pudo leer con Google.', result.retryable);
    return result.datos;
  }
  const { data: ses } = await supabase.auth.getSession();
  const token = ses.session?.access_token;
  let response;
  try {
    response = await fetch(`${baseIA()}/api/${modo === 'cheque' ? 'leer-cheque' : 'leer-gastos'}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ imagen, ...(modo === 'documento' ? { modo: 'documento' } : {}) }),
    });
  } catch { throw new ErrorLectura('No se pudo conectar con el lector. Revisá internet y reintentá.', true); }
  const datos = await response.json().catch(() => ({ error: 'El lector respondió con un error. Intentá de nuevo más tarde.' }));
  if (!response.ok) throw new ErrorLectura(datos.error ?? 'No se pudo leer la foto.', response.status === 429 || response.status >= 500);
  return datos;
}