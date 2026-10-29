// Exposes automatic backup, official fuel prices and self-update to the app.
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
