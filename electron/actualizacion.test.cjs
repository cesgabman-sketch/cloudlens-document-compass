const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { assetsDeHtml } = require("./archivos-actualizacion.cjs");

test("recognizes desktop script and stylesheet references", () => {
  assert.deepEqual(assetsDeHtml('<html><link href="/assets/style-1.css"><script src="./assets/main-2.js"></script><link href="/favicon.ico"><script src="https://other.test/assets/remote.js"></script></html>'), ["assets/style-1.css", "assets/main-2.js"]);
});

function iniciar(fixtures) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cheques-update-test-"));
  const handlers = new Map();
  const electron = {
    app: { setName() {}, getPath: () => dir, whenReady: () => ({ then() {} }), on() {} },
    protocol: { registerSchemesAsPrivileged() {} },
    ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
    net: { fetch: async (url) => {
      const rel = url.split("/escritorio/")[1];
      if (!(rel in fixtures)) return new Response("missing", { status: 404 });
      return new Response(fixtures[rel]);
    } },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "main.cjs"), "utf8"), {
    require: (name) => name === "electron" ? electron : require(name),
    __dirname, Buffer, AbortSignal, Response, URL,
    setTimeout: (fn) => { fn(); return 0; },
  });
  return { dir, handlers };
}

test("downloads a complete update through the same handler used by Windows", async () => {
  const files = ["assets/main.js", "assets/gastos.js", "assets/styles.css"];
  const { dir, handlers } = iniciar({
    "archivos.json": JSON.stringify({ archivos: files }),
    "programa.html": '<html><link href="/assets/styles.css"><script src="/assets/main.js"></script></html>',
    "assets/main.js": "export const ok = true;",
    "assets/gastos.js": "export const gastos = true;",
    "assets/styles.css": "body {}",
  });
  try {
    const result = await handlers.get("actualizar:buscar")();
    assert.equal(result.ok, true);
    assert.equal(result.archivos, 3);
    assert.equal(handlers.get("actualizar:estado")().actualizado, true);
    assert.equal(fs.readFileSync(path.join(dir, "escritorio-cache/assets/gastos.js"), "utf8"), "export const gastos = true;");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("rejects an incomplete update without erasing the working cached version", async () => {
  const { dir, handlers } = iniciar({
    "archivos.json": JSON.stringify({ archivos: ["assets/main.js"] }),
    "programa.html": '<html><script src="/assets/missing.js"></script></html>',
    "assets/main.js": "new version",
  });
  const cache = path.join(dir, "escritorio-cache");
  fs.mkdirSync(path.join(cache, "assets"), { recursive: true });
  fs.writeFileSync(path.join(cache, "archivos.json"), JSON.stringify({ archivos: ["assets/old.js"] }));
  fs.writeFileSync(path.join(cache, "assets/old.js"), "working version");
  fs.writeFileSync(path.join(cache, "_shell.html"), "<html>working</html>");
  try {
    await assert.rejects(handlers.get("actualizar:buscar")(), /Actualización incompleta/);
    assert.equal(handlers.get("actualizar:estado")().actualizado, true);
    assert.equal(fs.existsSync(cache + ".tmp"), false);
    assert.equal(fs.readFileSync(path.join(cache, "assets/old.js"), "utf8"), "working version");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test("an update downloaded by another installation is not reused", () => {
  const { cacheEsDeEstePaquete, MARCA_PAQUETE } = require("./archivos-actualizacion.cjs");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cheques-paquete-test-"));
  assert.equal(cacheEsDeEstePaquete(dir, "nuevo"), false);
  fs.writeFileSync(path.join(dir, MARCA_PAQUETE), "viejo");
  assert.equal(cacheEsDeEstePaquete(dir, "nuevo"), false);
  fs.writeFileSync(path.join(dir, MARCA_PAQUETE), "nuevo");
  assert.equal(cacheEsDeEstePaquete(dir, "nuevo"), true);
});
