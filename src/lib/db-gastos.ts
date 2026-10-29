import type { Gasto } from "./gastos";

// Local on-device database for daily expenses (IndexedDB). Browser-only.
const DB = "gestion-gastos";
const STORE = "gastos";

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

export async function listarGastos(): Promise<Gasto[]> {
  navigator.storage?.persist?.().catch(() => {});
  const lista = (await tx<Gasto[]>("readonly", (s) => s.getAll())) ?? [];
  return lista.sort((a, b) => b.fecha.localeCompare(a.fecha));
}
export const guardarGastos = (lista: Gasto[]) => tx("readwrite", (s) => { lista.forEach((g) => s.put(g)); });
export const borrarGasto = (id: string) => tx("readwrite", (s) => s.delete(id));
