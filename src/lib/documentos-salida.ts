import { totalItem, type Documento } from "./documentos";
import { limpiarDocumento } from "./documentos-filtrado";

export const COLUMNAS_DOCUMENTO = ["Código", "Cantidad", "Detalle/descripción", "P/unitario (ARS)", "Total (ARS)"];

/** General data shown once, above the item table, in the same sheet/section. */
export function cabeceraDocumento(documento: Documento): [string, string][] {
  const d = limpiarDocumento(documento);
  return [
    ["Proveedor (emisor)", d.proveedor],
    ["CUIT del proveedor", d.cuitProveedor ?? ""],
    ["Cliente / Razón social", d.cliente ?? ""],
    ["CUIT del cliente", d.cuitCliente ?? ""],
    ["Comprobante", [d.tipo, d.numero].filter(Boolean).join(" ")],
    ["Fecha", d.fecha],
  ];
}

/** Item rows contain only line data; general data is never repeated per row. */
export function filasDocumento(documento: Documento) {
  const d = limpiarDocumento(documento);
  return d.items.map(i => [i.codigo, i.cantidad, i.descripcion, i.precioUnitario, totalItem(i)]);
}
