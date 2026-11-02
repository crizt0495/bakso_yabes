import type { SalePayload } from "@/lib/validation/schemas";

/* Util transaksi kasir. Pure — diuji di tests/unit. */

export interface CartLine {
  product_id: string | null;
  variant_id?: string | null;
  product_name: string;
  variant_name?: string | null;
  unit_price: number;
  qty: number;
  note?: string | null;
}

export function cartLineTotal(line: Pick<CartLine, "unit_price" | "qty">): number {
  return Math.round(line.unit_price * line.qty * 100) / 100;
}

export function subtotal(lines: CartLine[]): number {
  return lines.reduce((s, l) => s + cartLineTotal(l), 0);
}

export interface Totals {
  subtotal: number;
  discount: number;
  total: number;
  change: number;
}

export function totals(lines: CartLine[], discount: number, paid: number): Totals {
  const st = Math.round(subtotal(lines) * 100) / 100;
  const disc = Math.min(Math.max(0, discount), st);
  const total = Math.round((st - disc) * 100) / 100;
  const change = Math.round(Math.max(0, paid - total) * 100) / 100;
  return { subtotal: st, discount: disc, total, change };
}

/** Payload yang dikirim ke RPC / antrean offline (idempotency_key UUID). */
export function buildSalePayload(
  lines: CartLine[],
  opts: {
    discount?: number;
    paidAmount?: number | null;
    paymentMethod?: "cash" | "qris";
    orderType?: "dine_in" | "takeaway";
    tableId?: string | null;
    customerId?: string | null;
    customerName?: string | null;
    note?: string | null;
    deviceId?: string | null;
    channelId?: "pos" | "online";
    idempotencyKey: string;
    occurredAt: string;
  },
): SalePayload {
  const t = totals(lines, opts.discount ?? 0, opts.paidAmount ?? (opts.paymentMethod === "cash" ? 0 : 0));
  return {
    idempotency_key: opts.idempotencyKey,
    device_id: opts.deviceId ?? undefined,
    occurred_at: opts.occurredAt,
    channel: opts.channelId ?? "pos",
    order_type: opts.orderType ?? "takeaway",
    table_id: opts.tableId ?? undefined,
    customer_id: opts.customerId ?? undefined,
    customer_name: opts.customerName ?? undefined,
    note: opts.note ?? undefined,
    discount: t.discount,
    paid_amount: opts.paidAmount ?? null,
    payment_method: opts.paymentMethod ?? "cash",
    items: lines.map((l) => ({
      product_id: l.product_id,
      variant_id: l.variant_id ?? undefined,
      product_name: l.product_name,
      variant_name: l.variant_name ?? undefined,
      qty: l.qty,
      unit_price: l.unit_price,
      note: l.note ?? undefined,
    })),
  };
}
