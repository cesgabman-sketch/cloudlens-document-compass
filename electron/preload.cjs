// Exposes automatic backup, official fuel prices, self-update and license activation to the app.
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("respaldo", {
  guardar: (json) => ipcRenderer.invoke("respaldo:guardar", json),
  ultimo: () => ipcRenderer.invoke("respaldo:ultimo"),
});
contextBridge.exposeInMainWorld("preciosOficiales", {
  csv: () => ipcRenderer.invoke("precios:csv"),
});
contextBridge.exposeInMainWorld("actualizar", {
  estado: () => ipcRenderer.invoke("actualizar:estado"),
  buscar: () => ipcRenderer.invoke("actualizar:buscar"),
  reiniciar: () => ipcRenderer.invoke("actualizar:reiniciar"),
});
contextBridge.exposeInMainWorld("licencia", {
  machineId: () => ipcRenderer.invoke("licencia:machine-id"),
  nombrePc: () => ipcRenderer.invoke("licencia:nombre-pc"),
  leer: () => ipcRenderer.invoke("licencia:leer"),
  guardar: (datos) => ipcRenderer.invoke("licencia:guardar", datos),
  borrar: () => ipcRenderer.invoke("licencia:borrar"),
});
