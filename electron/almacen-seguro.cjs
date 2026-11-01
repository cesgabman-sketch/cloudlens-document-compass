const fs = require('fs');
const path = require('path');
function crearAlmacenSeguro(safeStorage, carpeta) {
  const archivo = nombre => path.join(carpeta(), nombre + '.enc');
  const disponible = () => safeStorage?.isEncryptionAvailable() && safeStorage.getSelectedStorageBackend?.() !== 'basic_text';
  return {
    guardar(nombre, datos) {
      if (!disponible()) throw new Error('Windows no permite guardar la clave de forma segura en este equipo.');
      fs.mkdirSync(carpeta(), { recursive: true });
      const destino = archivo(nombre);
      fs.writeFileSync(destino + '.tmp', safeStorage.encryptString(JSON.stringify(datos)), { mode: 0o600 });
      fs.renameSync(destino + '.tmp', destino);
    },
    leer(nombre) {
      if (!disponible()) return null;
      try { return JSON.parse(safeStorage.decryptString(fs.readFileSync(archivo(nombre)))); } catch { return null; }
    },
    borrar(nombre) { fs.rmSync(archivo(nombre), { force: true }); },
  };
}
module.exports = { crearAlmacenSeguro };