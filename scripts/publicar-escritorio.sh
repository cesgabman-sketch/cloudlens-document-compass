#!/usr/bin/env bash
# Builds the desktop SPA and copies it to public/escritorio so the published site
# serves it; the Windows program's "Actualizar programa" button downloads from there.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf public/escritorio
VITE_DESKTOP=1 VITE_ASISTENTE_URL=https://cloudlens-check-document.lovable.app npx vite build --config vite.desktop.config.ts
mkdir -p public/escritorio
cp -r dist/client/assets public/escritorio/assets
cp dist/client/_shell.html public/escritorio/programa.html
[ -f dist/client/favicon.ico ] && cp dist/client/favicon.ico public/escritorio/favicon.ico
(cd public/escritorio && find assets -type f | sort | node -e '
  const files = require("fs").readFileSync(0, "utf8").trim().split("\n");
  process.stdout.write(JSON.stringify({ version: Date.now(), archivos: files }, null, 1));
' > archivos.json)
echo "Listo: $(ls public/escritorio/assets | wc -l) archivos en public/escritorio"
