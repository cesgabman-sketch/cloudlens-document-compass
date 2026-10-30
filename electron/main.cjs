// Windows desktop shell: serves the static app build from app://cheques so
// IndexedDB data persists in the user's profile on the PC (works offline).
// Self-update: downloads the published web app into userData/web-cache and
// serves it from there when present, so "Actualizar programa" needs no reinstall.
const { app, BrowserWindow, protocol, net, shell, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const { pathToFileURL } = require("url");
const { assetsDeHtml } = require("./archivos-actualizacion.cjs");

const ROOT = path.join(__dirname, "..", "dist", "client");
const WEB_URL = "https://cloudlens-check-document.lovable.app/";
protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

app.setName("Foto a Documento");

// Unique hardware ID: hash of hostname + MAC addresses. Stable per PC, so a
// license activated here fails on any other machine.
function machineId() {
  const macs = Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && !i.internal && i.mac && i.mac !== "00:00:00:00:00:00")
    .map((i) => i.mac)
    .sort()
    .join("|");
  return crypto.createHash("sha256").update(os.hostname() + "|" + macs).digest("hex");
}

// Local activation state, protected with an HMAC keyed by the machine ID:
// copying the file to another PC makes the signature invalid.
const archivoLicencia = () => path.join(app.getPath("userData"), "licencia.json");
ipcMain.handle("licencia:machine-id", () => machineId());
ipcMain.handle("licencia:nombre-pc", () => os.hostname());
ipcMain.handle("licencia:leer", () => {
  try {
    const crudo = JSON.parse(fs.readFileSync(archivoLicencia(), "utf8"));
    const firma = crypto.createHmac("sha256", machineId()).update(JSON.stringify(crudo.datos)).digest("hex");
    if (firma !== crudo.firma) return null; // copiado a otra PC o modificado a mano
    return crudo.datos;
  } catch {
    return null;
  }
});
ipcMain.handle("licencia:guardar", (_e, datos) => {
  const firma = crypto.createHmac("sha256", machineId()).update(JSON.stringify(datos)).digest("hex");
  const destino = archivoLicencia();
  fs.writeFileSync(destino + ".tmp", JSON.stringify({ datos, firma }));
  fs.renameSync(destino + ".tmp", destino);
  return true;
});
ipcMain.handle("licencia:borrar", () => {
  fs.rmSync(archivoLicencia(), { force: true });
  return true;
});

// Updates come from the desktop SPA build published under /escritorio/ (never the
// SSR web pages, which can't run from app://). "web-cache" was the old, broken format.
const cacheDir = () => path.join(app.getPath("userData"), "escritorio-cache");
const cacheShell = () => path.join(cacheDir(), "_shell.html");
const cacheLista = () => path.join(cacheDir(), "archivos.json");
const URL_ESCRITORIO = WEB_URL + "escritorio/";

// A cached update is only valid if every file in its list was downloaded;
// otherwise the bundled build (which always works) is served.
function cacheValido() {
  try {
    if (!fs.existsSync(cacheShell()) || !fs.existsSync(cacheLista())) return false;
    const { archivos } = JSON.parse(fs.readFileSync(cacheLista(), "utf8"));
    return Array.isArray(archivos) && archivos.length > 0 && archivos.every((rel) => fs.existsSync(path.join(cacheDir(), rel)));
  } catch {
    return false;
  }
}
function borrarCache() {
  fs.rmSync(cacheDir(), { recursive: true, force: true });
}

// Serve cached (updated) files first, fall back to the bundled build.
// Missing files with an extension (js/css/ico...) get null -> 404, never the HTML shell.
function resolverArchivo(rel) {
  const bases = cacheValido() ? [cacheDir(), ROOT] : [ROOT];
  for (const base of bases) {
    const file = path.normalize(path.join(base, rel));
    if (file.startsWith(base) && fs.existsSync(file) && !fs.statSync(file).isDirectory()) return file;
  }
  if (path.extname(rel)) return null;
  return bases[0] === cacheDir() ? cacheShell() : path.join(ROOT, "_shell.html"); // SPA routes
}

