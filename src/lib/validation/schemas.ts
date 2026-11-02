import { z } from "zod";

/* ---------- Proses bisnis: penjualan ---------- */
export const saleItemSchema = z.object({
  product_id: z.string().uuid().nullable().optional(),
  variant_id: z.string().uuid().nullable().optional(),
  product_name: z.string().min(1).max(120),
  variant_name: z.string().max(80).nullish(),
  qty: z.number().positive().max(999),
  unit_price: z.number().min(0),
  note: z.string().max(200).nullish(),
});

export const salePayloadSchema = z.object({
  idempotency_key: z.string().uuid(),
  device_id: z.string().uuid().nullish(),
  occurred_at: z.string().min(10),
  channel: z.enum(["pos", "online"]).default("pos"),
  order_type: z.enum(["dine_in", "takeaway"]).default("takeaway"),
  table_id: z.string().uuid().nullish(),
  customer_id: z.string().uuid().nullish(),
  customer_name: z.string().max(120).nullish(),
  note: z.string().max(300).nullish(),
  discount: z.number().min(0).default(0),
  paid_amount: z.number().min(0).nullish(),
  payment_method: z.enum(["cash", "qris"]).default("cash"),
  qris_pending: z.boolean().optional(),
  items: z.array(saleItemSchema).min(1).max(100),
});
export type SalePayload = z.infer<typeof salePayloadSchema>;

/* ---------- Master data ---------- */
export const productSchema = z.object({
  name: z.string().trim().min(1, "Nama produk wajib diisi").max(120),
  category_id: z.string().uuid().nullish(),
  description: z.string().max(500).nullish(),
  photo_url: z.string().url().max(500).nullish().or(z.literal("")),
  price: z.coerce.number().min(0, "Harga tidak boleh negatif"),
  is_available: z.boolean().default(true),
  is_active: z.boolean().default(true),
  sort_order: z.coerce.number().int().min(0).default(0),
  variants: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(80),
        price: z.coerce.number().min(0),
        is_available: z.boolean().default(true),
        sort_order: z.coerce.number().int().min(0).default(0),
      }),
    )
    .max(20)
    .default([]),
});
export type ProductInput = z.infer<typeof productSchema>;

export const ingredientSchema = z.object({
  name: z.string().trim().min(1, "Nama bahan wajib diisi").max(120),
  unit_id: z.string().uuid("Satuan wajib dipilih"),
  minimum_stock: z.coerce.number().min(0).default(0),
  is_active: z.boolean().default(true),
});

export const unitSchema = z.object({
  name: z.string().trim().min(1).max(60),
  symbol: z.string().trim().min(1).max(12),
});

export const recipeItemSchema = z.object({
  ingredient_id: z.string().uuid("Bahan wajib dipilih"),
  product_variant_id: z.string().uuid().nullish(),
  qty: z.coerce.number().positive("Jumlah harus lebih dari 0"),
});

export const categorySchema = z.object({
  name: z.string().trim().min(1).max(80),
  sort_order: z.coerce.number().int().min(0).default(0),
});

/* ---------- Pembelian ---------- */
export const supplierSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(20).nullish(),
  address: z.string().trim().max(200).nullish(),
  note: z.string().trim().max(200).nullish(),
});

export const purchaseSchema = z.object({
  supplier_id: z.string().uuid().nullish(),
  ref_no: z.string().trim().min(1).max(40),
  purchase_date: z.string().min(10),
  payment_status: z.enum(["unpaid", "paid"]).default("unpaid"),
  note: z.string().max(300).nullish(),
  items: z
    .array(
      z.object({
        ingredient_id: z.string().uuid(),
        qty: z.coerce.number().positive(),
        unit_cost: z.coerce.number().min(0),
      }),
    )
    .min(1, "Minimal satu item pembelian"),
});

/* ---------- Keuangan ---------- */
export const expenseSchema = z.object({
  category: z.enum(["electricity", "water", "gas", "salary", "transport", "other"]),
  description: z.string().trim().min(1).max(300),
  amount: z.coerce.number().positive("Jumlah harus lebih dari 0"),
  spent_at: z.string().min(10),
});

/* ---------- Pelanggan ---------- */
export const customerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(20).nullish(),
  note: z.string().trim().max(300).nullish(),
});

/* ---------- Pesanan digital (QR menu) ---------- */
export const digitalOrderSchema = z.object({
  business_code: z.string().trim().min(8).max(32),
  customer_name: z.string().trim().min(1, "Nama wajib diisi").max(80),
  order_type: z.enum(["dine_in", "takeaway"]).default("dine_in"),
  table_no: z.string().trim().max(20).nullish(),
  note: z.string().max(300).nullish(),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        product_variant_id: z.string().uuid().nullish(),
        qty: z.coerce.number().int().positive().max(50),
      }),
    )
    .min(1, "Keranjang masih kosong"),
});

/* ---------- Auth & setup ---------- */
export const loginSchema = z.object({
  username: z.string().trim().min(3).max(30),
  password: z.string().min(6).max(72),
});
export const setupSchema = z.object({
  business_name: z.string().trim().min(1).max(200),
  full_name: z.string().trim().min(1).max(120),
  username: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9._-]{3,30}$/, "Username 3-30 karakter (huruf, angka, titik, garis)"),
  password: z.string().min(8, "Password minimal 8 karakter").max(72),
});
export type SetupInput = z.infer<typeof setupSchema>;
