import { baseServidor } from "./servidor";

/** Achica la foto (máx. 1600 px) para enviarla más rápido. Browser-only. */
export function achicarImagen(file: File, max = 1600): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      const contexto = c.getContext("2d");
      if (!contexto) { URL.revokeObjectURL(img.src); reject(new Error("No se pudo preparar la foto.")); return; }
      contexto.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(img.src); reject(new Error("No se pudo abrir la foto.")); };
    img.src = URL.createObjectURL(file);
  });
}

/** Base URL for AI calls (desktop program calls the published web app). */
export function baseIA(): string {
  return baseServidor();
}
