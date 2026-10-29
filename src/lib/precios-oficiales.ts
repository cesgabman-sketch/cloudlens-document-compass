import { PRODUCTO_OFICIAL, promediarPrecios, type Precios } from "./flota";

// Pure parsers for official fuel price sources (usable on server and in the desktop app).
export const CSV_OFICIAL =
  "http://datos.energia.gob.ar/dataset/1c181390-5045-475e-94dc-410429be4b17/resource/80ac25de-a44a-4445-9215-090cf55cfda5/download/precios-en-surtidor-resolucin-3142016.csv";

export interface ResultadoPrecios { precios: Partial<Precios>; estaciones: number; alcance: string; fuente: string }

export const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim(); // eslint-disable-line no-misleading-character-class

function partir(linea: string): string[] {
  const out: string[] = [];
  let cur = "", q = false;
  for (const ch of linea) {
    if (ch === '"') q = !q;
    else if (ch === "," && !q) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

/** Maps a product name from the CSV to the official product key, tolerating name variants. */
function clasificar(producto: string): string {
  const exacto = producto.trim();
  if (PRODUCTO_OFICIAL[exacto]) return exacto;
  const p = sinTildes(producto);
  if (/PREMIUM/.test(p)) return "Nafta (premium) de más de 95 Ron";
  if (/SUPER/.test(p)) return "Nafta (súper) entre 92 y 95 Ron";
  if (/GRADO 3/.test(p)) return "Gas Oil Grado 3";
  if (/GRADO 2|GAS ?OIL|DIESEL/.test(p)) return "Gas Oil Grado 2";
  return "";
}

interface FilaCSV { prov: string; loc: string; hor: string; producto: string; precio: number; dir: string; fecha: string }

/** Parses "1.234,56" (Argentine format) and "1234.56" alike. */
function parseNumero(s: string): number {
  const t = s.trim();
  return t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) : Number(t);
}

/** Días de antigüedad máxima de un precio respecto del más nuevo del archivo. */
export const DIAS_VIGENCIA = 60;

/**
 * The official file keeps one row per station/product/month and stations that stopped
 * reporting keep their old prices. Keep only each station's latest price and drop
 * prices much older than the newest one in the file, so stale values don't drag the average down.
 */
function soloVigentes(filas: FilaCSV[]): FilaCSV[] {
  const ultimo = new Map<string, FilaCSV>();
  for (const f of filas) {
    const k = `${f.prov}|${f.loc}|${f.dir}|${f.producto}|${f.hor}`;
    const prev = ultimo.get(k);
    if (!prev || f.fecha > prev.fecha) ultimo.set(k, f);
  }
  const res = [...ultimo.values()];
  const max = res.reduce((m, f) => (f.fecha > m ? f.fecha : m), "");
  if (!max) return res;
  const corte = new Date(new Date(max.slice(0, 10)).getTime() - DIAS_VIGENCIA * 864e5).toISOString().slice(0, 10);
  return res.filter((f) => !f.fecha || f.fecha.slice(0, 10) >= corte);
}

/**
 * Secretaría de Energía CSV → YPF average for province/city.
 * Falls back step by step: day schedule → any schedule → whole province,
 * so a zone with few stations or without "Diurno" rows still gets real prices.
 */
export function preciosDesdeCSV(csv: string, provincia: string, localidad: string): (ResultadoPrecios & { vigencia?: string | undefined }) | null {
  const prov = sinTildes(provincia), loc = sinTildes(localidad);
  const lineas = csv.replace(/^\uFEFF/, "").split(/\r?\n/);
  const cab = partir(lineas[0] ?? "").map((h) => h.trim().toLowerCase());
  const ix = (n: string) => cab.indexOf(n);
  const iProv = ix("provincia"), iLoc = ix("localidad"), iProd = ix("producto"), iHor = ix("tipohorario");
  const iPre = ix("precio"), iBan = ix("empresabandera"), iDir = ix("direccion"), iFec = ix("fecha_vigencia");
  const crudas: FilaCSV[] = [];
  for (const l of lineas.slice(1)) {
    if (!l) continue;
    const c = partir(l);
    if (!sinTildes(c[iBan] ?? "").startsWith("YPF")) continue;
    crudas.push({
      prov: sinTildes(c[iProv] ?? ""),
      loc: sinTildes(c[iLoc] ?? ""),
      hor: iHor >= 0 ? sinTildes(c[iHor] ?? "") : "",
      producto: clasificar(c[iProd] ?? ""),
      precio: parseNumero(c[iPre] ?? ""),
      dir: c[iDir] ?? "",
      fecha: iFec >= 0 ? (c[iFec] ?? "").trim() : "",
    });
  }
  const filas = soloVigentes(crudas);
  const nombre = (p: string, l: string) => `YPF ${l ? `${l}, ` : ""}${p || "TODO EL PAÍS"}`;
  const intentos: { p: string; l: string; diurno: boolean; nota: string }[] = [
    { p: prov, l: loc, diurno: true, nota: "" },
    { p: prov, l: loc, diurno: false, nota: " (horario diurno y nocturno)" },
    { p: prov, l: "", diurno: true, nota: " (toda la provincia)" },
    { p: prov, l: "", diurno: false, nota: " (toda la provincia)" },
  ];
  for (const t of intentos) {
    const sel = filas.filter((f) => (!t.p || f.prov === t.p) && (!t.l || f.loc.includes(t.l)) && (!t.diurno || f.hor.startsWith("DIURNO")));
    const precios = promediarPrecios(sel);
    if (Object.keys(precios).length) {
      const vigencia = sel.reduce((m, f) => (f.fecha > m ? f.fecha : m), "").slice(0, 10) || undefined;
      return { precios, estaciones: new Set(sel.map((f) => f.dir)).size, alcance: nombre(t.p, t.l) + t.nota, fuente: "Secretaría de Energía (oficial)", vigencia };
    }
  }
  return null;
}


const ARGLY_PRODUCTO: Record<string, string> = {
  "NAFTA SUPER": "Nafta (súper) entre 92 y 95 Ron",
  "NAFTA PREMIUM": "Nafta (premium) de más de 95 Ron",
  "GASOIL GRADO 2": "Gas Oil Grado 2",
  "GASOIL GRADO 3": "Gas Oil Grado 3",
};
export interface FilaArgly { empresa: string; localidad: string; direccion: string; combustible: string; precios: Record<string, number> }

/** Argly mirror rows → narrowest available scope: YPF city, YPF province, all brands city, all brands province. */
export function preciosDesdeArgly(filas: FilaArgly[], provincia: string, localidad: string): ResultadoPrecios | null {
  const loc = sinTildes(localidad), prov = sinTildes(provincia);
  const esYPF = (f: FilaArgly) => sinTildes(f.empresa).startsWith("YPF");
  const enLoc = (f: FilaArgly) => !loc || sinTildes(f.localidad).includes(loc);
  const intentos: [string, (f: FilaArgly) => boolean][] = [
    [`YPF ${loc ? `${loc}, ` : ""}${prov}`, (f) => esYPF(f) && enLoc(f)],
    [`YPF ${prov}`, esYPF],
    [`todas las marcas ${loc ? `${loc}, ` : ""}${prov} (no hay datos de YPF)`, enLoc],
    [`todas las marcas ${prov} (no hay datos de YPF)`, () => true],
  ];
  for (const [alcance, ok] of intentos) {
    const sel = filas.filter(ok);
    const precios = promediarPrecios(sel.map((f) => ({ producto: ARGLY_PRODUCTO[sinTildes(f.combustible)] ?? "", precio: f.precios["día"] ?? Object.values(f.precios)[0] ?? 0 })));
    if (Object.keys(precios).length) return { precios, estaciones: new Set(sel.map((f) => f.direccion)).size, alcance, fuente: "Secretaría de Energía vía Argly (copia pública)" };
  }
  return null;
}
