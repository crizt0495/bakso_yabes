import { supabaseBrowser } from "@/lib/supabase/client";
import { uid } from "@/lib/utils/cn";
import { db, kvGet, kvSet, type QueueSale } from "./db";

/**
 * Sync engine — jantung fitur offline-first.
 *
 * Aturan main (lihat juga docs/OFFLINE.md):
 * - Semua kiriman memakai idempotency_key; server RPC mencegah duplikat.
 * - Item antrean TIDAK dihapus sebelum server konfirmasi tersimpan.
 * - Retry otomatis: saat aplikasi dibuka, saat online event, saat tab
 *   kembali aktif. Jangan mengandalkan Background Sync API saja.
 * - Kegagalan dicatat (attempts, last_error) agar selalu dapat diperiksa.
 * - Jika penjualan gagal validasi permanen (ES_VALIDATION), tetap status
 *   `failed` — data tidak hilang, kasir menampilkan alasan untuk dikoreksi.
 */

interface EngineState {
  syncing: boolean;
  lastError: string | null;
  lastSyncAt: string | null;
}
const listeners = new Set<(s: EngineState) => void>();
export const syncState: EngineState = { syncing: false, lastError: null, lastSyncAt: null };

export function onSyncStateChange(fn: (s: EngineState) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
function emit() {
  for (const fn of listeners) fn({ ...syncState });
}

export const MAX_ATTEMPTS = 10;

/* =============================================================
 * Device — ID perangkat unik + registrasi ke tabel devices
 * ============================================================= */
export async function getDeviceId(regenerate = false): Promise<string> {
  if (!regenerate) {
    const existing = await kvGet<string>("device_id");
    if (existing) return existing;
  }
  const id = uid();
  await kvSet("device_id", id);
  await registerDevice(id);
  return id;
}

async function registerDevice(deviceId: string) {
  try {
    const supabase = supabaseBrowser();
    const label = navigator.userAgent.slice(0, 80);
    const deviceCode = `dev-${deviceId.slice(0, 8)}`;
    await supabase
      .from("devices")
      .upsert({ device_code: deviceCode, label, is_active: true, last_seen_at: new Date().toISOString() })
      .select("id");
    // simpan uuid server (opsional; fallback pakai device local id)
    const { data } = await supabase
      .from("devices")
      .select("id")
      .eq("device_code", deviceCode)
      .maybeSingle();
    if (data?.id) await kvSet("device_server_id", data.id);
  } catch {
    // offline — akan diregistrasi saat sinkron berikutnya
  }
}

export async function deviceServerId(): Promise<string | null> {
  return (await kvGet<string>("device_server_id")) ?? null;
}

/* =============================================================
 * Cache data master agar kasir jalan tanpa internet
 * ============================================================= */
export async function refreshCache(): Promise<boolean> {
  if (!navigator.onLine) return false;
  const supabase = supabaseBrowser();

  const [{ data: cats }, { data: prods }, { data: variants }, { data: units }, { data: ing }, { data: tab }] =
    await Promise.all([
      supabase.from("categories").select("id,name,sort_order,is_active").order("sort_order"),
      supabase.from("products").select("id,category_id,name,description,photo_url,price,is_available,is_active,sort_order,updated_at").order("sort_order"),
      supabase.from("product_variants").select("id,product_id,name,price,is_available,is_active,sort_order"),
      supabase.from("units").select("id,symbol"),
      supabase.from("ingredients")
        .select("id,name,minimum_stock,is_active,stock_balances(qty,avg_cost),units(symbol)"),
      supabase.from("dining_tables").select("id,name").eq("is_active", true),
    ]);

  if (!prods) return false;

  const unitMap = new Map((units ?? []).map((u: any) => [u.id, u.symbol]));

  // cache category, product, variant (normalisasi numeric string → number)
  await db.categories.clear();
  await db.products.clear();
  await db.variants.clear();
  await db.dtables.clear();
  await db.ingredients.clear();

  await db.categories.bulkPut(
    (cats ?? []).map((c: any) => ({ ...c, sort_order: Number(c.sort_order) })),
  );
  await db.products.bulkPut(
    prods.map((p: any) => ({
      id: p.id,
      category_id: p.category_id,
      name: p.name,
      description: p.description,
      photo_url: p.photo_url,
      price: Number(p.price),
      is_available: p.is_available,
      is_active: p.is_active,
      sort_order: Number(p.sort_order),
      updated_at: p.updated_at,
    })),
  );
  await db.variants.bulkPut(
    (variants ?? []).map((v: any) => ({
      id: v.id,
      product_id: v.product_id,
      name: v.name,
      price: Number(v.price),
      is_available: v.is_available,
      is_active: v.is_active,
      sort_order: Number(v.sort_order),
    })),
  );
  await db.dtables.bulkPut(
    (tab ?? []).map((t: any) => ({ id: t.id, name: t.name })),
  );
  await db.ingredients.bulkPut(
    (ing ?? []).map((i: any) => ({
      id: i.id,
      name: i.name,
      min: Number(i.minimum_stock ?? 0),
      qty: Number(i.stock_balances?.qty ?? 0),
      avg_cost: Number(i.stock_balances?.avg_cost ?? 0),
      unit_symbol: unitMap.get(i.units?.symbol ?? "") ?? i.units?.symbol ?? "-",
      is_active: i.is_active,
    })),
  );

  // resep (untuk info HPP di kasir)
  const { data: recipes } = await supabase
    .from("recipes")
    .select("id,product_id")
    .eq("is_active", true);
  const { data: items } = recipes?.length
    ? await supabase.from("recipe_items").select("recipe_id,ingredient_id,qty,product_variant_id").in("recipe_id", recipes.map((r: any) => r.id))
    : { data: [] as any[] };

  recipeModsCache = null; // reset memo
  await db.recipe_items.clear();
  const prodMap = new Map((recipes ?? []).map((r: any) => [r.id, r.product_id]));
  await db.recipe_items.bulkPut(
    (items ?? []).map((it: any) => ({
      product_id: prodMap.get(it.recipe_id) as string,
      product_variant_id: it.product_variant_id,
      ingredient_id: it.ingredient_id,
      qty: Number(it.qty),
    })),
  );

  await kvSet("cache_updated_at", new Date().toISOString());
  return true;
}

let recipeModsCache: Map<string, { ingredient_id: string; qty: number }[]> | null = null;
/**
 * Konsumsi bahan per produk/varian (key: productId|variantId).
 * Dipakai untuk estimasi stok lokal (sementara) di kasir offline.
 */
export async function recipeModifiers(): Promise<Map<string, { ingredient_id: string; qty: number }[]>> {
  if (recipeModsCache) return recipeModsCache;
  const rows = await db.recipe_items.toArray();
  const map = new Map<string, { ingredient_id: string; qty: number }[]>();
  for (const r of rows) {
    const key = r.product_variant_id ? `${r.product_id}|${r.product_variant_id}` : r.product_id;
    const list = map.get(key) ?? [];
    list.push({ ingredient_id: r.ingredient_id, qty: r.qty });
    map.set(key, list);
  }
  recipeModsCache = map;
  return map;
}

/* =============================================================
 * Antrean penjualan
 * ============================================================= */
export async function enqueueSale(payload: {
  idempotency_key: string;
  total: number;
  occurred_at: string;
  receiptPreview: string;
  cart: unknown;
  salePayload: unknown;
}): Promise<number> {
  const deviceId = await getDeviceId();
  const serverId = await deviceServerId();
  const body = payload.salePayload as Record<string, unknown>;
  return await db.sale_queue.add({
    idempotency_key: payload.idempotency_key,
    status: "pending_sync",
    attempts: 0,
    last_error: null,
    created_at: new Date().toISOString(),
    synced_at: null,
    payload: {
      ...body,
      device_id: serverId ?? deviceId,
    },
    total: payload.total,
    receipt_preview: payload.receiptPreview,
    cart_snapshot: payload.cart,
  } as unknown as QueueSale & { total: number; receipt_preview: string; cart_snapshot: unknown });
}

/** Update estimasi stok lokal setelah penjualan (sementara; lihat rekonsiliasi). */
export async function applyLocalStockDeduction(salePayload: unknown) {
  const items = (salePayload as { items: any[] }).items ?? [];
  const mods = await recipeModifiers();
  for (const item of items) {
    const key = item.variant_id ? `${item.product_id}|${item.variant_id}` : item.product_id;
    const list = mods.get(key);
    if (!list) continue;
    for (const m of list) {
      const ing = await db.ingredients.get(m.ingredient_id);
      if (ing) {
        await db.ingredients.put({ ...ing, qty: Math.round((ing.qty - m.qty * item.qty) * 10000) / 10000 });
      }
    }
  }
}

/* =============================================================
 * Sinkronisasi antrean
 * ============================================================= */
export async function syncNow(reason = "manual"): Promise<{ ok: boolean; synced: number; failed: number }> {
  if (syncState.syncing) return { ok: false, synced: 0, failed: 0 };
  if (!navigator.onLine) return { ok: false, synced: 0, failed: 0 };

  const pending = await pendingSales();
  if (pending.length === 0) {
    syncState.lastSyncAt = new Date().toISOString();
    syncState.lastError = null;
    emit();
    return { ok: true, synced: 0, failed: 0 };
  }

  syncState.syncing = true;
  syncState.lastError = null;
  emit();

  const supabase = supabaseBrowser();
  let synced = 0;
  let failed = 0;

  try {
    for (const row of pending) {
      // tandai syncing
      await db.sale_queue.update(row.id!, { status: "syncing" });

      try {
        const { data, error } = await supabase.rpc("rpc_create_sale", {
          p_payload: row.payload as any,
        });

        if (error) throw new Error(error.message);
        const res = data as { status?: string; sale_id?: string; receipt_no?: string };
        if (res?.status === "ok" || res?.status === "already_exists") {
          // server konfirmasi tersimpan → boleh tandai synced (tetap tersimpan lokal)
          await db.sale_queue.update(row.id!, {
            status: "synced",
            synced_at: new Date().toISOString(),
            last_error: null,
          });
          synced += 1;
        } else {
          throw new Error("Respons server tidak dikenal");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Kesalahan tidak diketahui";
        const attempts = row.attempts + 1;
        const permanent = msg.startsWith("ES_");
        await db.sale_queue.update(row.id!, {
          status: permanent ? "failed" : attempts >= MAX_ATTEMPTS ? "failed" : "pending_sync",
          attempts,
          last_error: msg,
        });
        failed += 1;
        syncState.lastError = msg;
      }
    }
  } finally {
    syncState.syncing = false;
    syncState.lastSyncAt = new Date().toISOString();
    emit();
    void reason;
  }

  return { ok: failed === 0, synced, failed };
}

/** Coba lagi item gagal (reset status supaya masuk antrean berikutnya). */
export async function retryFailed() {
  const items = await db.sale_queue.where("status").anyOf(["failed"]).toArray();
  await db.sale_queue.bulkPut(
    items.map((i) => ({ ...i, status: "pending_sync" as const, attempts: 0, last_error: null })),
  );
  return syncNow("retry_failed");
}

export async function pendingSales(): Promise<QueueSale[]> {
  const rows = await db.sale_queue.where("status").anyOf(["pending_sync", "syncing", "failed"]).toArray();
  return rows.sort((a, b) => a.id! - b.id!);
}

export async function pendingCount(): Promise<number> {
  return (await pendingSales()).length;
}

export async function unsentTotal(): Promise<number> {
  const rows = await pendingSales();
  return rows.reduce((s, r) => s + Number((r as any).total ?? 0), 0);
}

/* ---------- Auto-retry saat koneksi pulih / aplikasi dibuka ---------- */
export function setupAutoSync(topics: { onVisible?: boolean } = {}) {
  void getDeviceId();
  void syncNow("startup");

  window.addEventListener("online", () => void syncNow("online"));
  if (topics.onVisible !== false) {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void syncNow("visible");
    });
  }
}
