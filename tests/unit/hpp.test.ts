import { describe, expect, it } from "vitest";
import { recipeHpp, lineHpp, nextWeightedAvg, profit, round2, round4 } from "@/lib/business/hpp";

describe("HPP (resep)", () => {
  it("Menghitung HPP dari takaran bahan × biaya rata-rata", () => {
    const items = [
      { qty: 5, unit_cost: 800 }, // 5 butir bakso @800
      { qty: 1, unit_cost: 2000 }, // 1 porsi mie
      { qty: 1, unit_cost: 500 }, // kuah
    ];
    expect(recipeHpp(items)).toBe(round2(5 * 800 + 1 * 2000 + 1 * 500)); // 6500
  });

  it("Item per-varian hanya dihitung untuk varian terkait", () => {
    const items = [
      { qty: 1, unit_cost: 3000, product_variant_id: null },
      { qty: 1, unit_cost: 1000, product_variant_id: "v-jumbo" },
    ];
    expect(recipeHpp(items, "v-jumbo")).toBe(4000);
    expect(recipeHpp(items, "v-kecil")).toBe(3000);
  });

  it("HPP baris = HPP per unit × qty", () => {
    expect(lineHpp(6500, 3)).toBe(19500);
  });
});

describe("Moving weighted average", () => {
  it("Perbedaan biaya: stok exhibisi lama + masuk baru", () => {
    // 10 kg @ 20rb, beli 10 kg @ 30rb → rata 25rb
    expect(nextWeightedAvg(10, 20000, 10, 30000)).toBe(25000);
  });

  it("Perbedaan stok habis/minus → harga beli terbaru", () => {
    expect(nextWeightedAvg(0, 20000, 5, 30000)).toBe(30000);
    expect(nextWeightedAvg(-3, 20000, 5, 30000)).toBe(30000);
  });

  it("Rounding 4 desimal menghindari float longgar", () => {
    expect(nextWeightedAvg(1, 0.1, 1, 0.2)).toBe(round4((1 * 0.1 + 1 * 0.2) / 2));
  });
});

describe("Laba", () => {
  it("Laba kotor = penjualan − HPP; laba bersih dikurang pengeluaran", () => {
    const r = profit({ revenue: 1_000_000, hpp: 400_000, expenses: 150_000 });
    expect(r.gross_profit).toBe(600_000);
    expect(r.gross_margin_pct).toBe(60);
    expect(r.net_profit).toBe(450_000);
    expect(r.net_margin_pct).toBe(45);
  });

  it("Revenue 0 → margin 0 (tanpa divide-by-zero)", () => {
    const r = profit({ revenue: 0, hpp: 100, expenses: 0 });
    expect(r.gross_margin_pct).toBe(0);
    expect(r.net_margin_pct).toBe(0);
  });
});
