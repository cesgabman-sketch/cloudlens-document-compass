import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Check, ExternalLink, KeyRound, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/_authenticated/ajustes')({
  head: () => ({ meta: [
    { title: 'Lector inteligente con IA — Foto a Documento' },
    { name: 'description', content: 'Configurá una clave propia de Google Gemini para leer fotos en Foto a Documento.' },
    { property: 'og:title', content: 'Lector inteligente con IA — Foto a Documento' },
    { property: 'og:description', content: 'Elegí tu cuenta de Google o el lector estándar de Foto a Documento.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }),
  component: AjustesLector,
});

function AjustesLector() {
  const [disponible, setDisponible] = useState(false);
  const [configurado, setConfigurado] = useState(false);
  const [clave, setClave] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState(false);
  useEffect(() => {
    setDisponible(!!window.lectorIA);
    void window.lectorIA?.estado().then(e => setConfigurado(e.configurado)).catch(() => { setMensaje('No se pudo consultar la configuración de esta PC.'); setError(true); });
  }, []);
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!window.lectorIA || ocupado) return;
    setOcupado(true); setMensaje(''); setError(false);
    try {
      if (!navigator.onLine) throw new Error('Conectá la PC a internet para probar tu clave.');
      const resultado = await window.lectorIA.guardarProbar(clave);
      if (!resultado.ok) throw new Error(resultado.error ?? 'No se pudo verificar la clave.');
      setClave(''); setConfigurado(true); setMensaje('✓ Clave verificada con éxito y guardada en esta PC.');
    } catch (e) { setError(true); setMensaje(e instanceof Error ? e.message : 'No se pudo guardar la clave.'); }
    finally { setOcupado(false); }
  }
  async function borrar() {
    if (!window.lectorIA || !confirm('¿Borrar tu clave de Google de esta PC y volver al lector estándar?')) return;
    setOcupado(true);
    try { await window.lectorIA.borrar(); setConfigurado(false); setClave(''); setError(false); setMensaje('Clave borrada. Usando servidor estándar del sistema.'); }
    catch { setError(true); setMensaje('No se pudo borrar la clave.'); }
    finally { setOcupado(false); }
  }
  return <main className="mx-auto max-w-3xl space-y-6 p-6 text-foreground">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="flex items-center gap-2 text-2xl font-bold"><KeyRound />Lector inteligente con IA</h1>
      <Button asChild variant="outline"><Link to="/">Volver al inicio</Link></Button>
    </header>
    <p className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold ${configurado ? 'bg-tab-gastos text-tab-foreground' : 'bg-tab-cheques text-tab-foreground'}`}>
      {configurado && <Check size={16} />}{configurado ? 'Usando tu cuenta de Google' : 'Usando servidor estándar del sistema'}
    </p>
    {!disponible && <p role="status" className="border-l-4 border-primary bg-muted p-3 text-sm">Para guardar una clave protegida en tu PC, abrí la nueva versión del programa de Windows. En el navegador se usa el lector estándar.</p>}
    <section className="space-y-4 border-t pt-5">
      <h2 className="text-lg font-semibold">Configurar Google Gemini</h2>
      <ol className="space-y-4 text-sm">
        <li><strong>Paso 1:</strong> <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">Abrí Google AI Studio<ExternalLink size={14} /></a> en tu navegador.</li>
        <li><strong>Paso 2:</strong> Iniciá sesión con tu cuenta de Google y hacé clic en “Create API Key”.</li>
        <li><strong>Paso 3:</strong> Copiá la clave y pegala en el casillero de abajo.</li>
      </ol>
      <form onSubmit={guardar} className="space-y-3">
        <label className="block space-y-2 text-sm font-medium">Clave de Google Gemini
          <input type="password" autoComplete="off" aria-label="Clave de Google Gemini" placeholder="Pegá tu clave acá" value={clave} onChange={e => setClave(e.target.value)} disabled={!disponible || ocupado} className="w-full rounded-md border border-input bg-background px-3 py-2" />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={!disponible || ocupado || !clave.trim()}><Save />{ocupado ? 'Un momento…' : 'Guardar y probar'}</Button>
          <Button type="button" variant="outline" disabled={!configurado || ocupado} onClick={borrar}><Trash2 />Borrar clave</Button>
        </div>
      </form>
      {mensaje && <p role={error ? 'alert' : 'status'} className={`rounded-md bg-muted p-3 text-sm ${error ? 'text-destructive' : 'text-foreground'}`}>{mensaje}</p>}
      <p className="text-sm text-muted-foreground">Google ofrece un cupo gratuito según la cuenta, la región y el modelo. No se garantiza que todas las lecturas sean gratuitas. Se usa Gemini 3.5 Flash-Lite, que Google ofrece en el plan gratuito.</p>
      <p className="text-sm text-muted-foreground">Tu clave queda cifrada en esta PC y las fotos se envían directamente a Google. Si Google falla, no se usa automáticamente el servidor: podés reintentar o borrar la clave para volver al lector estándar.</p>
    </section>
  </main>;
}