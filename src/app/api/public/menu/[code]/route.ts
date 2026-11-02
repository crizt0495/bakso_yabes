import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Menu publik untuk QR Menu — tidak membocorkan data lain (produk aktif saja). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const admin = supabaseAdmin();

  const { data: biz } = await admin
    .from("businesses")
    .select("id, name, qr_menu_enabled")
    .eq("qr_menu_code", code)
    .maybeSingle();

  if (!biz) {
    return NextResponse.json({ error: "Menu tidak ditemukan" }, { status: 404 });
  }
  if (!biz.qr_menu_enabled) {
    return NextResponse.json({ error: "QR Menu sedang tidak aktif" }, { status: 403 });
  }

  const [cats, prodsRes] = await Promise.all([
    admin
      .from("categories")
      .select("id, name, sort_order")
      .eq("business_id", biz.id)
      .eq("is_active", true)
      .order("sort_order"),
    admin
      .from("products")
      .select("id, category_id, name, description, photo_url, price, is_available, sort_order, product_variants(id, name, price, is_available, is_active, sort_order)")
      .eq("business_id", biz.id)
      .eq("is_active", true)
      .order("sort_order"),
  ]);

  return NextResponse.json({
    business: { name: biz.name },
    categories: cats.data ?? [],
    products: prodsRes.data ?? [],
  });
}
