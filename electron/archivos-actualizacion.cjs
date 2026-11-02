const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Only local desktop assets are relevant when validating the SPA shell.
function assetsDeHtml(html) {
  const archivos = new Set();
  for (const match of html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
    const rel = match[1].replace(/^(?:\.\/|\/)/, "").split(/[?#]/)[0];
    if (/^assets\/[\w.\-]+$/.test(rel)) archivos.add(rel);
  }
  return [...archivos];
}

// Fingerprint of the build shipped inside the installed program.
function huellaArchivo(file) {
  try { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
  catch { return ""; }
}

// A downloaded update belongs to the installation that downloaded it. After
// installing a newer ZIP, an older cached update must not hide the new screens.
const MARCA_PAQUETE = "paquete.txt";
function cacheEsDeEstePaquete(dirCache, huella) {
  try { return fs.readFileSync(path.join(dirCache, MARCA_PAQUETE), "utf8").trim() === huella; }
  catch { return false; }
}

module.exports = { assetsDeHtml, huellaArchivo, cacheEsDeEstePaquete, MARCA_PAQUETE };
