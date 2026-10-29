import { useEffect, useRef, useState } from "react";

export interface Empresa {
  nombre: string;
  cuit: string;
  direccion: string;
  telefono: string;
  email: string;
  logo: string; // data URL
}

const CLAVE = "datos-empresa";
const VACIA: Empresa = { nombre: "", cuit: "", direccion: "", telefono: "", email: "", logo: "" };

export function leerEmpresa(): Empresa {
  try {
    return { ...VACIA, ...JSON.parse(localStorage.getItem(CLAVE) || "{}") };
  } catch {
    return VACIA;
  }
}

function achicarLogo(file: File): Promise<string> {
  return new Promise((ok, mal) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 300 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = img.width * k;
      c.height = img.height * k;
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      ok(c.toDataURL("image/png"));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = mal;
    img.src = URL.createObjectURL(file);
  });
}

/** Company header with logo; editable form saved on this PC. */
export function DatosEmpresa() {
  const [empresa, setEmpresa] = useState<Empresa>(VACIA);
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState<Empresa>(VACIA);
  const archivo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const e = leerEmpresa();
    setEmpresa(e);
    if (!e.nombre) { setBorrador(e); setEditando(true); }
  }, []);

  function guardar() {
    localStorage.setItem(CLAVE, JSON.stringify(borrador));
    setEmpresa(borrador);
    setEditando(false);
  }

  async function elegirLogo(ev: React.ChangeEvent<HTMLInputElement>) {
    const f = ev.target.files?.[0];
    ev.target.value = "";
    if (f) setBorrador({ ...borrador, logo: await achicarLogo(f) });
  }

  const campo = (k: keyof Omit<Empresa, "logo">, etiqueta: string, ph = "") => (
    <label className="flex flex-col gap-1 text-sm">
      {etiqueta}
      <input value={borrador[k]} placeholder={ph} onChange={(e) => setBorrador({ ...borrador, [k]: e.target.value })} className="rounded-md border bg-background px-2 py-1" />
    </label>
  );

  if (editando)
    return (
      <section className="space-y-3 rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="text-xl font-semibold">Datos de la empresa u organización</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {campo("nombre", "Nombre o razón social", "Ej: Transportes del Norte SRL")}
          {campo("cuit", "CUIT", "30-12345678-9")}
          {campo("direccion", "Dirección")}
          {campo("telefono", "Teléfono")}
          {campo("email", "Email")}
          <div className="flex items-center gap-3 text-sm">
            {borrador.logo && <img src={borrador.logo} alt="Logo" className="h-14 w-14 rounded object-contain" />}
            <button onClick={() => archivo.current?.click()} className="rounded-md border px-3 py-2">🖼️ {borrador.logo ? "Cambiar logo" : "Cargar logo"}</button>
            {borrador.logo && <button onClick={() => setBorrador({ ...borrador, logo: "" })} className="text-destructive underline">Quitar</button>}
            <input ref={archivo} type="file" accept="image/*" className="hidden" onChange={elegirLogo} />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={guardar} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Guardar datos</button>
          {empresa.nombre && <button onClick={() => setEditando(false)} className="rounded-md border px-4 py-2 text-sm">Cancelar</button>}
        </div>
      </section>
    );

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4 shadow-sm">
      {empresa.logo && <img src={empresa.logo} alt={`Logo de ${empresa.nombre}`} className="h-16 w-16 rounded object-contain" />}
      <div className="flex-1">
        <p className="text-2xl font-bold">{empresa.nombre}</p>
        <p className="text-sm text-muted-foreground">
          {[empresa.cuit && `CUIT ${empresa.cuit}`, empresa.direccion, empresa.telefono, empresa.email].filter(Boolean).join(" · ")}
        </p>
      </div>
      <button onClick={() => { setBorrador(empresa); setEditando(true); }} className="rounded-md border px-3 py-2 text-sm">✏️ Editar datos</button>
    </div>
  );
}
