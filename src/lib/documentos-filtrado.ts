import type { Documento } from "./documentos";

const normalizar = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
const controlInterno = /\b(?:PREPARADO\s+POR|CONTROLADO\s+POR|CLIENTE\s+CON\s+E\s*MAIL|FIRMA(?:S)?(?:\s+DEL)?(?:\s+CLIENTE|\s+RESPONSABLE)?|GARABATOS?|INICIALES|MARCA\s+DE\s+APROBACION)\b/;

/** Conservative text guard; visual signatures/approval marks are excluded by the reader. */
export function limpiarDocumento<T extends Omit<Documento, "id">>(documento: T): T {
  const limpiar = (texto: string) => texto.split(/\r?\n/).filter(linea => !controlInterno.test(normalizar(linea))).join("\n");
  const proveedor = limpiar(documento.proveedor);
  const cliente = limpiar(documento.cliente ?? "");
  const cuitProveedor = limpiar(documento.cuitProveedor ?? "");
  const cuitCliente = limpiar(documento.cuitCliente ?? "");
  const numero = limpiar(documento.numero);
  const fecha = limpiar(documento.fecha);
  const cabecera = new Set([proveedor, cliente, cuitProveedor, cuitCliente, numero, fecha, documento.tipo].filter(Boolean).map(normalizar));
  const esCabecera = (linea: string) => {
    const texto = normalizar(linea);
    return cabecera.has(texto) || cabecera.has(texto.replace(/^(?:PROVEEDOR|EMISOR|CLIENTE|RECEPTOR|RAZON SOCIAL|CUIT(?: DEL PROVEEDOR| DEL CLIENTE)?|NUMERO|FECHA|TIPO DE COMPROBANTE)\s+/, ""));
  };
  return {
    ...documento, proveedor, cliente, cuitProveedor, cuitCliente, numero, fecha,
    camposDudosos: documento.camposDudosos.filter(c => ["tipo", "proveedor", "cliente", "cuitProveedor", "cuitCliente", "numero", "fecha"].includes(c)),
    items: documento.items.flatMap(item => {
      const descripcion = limpiar(item.descripcion).split(/\r?\n/).filter(linea => !esCabecera(linea)).join("\n");
      if (!descripcion.trim() && item.descripcion.trim()) return [];
      return [{ codigo: limpiar(item.codigo), cantidad: item.cantidad, descripcion,
        precioUnitario: item.precioUnitario, totalLeido: item.totalLeido,
        dudosos: item.dudosos.filter(c => ["codigo", "cantidad", "descripcion", "precioUnitario", "totalLeido"].includes(c)) }];
    }),
  };
}