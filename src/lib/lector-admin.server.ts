import { createClient } from "@supabase/supabase-js";

// The hosted reader spends the owner's AI credits, so only admins may use it.
export async function esAdminLector(request: Request): Promise<boolean> {
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!token || !url || !key) return false;
  const supabase = createClient(url, key, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: u } = await supabase.auth.getUser(token);
  if (!u.user) return false;
  const { data } = await supabase.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
  return data === true;
}

export const MENSAJE_SIN_CLAVE =
  "Para leer fotos configurá tu clave de Google en «🔧 Lector inteligente con IA».";
