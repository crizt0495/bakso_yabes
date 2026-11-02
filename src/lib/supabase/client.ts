import { createBrowserClient } from "@supabase/ssr";

/** Browser client (RLS: hanya data pemilik yang terlihat). */
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
