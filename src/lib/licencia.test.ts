import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { activarLicencia, verificarLicencia, debeRevalidar, dentroDeGraciaOffline, DIAS_GRACIA_OFFLINE, HORAS_ENTRE_VALIDACIONES, type EstadoLicencia } from "./licencia";
import { URL_PANEL_LICENCIAS } from "./licencia-central";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

const estado = (haceHoras: number): EstadoLicencia => ({
  clave: "LIC-AAAA-BBBB",
  cliente: "Cliente de prueba",
  vencimiento: null,
  ultimaValidacion: new Date(Date.now() - haceHoras * 3_600_000).toISOString(),
});

describe("conexión al panel único", () => {
  const machineId = "0123456789abcdef0123456789abcdef";
  let guardada: EstadoLicencia | null;
  const peticion = vi.fn();
  const respuesta = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  beforeEach(() => {
    guardada = null;
    rpc.mockReset();
    peticion.mockReset();
    vi.stubGlobal("fetch", peticion);
    window.licencia = {
      machineId: async () => machineId,
      nombrePc: async () => "PC del cliente",
      leer: async () => guardada,
      guardar: async (datos) => { guardada = datos; return true; },
      borrar: async () => true,
    };
  });
  afterEach(() => { delete window.licencia; vi.unstubAllGlobals(); });

  it("activa una clave del panel enviando Foto a Documento y la misma PC, sin mail", async () => {
    rpc.mockResolvedValue({ data: { ok: false, motivo: "La clave no existe. Revisala o pedila de nuevo." }, error: null });
    peticion.mockResolvedValue(respuesta({ ok: true, clave: "LIC-AAAA-BBBB", programa: "Foto a Documento" }));
    expect((await activarLicencia(" lic-aaaa-bbbb ")).ok).toBe(true);
    expect(peticion).toHaveBeenCalledWith(URL_PANEL_LICENCIAS, expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ clave: "LIC-AAAA-BBBB", machineId, nombrePc: "PC del cliente", programa: "Foto a Documento" }),
    }));
    expect(guardada).toMatchObject({ clave: "LIC-AAAA-BBBB", origen: "central" });
  });

  it("conserva una licencia local y no la registra en el panel central", async () => {
    rpc.mockResolvedValue({ data: { ok: true, cliente: "Cliente anterior", vencimiento: "2027-12-31" }, error: null });
    expect((await activarLicencia("LIC-AAAA-BBBB")).ok).toBe(true);
    expect(guardada).toMatchObject({ origen: "local", cliente: "Cliente anterior", vencimiento: "2027-12-31" });
    expect(peticion).not.toHaveBeenCalled();
  });

  it.each(["Esta licencia está suspendida.", "La licencia venció.", "Se superó el límite de equipos autorizados."])("no evita una restricción local: %s", async (motivo) => {
    rpc.mockResolvedValue({ data: { ok: false, motivo }, error: null });
    expect(await activarLicencia("LIC-AAAA-BBBB")).toEqual({ ok: false, motivo });
    expect(peticion).not.toHaveBeenCalled();
  });

  it("una clave de otro ERP no activa ni guarda un permiso", async () => {
    rpc.mockResolvedValue({ data: { ok: false, motivo: "La clave no existe. Revisala o pedila de nuevo." }, error: null });
    peticion.mockResolvedValue(respuesta({ ok: false, motivo: "Esta clave corresponde a otro programa." }, 403));
    expect((await activarLicencia("LIC-AAAA-BBBB")).ok).toBe(false);
    expect(guardada).toBeNull();
  });

  it("rechaza incluso una respuesta exitosa con programa incorrecto", async () => {
    rpc.mockResolvedValue({ data: { ok: false, motivo: "La clave no existe. Revisala o pedila de nuevo." }, error: null });
    peticion.mockResolvedValue(respuesta({ ok: true, clave: "LIC-AAAA-BBBB", programa: "Gestión de Cheques" }));
    expect((await activarLicencia("LIC-AAAA-BBBB")).ok).toBe(false);
    expect(guardada).toBeNull();
  });

  it("revalida una licencia central únicamente con el panel que la emitió", async () => {
    guardada = { ...estado(13), origen: "central" };
    peticion.mockResolvedValue(respuesta({ ok: true, clave: "LIC-AAAA-BBBB", programa: "Foto a Documento" }));
    expect((await verificarLicencia()).acceso).toBe(true);
    expect(rpc).not.toHaveBeenCalled();
    expect(guardada?.origen).toBe("central");
    expect(debeRevalidar(guardada ?? estado(13), new Date())).toBe(false);
  });

  it("una suspensión central bloquea aunque aún esté dentro de los 7 días", async () => {
    guardada = { ...estado(13), origen: "central" };
    peticion.mockResolvedValue(respuesta({ ok: false, motivo: "La licencia está suspendida." }, 403));
    expect(await verificarLicencia()).toEqual({ acceso: false, motivo: "La licencia está suspendida." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("una caída del panel conserva acceso dentro de 7 días sin renovar la fecha", async () => {
    guardada = { ...estado(6 * 24), origen: "central" };
    const anterior = guardada.ultimaValidacion;
    peticion.mockResolvedValue(respuesta({ ok: false }, 503));
    expect((await verificarLicencia()).acceso).toBe(true);
    expect(guardada.ultimaValidacion).toBe(anterior);
  });

  it("una caída del panel bloquea pasados los 7 días", async () => {
    guardada = { ...estado(8 * 24), origen: "central" };
    peticion.mockRejectedValue(new Error("offline"));
    expect((await verificarLicencia()).acceso).toBe(false);
  });

  it("las licencias instaladas antes de esta conexión siguen validándose localmente", async () => {
    guardada = estado(13);
    rpc.mockResolvedValue({ data: { ok: true, cliente: "Cliente anterior" }, error: null });
    expect((await verificarLicencia()).acceso).toBe(true);
    expect(rpc).toHaveBeenCalledWith("estado_licencia", { _clave: "LIC-AAAA-BBBB", _machine_id: machineId });
    expect(peticion).not.toHaveBeenCalled();
  });
});

describe("licencia", () => {
  it("revalida solo después de las horas configuradas", () => {
    expect(debeRevalidar(estado(HORAS_ENTRE_VALIDACIONES - 1), new Date())).toBe(false);
    expect(debeRevalidar(estado(HORAS_ENTRE_VALIDACIONES + 1), new Date())).toBe(true);
  });

  it("el período de gracia offline dura los días configurados", () => {
    expect(dentroDeGraciaOffline(estado(24 * (DIAS_GRACIA_OFFLINE - 1)), new Date())).toBe(true);
    expect(dentroDeGraciaOffline(estado(24 * (DIAS_GRACIA_OFFLINE + 1)), new Date())).toBe(false);
  });

  it("los límites son 12 horas entre validaciones y 7 días de gracia", () => {
    expect(HORAS_ENTRE_VALIDACIONES).toBe(12);
    expect(DIAS_GRACIA_OFFLINE).toBe(7);
  });
});
