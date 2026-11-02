import Dexie, { type Table } from "dexie";
import type { SalePayload } from "@/lib/validation/schemas";

/**
 * IndexedDB (Dexie) — penyimpanan lokal kasir offline.
 * Data master (produk/resep/bahan/meja) di-cache supaya kasir tetap bisa
 * dipakai tanpa internet. Transaksi offline masuk antrean sampai server
 * mengonfirmasi penyimpanan (JANGAN dihapus sebelum itu terjadi).
 */

export const QUEUE_STATUS = [
  "pending_sync", // dibuat lokal, belum terkirim
  "syncing", // sedang dikirim
  "synced", // dikonfirmasi server
  "failed", // gagal (boleh dicoba lagi)
  "conflict", // idempotency bentrok dengan catatan server
] as const;
export type QueueStatus = (typeof QUEUE_STATUS)[number];

export interface QueueSale {
  id?: number;
  idempotency_key: string;
  payload: SalePayload;
  status: QueueStatus;
  attempts: number;
  last_error: string | null;
  created_at: string;
  synced_at: string | null;
}

export interface CachedCategory {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

export interface CachedVariant {
  id: string;
  product_id: string;
  name: string;
  price: number;
  is_available: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface CachedProduct {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  photo_url: string | null;
  price: number;
  is_available: boolean;
  is_active: boolean;
  sort_order: number;
  updated_at: string;
}

export interface CachedIngredient {
  id: string;
  name: string;
  min: number;
  qty: number;
  avg_cost: number;
  unit_symbol: string;
  is_active: boolean;
}

export interface CachedModifier {
  /** bahan yang dikonsumsi per unit penjualan produk/varian */
  product_id: string;
  product_variant_id: string | null; // null = semua varian
  ingredient_id: string;
  qty: number;
}

export class BaksokuDB extends Dexie {
  kv!: Table<{ key: string; value: unknown }, string>;
  categories!: Table<CachedCategory, string>;
  products!: Table<CachedProduct, string>;
  variants!: Table<CachedVariant, string>;
  ingredients!: Table<CachedIngredient, string>;
  recipe_items!: Table<CachedModifier, [string, string]>;
  dtables!: Table<{ id: string; name: string }, string>;
  sale_queue!: Table<QueueSale, number>;

  constructor() {
    super("baksoku");
    this.version(1).stores({
      kv: "key",
      categories: "id, sort_order",
      products: "id, category_id, is_active",
      variants: "id, product_id",
      ingredients: "id",
      recipe_items: "[product_id+ingredient_id], product_id",
      dtables: "id",
      sale_queue: "++id, idempotency_key, status, created_at",
    });
  }
}

export const db = new BaksokuDB();

/* ---------- KV helpers ---------- */
export async function kvGet<T>(key: string): Promise<T | undefined> {
  const row = await db.kv.get(key);
  return row?.value as T | undefined;
}
export async function kvSet(key: string, value: unknown) {
  await db.kv.put({ key, value });
}
