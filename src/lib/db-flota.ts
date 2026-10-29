// Local on-device database for fuel usage records (IndexedDB). Browser-only.
export interface RegistroUso {
  id: string;
  fecha: string;
  unidad: string;
  medida: "km" | "horas";
  uso: number;
  litros: number;
  precio: number;
  costo: number;
}
const DB = "gestion-flota";
const STORE = "usos";

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function tx<T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return abrir().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, modo);
    const r = fn(t.objectStore(STORE));
    t.oncomplete = () => { resolve(r ? r.result : undefined); db.close(); };
    t.onerror = () => reject(t.error);
  }));
}
export const listarUsos = async () => ((await tx<RegistroUso[]>("readonly", (s) => s.getAll())) ?? []).sort((a, b) => b.fecha.localeCompare(a.fecha));
export const guardarUso = (r: RegistroUso) => tx("readwrite", (s) => s.put(r));
export const borrarUso = (id: string) => tx("readwrite", (s) => s.delete(id));