// Daily rotating backups in Documents (survives deleting the app/profile folder).
const carpetaCopias = () => path.join(app.getPath("documents"), "Copias Foto a Documento");
const MAX_COPIAS = 30;
ipcMain.handle("respaldo:guardar", (_e, json) => {
  const dir = carpetaCopias();
  fs.mkdirSync(dir, { recursive: true });
  const d = new Date();
  const dia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const destino = path.join(dir, `foto-a-documento-${dia}.json`);
  fs.writeFileSync(destino + ".tmp", json);
  fs.renameSync(destino + ".tmp", destino);
  const viejas = fs.readdirSync(dir).filter((f) => /^foto-a-documento-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  viejas.slice(0, Math.max(0, viejas.length - MAX_COPIAS)).forEach((f) => fs.unlinkSync(path.join(dir, f)));
  return destino;
});
ipcMain.handle("respaldo:ultimo", () => {
  const dir = carpetaCopias();
  if (!fs.existsSync(dir)) return null;
  const f = fs.readdirSync(dir).filter((x) => /^foto-a-documento-\d{4}-\d{2}-\d{2}\.json$/.test(x)).sort().pop();
  return f ? fs.readFileSync(path.join(dir, f), "utf8") : null;
});

// Official fuel price CSV, fetched from the PC (reachable from Argentina; no browser CORS limits).
// The file is ~10 MB, so allow slow connections and try http and https before giving up.
const RUTA_CSV = "//datos.energia.gob.ar/dataset/1c181390-5045-475e-94dc-410429be4b17/resource/80ac25de-a44a-4445-9215-090cf55cfda5/download/precios-en-surtidor-resolucin-3142016.csv";
ipcMain.handle("precios:csv", async () => {
  let ultimo = "";
  for (const url of ["http:" + RUTA_CSV, "https:" + RUTA_CSV]) {
    try {
      const res = await net.fetch(url, { cache: "no-store", signal: AbortSignal.timeout(120000) });
      if (!res.ok) { ultimo = "el sitio respondió con error " + res.status; continue; }
      const txt = await res.text();
      if (!/empresabandera/i.test(txt.slice(0, 2000))) { ultimo = "el sitio devolvió una página en lugar del archivo de precios"; continue; }
      return txt;
    } catch (e) {
      ultimo = e && e.name === "TimeoutError" ? "el sitio tardó demasiado en responder" : String((e && e.message) || e);
    }
  }
  throw new Error(ultimo);
});

// Self-update from the published web app.
async function descargar(url) {
  let ultimo;
  for (let intento = 0; intento < 3; intento++) {
    try {
      const res = await net.fetch(url, { cache: "no-store", signal: AbortSignal.timeout(180000) });
      if (!res.ok) throw new Error("el sitio respondió con error " + res.status);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      ultimo = e;
      await new Promise((r) => setTimeout(r, 2000 * (intento + 1)));
    }
  }
  const nombre = url.split("/").pop();
  throw new Error("no se pudo descargar " + nombre + ": " + ((ultimo && ultimo.name === "TimeoutError") ? "tardó demasiado" : String((ultimo && ultimo.message) || ultimo)));
}
ipcMain.handle("actualizar:estado", () => ({ actualizado: cacheValido() }));
ipcMain.handle("actualizar:buscar", async () => {
  // Download into a temp folder and swap only when complete, so a failed
  // update never leaves a half-downloaded copy that breaks the app.
  const dir = cacheDir();
  const tmp = dir + ".tmp";
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  try {
    const lista = JSON.parse((await descargar(URL_ESCRITORIO + "archivos.json")).toString("utf8"));
    const archivos = Array.isArray(lista.archivos) ? lista.archivos.filter((r) => typeof r === "string" && /^assets\/[\w.\-]+$/.test(r)) : [];
    if (archivos.length === 0) throw new Error("No se encontraron archivos para descargar");
    const html = (await descargar(URL_ESCRITORIO + "programa.html")).toString("utf8");
    if (!/<html/i.test(html)) throw new Error("La página descargada no es válida");
    // Every file of the build, including screens loaded later (not only those in the page).
    for (const rel of archivos) {
      const buf = await descargar(URL_ESCRITORIO + rel);
      const destino = path.join(tmp, rel);
      fs.mkdirSync(path.dirname(destino), { recursive: true });
      fs.writeFileSync(destino, buf);
    }
    if (!assetsDeHtml(html).every((rel) => archivos.includes(rel))) throw new Error("Actualización incompleta");
    fs.writeFileSync(path.join(tmp, "archivos.json"), JSON.stringify({ archivos }), "utf8");
    fs.writeFileSync(path.join(tmp, "_shell.html"), html, "utf8");
    borrarCache();
    fs.renameSync(tmp, dir);
    return { ok: true, archivos: archivos.length };
  } catch (e) {
    fs.rmSync(tmp, { recursive: true, force: true });
    throw e;
  }
});
ipcMain.handle("actualizar:reiniciar", () => {
  app.relaunch();
  app.exit(0);
});

app.whenReady().then(() => {
  // Old updates (copied from the web pages) break the screens: discard them.
  fs.rmSync(path.join(app.getPath("userData"), "web-cache"), { recursive: true, force: true });
  fs.rmSync(path.join(app.getPath("userData"), "web-cache.tmp"), { recursive: true, force: true });
  protocol.handle("app", (req) => {
    const rel = decodeURIComponent(new URL(req.url).pathname);
    const file = resolverArchivo(rel);
    if (!file) return new Response("No encontrado", { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });

  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    title: "Foto a Documento",
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, "preload.cjs") },
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  win.loadURL("app://cheques/");
});

app.on("window-all-closed", () => app.quit());
