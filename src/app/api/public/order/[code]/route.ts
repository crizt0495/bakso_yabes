import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Tracking status pesanan untuk pelanggan (oleh kode pesanan pendek). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const admin = supabaseAdmin();

  const { data: order } = await admin
    .from("digital_orders")
    .select("order_code, status, customer_name, order_type, table_no, total, note, created_at, digital_order_items(product_name, variant_name, qty, unit_price, line_total)")
    .eq("order_code", code.toUpperCase())
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json({ order });
}
