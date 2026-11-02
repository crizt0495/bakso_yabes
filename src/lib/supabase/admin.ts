import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client — KHUSUS SERVER.
 * Jangan pernah mengimpor file ini dari client component.
 * Digunakan untuk: mapping username→email (login), setup pemilik pertama,
 * dan endpoint publik QR Menu (digital order).
 */
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Server misconfigured: SUPABASE_SERVICE_ROLE_KEY is missing");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
