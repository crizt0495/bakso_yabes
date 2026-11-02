import { NextResponse, NextRequest } from "next/server";
import { loginSchema } from "@/lib/validation/schemas";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@supabase/supabase-js";

/**
 * Login username + password.
 * Username dipetakan ke email DI SERVER (email tidak pernah dikirim ke browser).
 * Rate limit sederhana: maksimal 5 percobaan / username / 10 menit.
 * Pesan error generik agar tidak membocorkan keberadaan akun.
 */

type Attempt = { count: number; first: number };
const attempts = new Map<string, Attempt>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function tooManyAttempts(id: string): boolean {
  const now = Date.now();
  const a = attempts.get(id);
  if (!a || now - a.first > WINDOW_MS) {
    attempts.set(id, { count: 1, first: now });
    return false;
  }
  a.count += 1;
  if (a.count > MAX_ATTEMPTS) return true;
  return false;
}

function clearAttempts(id: string) {
  attempts.delete(id);
}

const GENERIC_ERROR = "Username atau password salah";

export async function POST(request: NextRequest) {
  // validasi input
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid" }, { status: 400 });
  }
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Username atau password salah" }, { status: 400 });
  }
  const { username, password } = parsed.data;
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";

  const limited = tooManyAttempts(`u:${username.toLowerCase()}`);
  const ipLimited = tooManyAttempts(`ip:${ip}`);
  if (limited || ipLimited) {
    return NextResponse.json(
      { error: "Terlalu banyak percobaan. Coba lagi dalam beberapa menit." },
      { status: 429 },
    );
  }

  const admin = supabaseAdmin();

  // 1) cari profile berdasarkan username (tanpa membocorkan email)
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id")
    .eq("username", username.toLowerCase())
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  // 2) ambil email dari Auth (hanya di server)
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(profile.id);
  if (userError || !userData?.user?.email) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  // 3) verifikasi password di server (sesi tidak pernah menampilkan email)
  const plain = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: authData, error: authError } = await plain.auth.signInWithPassword({
    email: userData.user.email,
    password,
  });

  if (authError || !authData.session) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  clearAttempts(`u:${username.toLowerCase()}`);
  clearAttempts(`ip:${ip}`);

  // 4) simpan sesi ke cookies (route handler HTTP-only)
  const serverClient = await supabaseServer();
  const { error: setErr } = await serverClient.auth.setSession({
    access_token: authData.session.access_token,
    refresh_token: authData.session.refresh_token,
  });
  if (setErr) {
    return NextResponse.json({ error: "Gagal membuat sesi" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
