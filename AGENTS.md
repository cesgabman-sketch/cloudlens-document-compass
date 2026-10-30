<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Desktop (Windows) build
- Desktop program = Electron shell (`electron/main.cjs`) serving a static SPA build from `vite.desktop.config.ts` via `app://cheques`; package from a clean /tmp staging dir with `@electron/packager`, never change root `package.json` main. Why: SSR web app can't run from file://, and staging keeps the web deploy untouched.
- Desktop assistant calls the published web app's `/api/consulta-cheques` (base URL from `VITE_ASISTENTE_URL` at desktop build time; CORS allows `app://cheques`). Why: the AI key must stay server-side.
- Desktop self-update downloads the desktop SPA build from `public/escritorio/` (programa.html + archivos.json list), regenerated with `scripts/publicar-escritorio.sh` before every publish that should reach the PCs. Why: the published SSR pages can't hydrate from app://, and lazy route chunks aren't referenced by the HTML.
- Validate desktop shell asset references with the shared CommonJS helper and test the Electron update handler with mocked downloads; retain a working cache until the replacement is validated. Why: updater failures must not erase a working installation.

## Expense documents
- Foto a Documento keeps one protected route per app screen and a public `/auth` page; the protected index is the only `/` route. Why: duplicate public/protected paths prevent route generation.
- Session identity changes invalidate the router once at the root; sign-out cancels and clears queries before clearing the session. Why: protected cached views must not survive sign-out.
- Remitos and budgets use a separate on-device IndexedDB store and a dedicated review component within the expenses page; they never become expenses automatically. Why: commercial documents are not necessarily paid expenses.
- Preserve the photo's original line total alongside the calculated total; validate before saving/exporting. Why: editing must not erase evidence of a mismatch.
- Excel exports dynamically import ExcelJS in the browser and write textual codes and quantity-times-price formulas with cached results. Why: offline exports preserve identifiers and remain editable without putting Excel code in server handlers.
- Use the shared document filter after AI extraction and at every export boundary; leave visual signature recognition to the image reader. Why: deterministic guards also protect older saved documents without guessing from valid product codes.
- Flatten document data through a shared export-row adapter only at output boundaries. Why: all formats stay consistent while extracted and stored items remain product-only.
- Licenciamiento por equipo: tablas `licencias`/`terminales` sin acceso directo (solo service_role); toda activación pasa por las funciones `activar_licencia`/`estado_licencia` (ejecutables por anon) y la administración por funciones que exigen `has_role(admin)`. Why: la PC del cliente valida antes de iniciar sesión y nadie debe leer claves ajenas.
- El estado de activación se guarda en userData/licencia.json firmado con HMAC del machine ID (hash de hostname + MACs); la gracia offline es de 7 días y la revalidación cada 12 h. Why: copiar el programa a otra PC invalida la firma y el cliente puede trabajar sin internet por un tiempo acotado.
- "Actualizar programa" exige primero una copia JSON completa (gastos, documentos y cheques) en Documentos/Copias Foto a Documento; si la copia falla, la actualización se cancela. Why: ninguna actualización debe poner en riesgo los datos del cliente.
