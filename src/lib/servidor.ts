// Base URL for server endpoints (AI, prices). In the Windows program the page runs from
// app://cheques — including copies downloaded by "Actualizar programa", which come from the
// web build — so detect it at runtime and call the published app instead of a relative path.
export const URL_PUBLICADA = "https://cloudlens-check-document.lovable.app";

export function esEscritorio(): boolean {
  return import.meta.env["VITE_DESKTOP"] === "1" || (typeof location !== "undefined" && location.protocol === "app:");
}

export function baseServidor(): string {
  return esEscritorio() ? ((import.meta.env["VITE_ASISTENTE_URL"] as string | undefined) || URL_PUBLICADA) : "";
}
