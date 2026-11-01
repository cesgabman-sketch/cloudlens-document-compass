import { describe, expect, it } from 'vitest';
import { permiteAccesoLocal } from './acceso-local';
describe('Acceso local sin internet', () => {
  const identidad = { userId: 'usuario-verificado', empresaId: 'empresa-verificada' };
  it('permite abrir Windows offline tras verificar empresa y usuario', () => { expect(permiteAccesoLocal(true, true, identidad)).toBe(true); });
  it('no habilita el navegador sin internet', () => { expect(permiteAccesoLocal(false, true, identidad)).toBe(false); });
  it('exige ingreso inicial verificado', () => { expect(permiteAccesoLocal(true, true, null)).toBe(false); });
  it('no omite la validación online cuando hay internet', () => { expect(permiteAccesoLocal(true, false, identidad)).toBe(false); });
});