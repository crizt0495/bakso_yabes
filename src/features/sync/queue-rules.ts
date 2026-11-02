/**
 * Aturan antrean sinkronisasi (pure) — dapat diuji di Node tanpa browser.
 * Dibaca oleh sync-engine; dibaca test supaya berjalan lintas browser.
 */

export const MAX_ATTEMPTS = 10;

export const QUEUE_STATUSES = ["pending_sync", "syncing", "synced", "failed", "conflict"] as const;

export function queueStatusRef(): readonly string[] {
  return QUEUE_STATUSES;
}

/** Apakah item boleh dicoba lagi? Error ES_* = kesalahan payload permanen. */
export function canAttempt(attempts: number, lastError?: string | null): boolean {
  if (permanentFailure(lastError ?? null)) return false;
  return attempts < MAX_ATTEMPTS;
}

export function permanentFailure(lastError: string | null): boolean {
  if (!lastError) return false;
  return lastError.startsWith("ES_");
}

/** Validasi ringan payload penjualan sebelum masuk antrean IndexedDB. */
export function validateSalePayloadOffline(
  payload: {
    idempotency_key: string;
    occurred_at: string;
    items: { product_name: string; qty: number; unit_price: number }[];
  },
): { ok: true } | { ok: false; error: string } {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(payload.idempotency_key ?? "")) {
    return { ok: false, error: "idempotency_key harus UUID" };
  }
  if (!payload.occurred_at || Number.isNaN(new Date(payload.occurred_at).getTime())) {
    return { ok: false, error: "occurred_at tidak valid" };
  }
  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    return { ok: false, error: "minimal 1 item" };
  }
  for (const [i, it] of payload.items.entries()) {
    if (!(it.qty > 0)) return { ok: false, error: `item ${i + 1}: qty harus > 0` };
    if (!(it.unit_price >= 0)) return { ok: false, error: `item ${i + 1}: harga tidak boleh minus` };
  }
  return { ok: true };
}
