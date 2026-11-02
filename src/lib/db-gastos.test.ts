import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { guardarGastos, listarGastos } from "./db-gastos";
import type { Gasto } from "./gastos";

const gasto: Gasto = { id: "foto-1", fecha: "2026-10-15", concepto: "Ferretería", monto: 1500, categoria: "Ferretería", origen: "foto" };

describe("guardado local de fotos", () => {
  beforeEach(() => { vi.stubGlobal("indexedDB", new IDBFactory()); });
  it("conserva los renglones después de cerrar y reabrir la base", async () => {
    await guardarGastos([gasto, { ...gasto, id: "foto-2", monto: 500 }]);
    expect(await listarGastos()).toEqual([gasto, { ...gasto, id: "foto-2", monto: 500 }]);
    expect(await listarGastos()).toHaveLength(2);
  });
  it("rechaza una escritura inválida sin guardar una parte de la foto", async () => {
    await expect(guardarGastos([gasto, { ...gasto, id: undefined } as unknown as Gasto])).rejects.toBeDefined();
    expect(await listarGastos()).toEqual([]);
    await guardarGastos([gasto]);
    expect(await listarGastos()).toEqual([gasto]);
  });
});