// Public activation endpoint. The license key is the credential, not a cloud API key.
export const URL_PANEL_LICENCIAS = "https://cloudlens-check-document.lovable.app/api/public/licencia";
export const PROGRAMA_LICENCIA = "Foto a Documento";

export type RespuestaLicencia = {
  ok: boolean;
  motivo?: string;
  cliente?: string;
  vencimiento?: string | null;
};

export async function consultarLicenciaCentral(clave: string, machineId: string, nombrePc: string): Promise<RespuestaLicencia> {
  const response = await fetch(URL_PANEL_LICENCIAS, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clave, machineId, nombrePc, programa: PROGRAMA_LICENCIA }),
    signal: AbortSignal.timeout(20_000),
  });
  // Only explicit business denials bypass offline grace. HTTP failures and malformed
  // replies are unavailable service, never a successful or refreshed activation.
  if (response.status >= 500 || response.status === 429) throw new Error("Panel no disponible");
  const datos: unknown = await response.json();
  if (!datos || typeof datos !== "object" || !("ok" in datos) || typeof datos.ok !== "boolean") {
    throw new Error("Respuesta de licencia inválida");
  }
  if (!datos.ok) {
    if (!("motivo" in datos) || typeof datos.motivo !== "string") throw new Error("Respuesta de licencia inválida");
    return { ok: false, motivo: datos.motivo };
  }
  if (!response.ok || !("programa" in datos) || datos.programa !== PROGRAMA_LICENCIA || !("clave" in datos) || datos.clave !== clave) {
    return { ok: false, motivo: "Esta clave no corresponde a Foto a Documento." };
  }
  return { ok: true };
}

// Never try another authority for suspended, expired or full licenses, or network errors.
export function esClaveLocalInexistente(datos: RespuestaLicencia | null): boolean {
  return datos?.ok === false && datos.motivo === "La clave no existe. Revisala o pedila de nuevo.";
}