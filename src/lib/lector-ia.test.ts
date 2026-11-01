import { afterEach, describe, expect, it, vi } from 'vitest';
import { elegirLector, leerFotoIA } from './lector-ia';
describe('Prioridad de lector', () => {
  afterEach(() => { delete window.lectorIA; vi.restoreAllMocks(); });
  it('sin clave propia usa servidor', () => { expect(elegirLector(false)).toBe('servidor'); });
  it('con clave propia usa Google', () => { expect(elegirLector(true)).toBe('google'); });
  it('no usa el servidor al fallar Google por cuota', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    window.lectorIA = { estado: async () => ({ configurado: true }), leer: async () => ({ ok: false, error: 'Cuota Google', retryable: true }), guardarProbar: async () => ({ ok: true }), borrar: async () => ({ ok: true }) };
    const fetcher = vi.spyOn(globalThis, 'fetch');
    await expect(leerFotoIA('data:image/jpeg;base64,AA==', 'gastos')).rejects.toMatchObject({ message: 'Cuota Google', retryable: true });
    expect(fetcher).not.toHaveBeenCalled();
  });
});