// Desktop (Electron) build — run with VITE_DESKTOP=1 (and VITE_ASISTENTE_URL) in the env: static SPA shell so the app runs from the PC without a server.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
    spa: { enabled: true },
  },
});
