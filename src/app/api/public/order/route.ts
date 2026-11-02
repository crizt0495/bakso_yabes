import { NextRequest, NextResponse } from "next/server";
import { digitalOrderSchema } from "@/lib/validation/schemas";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimit, sweepRateLimit } from "@/lib/server/rate-limit";

/**
 * Kirim pesanan dari QR Menu. Server yang menghitung harga (bukan klien)
 * supaya harga tidak dapat dimanipulasi. HTTP 201 hanya jika tersimpan.
 */
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  sweepRateLimit();
  const rl = rateLimit(`order:${ip}`, 10, 5 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Terlalu banyak permintaan. Coba lagi dalam ${rl.retryAfter} detik.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid" }, { status: 400 });
  }

  const parsed = digitalOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data pesanan tidak valid" },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const admin = supabaseAdmin();

  const { data: biz } = await admin
    .from("businesses")
    .select("id, qr_menu_enabled")
    .eq("qr_menu_code", input.business_code)
    .maybeSingle();

  if (!biz) return NextResponse.json({ error: "Menu tidak ditemukan" }, { status: 404 });
  if (!biz.qr_menu_enabled) return NextResponse.json({ error: "QR menu sedang ditutup" }, { status: 403 });

  // harga diambil dari DB
  const ids = [...new Set(input.items.map((i) => i.product_id))];
  const { data: prods } = await admin
    .from("products")
    .select("id, name, price, is_active, is_available, product_variants(id, product_id, name, price, is_active, is_available)")
    .in("id", ids)
    .eq("business_id", biz.id);

  const prodMap = new Map((prods ?? []).map((p: any) => [p.id, p]));
  const rows: any[] = [];
  for (const item of input.items) {
    const p = prodMap.get(item.product_id);
    if (!p || !p.is_active) {
      return NextResponse.json({ error: `Produk tidak valid: ${item.product_id}` }, { status: 400 });
    }
    let unitPrice = Number(p.price);
    const productName = p.name;
    let variantId: string | null = item.product_variant_id ?? null;
    let variantName: string | null = null;
    if (variantId) {
      const v = (p.product_variants ?? []).find((x: any) => x.id === variantId);
      if (!v || !v.is_active) {
        return NextResponse.json({ error: "Varian produk tidak valid" }, { status: 400 });
      }
      variantId = v.id;
      unitPrice = Number(v.price);
      variantName = v.name;
    }
    if (item.product_variant_id === null && !p.is_available) {
      return NextResponse.json({ error: `${productName} sedang habis` }, { status: 400 });
    }
    if (item.product_variant_id !== null) {
      const v = (p.product_variants ?? []).find((x: any) => x.id === item.product_variant_id);
      if (v && !v.is_available) {
        return NextResponse.json({ error: `${productName} (${variantName}) sedang habis` }, { status: 400 });
      }
    }
    rows.push({
      product_id: p.id,
      product_variant_id: variantId,
      product_name: productName,
      variant_name: variantName,
      qty: item.qty,
      unit_price: unitPrice,
      line_total: Math.round(unitPrice * item.qty * 100) / 100,
    });
  }

  const total = Math.round(rows.reduce((s, r) => s + r.line_total, 0) * 100) / 100;
  const orderCode = derivedCode();

  const { data: order, error: e1 } = await admin
    .from("digital_orders")
    .insert({
      business_id: biz.id,
      order_code: orderCode,
      customer_name: input.customer_name,
      order_type: input.order_type,
      table_no: input.order_type === "dine_in" ? input.table_no ?? null : null,
      note: input.note ?? null,
      total,
      status: "new",
    })
    .select("id, order_code")
    .single();

  if (e1 || !order) {
    return NextResponse.json({ error: "Gagal menyimpan pesanan" }, { status: 500 });
  }

  const { error: e2 } = await admin
    .from("digital_order_items")
    .insert(rows.map((r) => ({ ...r, business_id: biz.id, order_id: order.id })));

  if (e2) {
    // order header exists tanpa item — tandai gagal agar kasir melihat anomali
    await admin.from("digital_orders").update({ status: "cancelled" }).eq("id", order.id);
    return NextResponse.json({ error: "Gagal menyimpan detail pesanan" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, order_code: order.order_code, total }, { status: 201 });
}

function derivedCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  const rnd = crypto.getRandomValues(new Uint8Array(6));
  for (const b of rnd) code += alphabet[b % alphabet.length];
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}
