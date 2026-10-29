// Only local desktop assets are relevant when validating the SPA shell.
function assetsDeHtml(html) {
  const archivos = new Set();
  for (const match of html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
    const rel = match[1].replace(/^(?:\.\/|\/)/, "").split(/[?#]/)[0];
    if (/^assets\/[\w.\-]+$/.test(rel)) archivos.add(rel);
  }
  return [...archivos];
}

module.exports = { assetsDeHtml };