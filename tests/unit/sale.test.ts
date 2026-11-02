import { describe, expect, it } from "vitest";
import { buildSalePayload, cartLineTotal, totals, type CartLine } from "@/lib/business/sale";

const line = (name: string, unit_price: number, qty = 1): CartLine => ({
  product_id: "00000000-0000-4000-8000-000000000001",
  product_name: name,
  unit_price,
  qty,
});

describe("totals", () => {
  it("subtotal = Σ harga × qty", () => {
    const t = totals([line("Bakso", 15000, 2), line("Es teh", 5000)], 0, 0);
    expect(t.subtotal).toBe(35000);
  });

  it("diskon tidak menembus subtotal & total tidak pernah minus", () => {
    const t = totals([line("Bakso", 15000)], 20000, 0);
    expect(t.discount).toBe(15000);
    expect(t.total).toBe(0);
  });

  it("kembalian dihitung dari pembayaran tunai", () => {
    const t = totals([line("Bakso", 15000, 2)], 0, 50000);
    expect(t.total).toBe(30000);
    expect(t.change).toBe(20000);
  });
});

describe("cartLineTotal", () => {
  it("mencakup kaitan harga×qty", () => {
    expect(cartLineTotal({ unit_price: 12345.5, qty: 2 })).toBe(24691);
  });
});

describe("buildSalePayload — offline-safe & idempotent", () => {
  it("Membuat payload dengan idempotency_key & harga snapshot (bukan harga menu saat ini)", () => {
    const key = "c9bf9e57-1685-4c89-bafb-ff5af830be8a";
    const occurred = "2026-11-01T10:00:00.000Z";
    const payload = buildSalePayload([line("Bakso", 15000, 2)], {
      discount: 5000,
      paidAmount: 30000,
      paymentMethod: "cash",
      deviceId: "00000000-0000-4000-8000-000000000009",
      idempotencyKey: key,
      occurredAt: occurred,
    });

    expect(payload.idempotency_key).toBe(key);
    expect(payload.occurred_at).toBe(occurred);
    expect(payload.items[0].unit_price).toBe(15000);
    expect(payload.items[0].product_name).toBe("Bakso");
    expect(payload.discount).toBe(5000);
    expect(payload.paid_amount).toBe(30000);
  });

  it("dua pemanggilan dengan key yang sama menghasilkan payload identik (penyangkal klik ganda)", () => {
    const fn = () =>
      buildSalePayload([line("Bakso", 15000)], {
        idempotencyKey: "c9bf9e57-1685-4c89-bafb-ff5af830be8a",
        occurredAt: "2026-11-01T10:00:00.000Z",
      });
    expect(JSON.stringify(fn())).toBe(JSON.stringify(fn()));
  });
});
