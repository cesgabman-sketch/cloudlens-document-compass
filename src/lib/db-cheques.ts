import type { Cheque } from "./cheques";

// Local on-device database (IndexedDB). Browser-only: call from effects/handlers.
const DB = "gestion-cheques";
const STORE = "cheques";
const LEGACY_KEY = "cheques-registrados";

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return abrir().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE, modo);
        const r = fn(t.objectStore(STORE));
        t.oncomplete = () => { resolve(r ? r.result : undefined); db.close(); };
        t.onerror = () => reject(t.error);
      }),
  );
}

export async function listarCheques(semilla: Cheque[]): Promise<Cheque[]> {
  navigator.storage?.persist?.().catch(() => {});
  let lista = (await tx<Cheque[]>("readonly", (s) => s.getAll())) ?? [];
  if (lista.length === 0) {
    const copia = await leerUltimaCopia();
    if (copia.length) {
      await tx("readwrite", (s) => { copia.forEach((c) => s.put(c)); });
      return copia.sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento));
    }
    const viejo = localStorage.getItem(LEGACY_KEY);
    const iniciales: Cheque[] = viejo ? JSON.parse(viejo) : semilla;
    await tx("readwrite", (s) => { iniciales.forEach((c) => s.put(c)); });
    localStorage.removeItem(LEGACY_KEY);
    lista = iniciales;
  }
  void respaldar();
  return lista.sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento));
}

export const guardarCheque = (c: Cheque) => tx("readwrite", (s) => s.put(c)).then(respaldar);
export const borrarCheque = (id: string) => tx("readwrite", (s) => s.delete(id)).then(respaldar);

/** Agrega o actualiza (por id) los cheques importados. */
export const importarCheques = (lista: Cheque[]) => tx("readwrite", (s) => { lista.forEach((c) => s.put(c)); }).then(respaldar);

// Automatic backups (desktop program only): a copy per day in Documents.
type Respaldo = { guardar: (json: string) => Promise<string>; ultimo: () => Promise<string | null> };
const api = (): Respaldo | undefined => (globalThis as { respaldo?: Respaldo }).respaldo;

async function respaldar() {
  const r = api();
  if (!r) return;
  try {
    const cheques = (await tx<Cheque[]>("readonly", (s) => s.getAll())) ?? [];
    await r.guardar(JSON.stringify({ tipo: "cheques", version: 1, exportado: new Date().toISOString(), cheques }, null, 2));
  } catch { /* backup must never block the app */ }
}

async function leerUltimaCopia(): Promise<Cheque[]> {
  try {
    const txt = await api()?.ultimo();
    const datos = txt ? JSON.parse(txt) : null;
    return Array.isArray(datos?.cheques) ? datos.cheques : [];
  } catch { return []; }
}
