import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Server client dengan cookies (untuk Route Handlers & Server Components). */
export async function supabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // dipanggil dari Server Component — aman diabaikan karena
            // middleware sudah me-refresh token.
          }
        },
      },
    },
  );
}

