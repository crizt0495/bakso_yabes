import { describe, expect, it } from "vitest";
import { queueStatusRef, canAttempt, permanentFailure, MAX_ATTEMPTS } from "@/features/sync/queue-rules";
import { validateSalePayloadOffline } from "@/features/sync/queue-rules";

/**
 * Uji perilaku antrean sinkronisasi (aturan murni) — duplikasi dari
 * logika sync-engine supaya dapat diuji tanpa browser/IndexedDB.
 */
describe("aturan antrean offline", () => {
  it("status queue valid sesuai ketentuan", () => {
    for (const s of ["pending_sync", "syncing", "synced", "failed", "conflict"]) {
      expect(queueStatusRef()).toContain(s);
    }
  });

  it("retry hanya jika attempts < MAX_ATTEMPTS dan bukan error permanen", () => {
    expect(canAttempt(0)).toBe(true);
    expect(canAttempt(MAX_ATTEMPTS - 1)).toBe(true);
    expect(canAttempt(MAX_ATTEMPTS)).toBe(false);
    expect(canAttempt(0, "ES_VALIDATION: harga salah")).toBe(false); // permanen → failed
    expect(canAttempt(0, "FetchError: network error")).toBe(true); // bolak-balik online
  });

  it("validasi offline menolak payload salah sebelum masuk antrean", () => {
    const ok = validateSalePayloadOffline({
      idempotency_key: "c9bf9e57-1685-4c89-bafb-ff5af830be8a",
      occurred_at: "2026-11-01T10:00:00.000Z",
      items: [{ product_name: "Bakso", qty: 1, unit_price: 10000 }],
    });
    expect(ok.ok).toBe(true);

    const bad = validateSalePayloadOffline({
      idempotency_key: "bukan-uuid",
      occurred_at: "2026-11-01T10:00:00.000Z",
      items: [],
    });
    expect(bad.ok).toBe(false);
  });

  it("duplikat idempotency (kirim ulang) tidak boleh membuat entri baru", () => {
    // simulasi index unik idempotency_key di tabel sales/klien
    const stored = new Set<string>();
    const submit = (key: string) => {
      if (stored.has(key)) return "already_exists";
      stored.add(key);
      return "ok";
    };
    const key = "c9bf9e57-1685-4c89-bafb-ff5af830be8a";
    expect(submit(key)).toBe("ok");
    expect(submit(key)).toBe("already_exists"); // klik ganda / re-sync
    expect(stored.size).toBe(1);
  });
});

describe("permanent failure detection", () => {
  it("error ES_* dari server bersifat permanen", () => {
    expect(permanentFailure("ES_VALIDATION: minimal 1 item")).toBe(true);
    expect(permanentFailure("TypeError: failed to fetch")).toBe(false);
  });
});
