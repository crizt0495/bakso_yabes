import { NextRequest, NextResponse } from "next/server";
import { setupSchema } from "@/lib/validation/schemas";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Setup pemilik pertama — dipanggil sekali saja.
 * Proteksi: SETUP_SECRET harus cocok. Tidak ada pendaftaran publik.
 * Membuat: auth user, business, profile, satuan & kategori default.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.SETUP_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Setup dinonaktifkan (SETUP_SECRET tidak diatur)" },
      { status: 403 },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid" }, { status: 400 });
  }
  const obj = (raw ?? {}) as { setup_secret?: string };
  if (obj.setup_secret !== secret) {
    return NextResponse.json({ error: "Secret salah" }, { status: 401 });
  }

  const parsed = setupSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: first?.message ?? "Data tidak valid" }, { status: 400 });
  }
  const input = parsed.data;

  const admin = supabaseAdmin();

  // username unik?
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("username", input.username.toLowerCase())
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "Username sudah digunakan" }, { status: 409 });
  }

  // email internal (tidak dipakai login publik; sesi dibuat dr username mapping)
  const email = `${input.username.toLowerCase()}+${crypto.randomUUID().slice(0, 8)}@baksoku.internal`;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
  });
  if (createErr || !created.user) {
    return NextResponse.json({ error: createErr?.message ?? "Gagal membuat user" }, { status: 500 });
  }

  const { data: biz, error: bizErr } = await admin
    .from("businesses")
    .insert({ owner_id: created.user.id, name: input.business_name })
    .select("id, qr_menu_code, name")
    .single();
  if (bizErr) {
    return NextResponse.json({ error: bizErr.message }, { status: 500 });
  }

  const { error: profErr } = await admin.from("profiles").insert({
    id: created.user.id,
    business_id: biz.id,
    username: input.username.toLowerCase(),
    full_name: input.full_name,
    role: "owner",
  });
  if (profErr) {
    return NextResponse.json({ error: profErr.message }, { status: 500 });
  }

  // data awal: satuan, kategori, meja
  const satuan = [
    { name: "Kilogram", symbol: "kg" },
    { name: "Gram", symbol: "gr" },
    { name: "Liter", symbol: "ltr" },
    { name: "Mililiter", symbol: "ml" },
    { name: "Porsi", symbol: "porsi" },
    { name: "Butir", symbol: "butir" },
    { name: "Buah", symbol: "buah" },
    { name: "Bungkus", symbol: "bks" },
  ];
  const { data: units } = await admin
    .from("units")
    .insert(satuan.map((s) => ({ ...s, business_id: biz.id })))
    .select("id, symbol");

  await admin.from("categories").insert(
    ["Bakso", "Mie", "Minuman", "Tambahan", "Paket"].map((name, i) => ({
      business_id: biz.id,
      name,
      sort_order: i,
    })),
  );

  await admin.from("dining_tables").insert(
    Array.from({ length: 8 }, (_, i) => ({
      business_id: biz.id,
      name: `Meja ${i + 1}`,
    })),
  );

  return NextResponse.json({
    ok: true,
    business_id: biz.id,
    qr_menu_code: biz.qr_menu_code,
    units: units?.map((u) => u.symbol) ?? [],
    message:
      "Sukses. Silakan login di /login dengan username & password yang dibuat. " +
      "Setelah ini Anda dapat menghapus SETUP_SECRET dari environment.",
  });
}
