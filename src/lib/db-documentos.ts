import type { Documento } from "./documentos";

function ejecutar<T>(modo: IDBTransactionMode, accion: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("gestion-documentos", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("documentos", { keyPath: "id" });
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction("documentos", modo);
      const resultado = accion(tx.objectStore("documentos"));
      tx.oncomplete = () => { db.close(); resolve(resultado.result); };
      tx.onabort = () => { db.close(); reject(tx.error ?? new Error("No se pudo guardar el documento.")); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  });
}
export const listarDocumentos = async () => (await ejecutar<Documento[]>("readonly", s => s.getAll())).sort((a, b) => b.fecha.localeCompare(a.fecha));
export const guardarDocumento = (d: Documento) => ejecutar("readwrite", s => s.put(d));
export const borrarDocumento = (id: string) => ejecutar("readwrite", s => s.delete(id));