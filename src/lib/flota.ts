export type Combustible = "nafta_super" | "nafta_premium" | "gasoil_g2" | "gasoil_g3";
export const COMBUSTIBLES: Record<Combustible, string> = {
  nafta_super: "Nafta Súper",
  nafta_premium: "Nafta Infinia (premium)",
  gasoil_g2: "Diésel 500 (grado 2)",
  gasoil_g3: "Infinia Diésel (grado 3)",
};

/** Official product names in the Secretaría de Energía dataset. */
export const PRODUCTO_OFICIAL: Record<string, Combustible> = {
  "Nafta (súper) entre 92 y 95 Ron": "nafta_super",
  "Nafta (premium) de más de 95 Ron": "nafta_premium",
  "Gas Oil Grado 2": "gasoil_g2",
  "Gas Oil Grado 3": "gasoil_g3",
};

export type Medida = "km" | "horas";
export interface Unidad {
  id: string;
  nombre: string;
  combustible: Combustible;
  medida: Medida;
  /** Litros cada 100 km (vehículos) o litros por hora (maquinaria). Valores de referencia, editables. */
  consumo: number;
}

// Reference consumptions (estimates, user can adjust).
export const UNIDADES: Unidad[] = [
  { id: "hilux-24", nombre: "Toyota Hilux 2.4 TDI", combustible: "gasoil_g2", medida: "km", consumo: 9.5 },
  { id: "hilux-28", nombre: "Toyota Hilux 2.8 TDI", combustible: "gasoil_g2", medida: "km", consumo: 10.5 },
  { id: "hilux-27n", nombre: "Toyota Hilux 2.7 nafta", combustible: "nafta_super", medida: "km", consumo: 13 },
  { id: "kangoo-16", nombre: "Renault Kangoo 1.6 nafta", combustible: "nafta_super", medida: "km", consumo: 8.5 },
  { id: "berlingo-16n", nombre: "Citroën Berlingo 1.6 nafta", combustible: "nafta_super", medida: "km", consumo: 8.8 },
  { id: "berlingo-16hdi", nombre: "Citroën Berlingo 1.6 HDi diésel", combustible: "gasoil_g2", medida: "km", consumo: 6.5 },
  { id: "amarok-20", nombre: "VW Amarok 2.0 TDI", combustible: "gasoil_g2", medida: "km", consumo: 9.5 },
  { id: "amarok-v6", nombre: "VW Amarok 3.0 V6 TDI", combustible: "gasoil_g3", medida: "km", consumo: 11 },
  { id: "retro", nombre: "Retroexcavadora", combustible: "gasoil_g2", medida: "horas", consumo: 8 },
  { id: "pala", nombre: "Pala cargadora", combustible: "gasoil_g2", medida: "horas", consumo: 14 },
  { id: "ford-cargo", nombre: "Camión Ford Cargo (mediano)", combustible: "gasoil_g2", medida: "km", consumo: 22 },
  { id: "mb-accelo", nombre: "Camión Mercedes-Benz Accelo (mediano)", combustible: "gasoil_g2", medida: "km", consumo: 20 },
];

/** Litros consumidos para un uso (km recorridos u horas de trabajo). */
export const litros = (u: Pick<Unidad, "medida" | "consumo">, uso: number) =>
  u.medida === "km" ? (uso * u.consumo) / 100 : uso * u.consumo;

export const costo = (u: Pick<Unidad, "medida" | "consumo">, uso: number, precio: number) => litros(u, uso) * precio;

export type Precios = Record<Combustible, number>;

/** Promedia precios (diurnos) de filas oficiales ya filtradas. */
export function promediarPrecios(filas: { producto: string; precio: number }[]): Partial<Precios> {
  const acc: Partial<Record<Combustible, number[]>> = {};
  for (const f of filas) {
    const c = PRODUCTO_OFICIAL[f.producto];
    if (c && f.precio > 0) (acc[c] ??= []).push(f.precio);
  }
  const r: Partial<Precios> = {};
  for (const [c, v] of Object.entries(acc) as [Combustible, number[]][]) r[c] = Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 100) / 100;
  return r;
}
