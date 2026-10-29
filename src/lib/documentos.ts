export const TIPOS_DOCUMENTO = ["Remito", "Presupuesto", "Factura", "Ticket", "Nota manuscrita", "Otro"] as const;
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];
export interface ItemDocumento {
  codigo: string;
  cantidad: number | null;
  descripcion: string;
  precioUnitario: number | null;
  totalLeido: number | null;
  dudosos: string[];
}
export interface Documento {
  id: string;
  tipo: TipoDocumento;
  proveedor: string;
  cuitProveedor?: string;
  cliente?: string;
  cuitCliente?: string;
  numero: string;
  fecha: string;
  items: ItemDocumento[];
  camposDudosos: string[];
}
export const totalItem = (i: ItemDocumento): number | null =>
  i.cantidad === null || i.precioUnitario === null ? null : Math.round(i.cantidad * i.precioUnitario * 100) / 100;
export const difiereTotal = (i: ItemDocumento) => {
  const total = totalItem(i);
  return total !== null && i.totalLeido !== null && Math.abs(total - i.totalLeido) > 0.010001;
};
export const totalDocumento = (d: Documento) => d.items.reduce((s, i) => s + (totalItem(i) ?? 0), 0);
export const documentoValido = (d: Documento) =>
  (TIPOS_DOCUMENTO as readonly string[]).includes(d.tipo) && d.proveedor.trim() !== "" && /^\d{4}-\d{2}-\d{2}$/.test(d.fecha) && d.items.length > 0 &&
  d.items.every(i => i.descripcion.trim() !== "" && i.cantidad !== null && Number.isFinite(i.cantidad) && i.cantidad > 0 && (i.precioUnitario === null || (Number.isFinite(i.precioUnitario) && i.precioUnitario >= 0)));

/** Preserve string codes exactly, including leading zeros and letter case. */
export const cambiarItem = (item: ItemDocumento, campo: "codigo" | "cantidad" | "descripcion" | "precioUnitario", valor: string): ItemDocumento => ({
  ...item,
  [campo]: campo === "cantidad" || campo === "precioUnitario" ? (valor === "" ? null : Number(valor)) : valor,
  dudosos: item.dudosos.filter(c => c !== campo),
});