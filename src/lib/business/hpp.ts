/**
 * Perhitungan resep, HPP, dan laba.
 * - HPP = Σ (qty bahan × biaya rata-rata bahan saat digunakan).
 * - Biaya bahan memakai metode Moving Weighted Average:
 *     avg_baru = (qty_lama × avg_lama + qty_masuk × harga_beli) / (qty_lama + qty_masuk)
 *   Bila stok ≤ 0, avg baru = harga beli terakhir.
 *   (Dokumentasi: docs/ARCHITECTURE.md — bagian "Metode biaya persediaan".)
 *
 * Semua fungsi berbahaya murni/pure — bisa diuji unit test (Vitest).
 */

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function round4(n: number): number {
  return Math.round((n + Number.EPSILON) * 10000) / 10000;
}

export interface RecipeItemLike {
  qty: number;
  unit_cost: number;
}
export interface RecipeItemWithVariant extends RecipeItemLike {
  product_variant_id?: string | null;
}

/** HPP sebuah resep: Σ(qty × biaya) untuk item generik + item varian tsb. */
export function recipeHpp(
  items: RecipeItemWithVariant[],
  variantId?: string | null,
): number {
  return round2(
    items
      .filter((i) => !i.product_variant_id || i.product_variant_id === variantId)
      .reduce((acc, i) => acc + i.qty * i.unit_cost, 0),
  );
}

/** HPP baris penjualan = HPP per unit × qty terjual (angka bulat 2 desimal). */
export function lineHpp(hppPerUnit: number, qty: number): number {
  return round2(hppPerUnit * qty);
}

/** Biaya rata-rata baru ketika bahan masuk (moving weighted average). */
export function nextWeightedAvg(
  oldQty: number,
  oldAvg: number,
  inQty: number,
  inCost: number,
): number {
  if (inQty <= 0) return round4(oldAvg);
  if (oldQty <= 0) return round4(inCost);
  return round4((oldQty * oldAvg + inQty * inCost) / (oldQty + inQty));
}

/* ---------- Laba ---------- */
export interface ProfitInput {
  revenue: number; // penjualan bersih (total - diskon)
  hpp: number;
  expenses: number; // pengeluaran operasional
}

export interface ProfitResult {
  gross_profit: number; // laba kotor = revenue − HPP
  gross_margin_pct: number; // %
  net_profit: number; // laba bersih = gross − pengeluaran
  net_margin_pct: number; // %
}

export function profit(input: ProfitInput): ProfitResult {
  const gp = round2(input.revenue - input.hpp);
  const np = round2(gp - input.expenses);
  return {
    gross_profit: gp,
    gross_margin_pct: input.revenue > 0 ? round2((gp / input.revenue) * 100) : 0,
    net_profit: np,
    net_margin_pct: input.revenue > 0 ? round2((np / input.revenue) * 100) : 0,
  };
}
