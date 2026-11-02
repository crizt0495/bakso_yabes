# Fitur offline-first

## Komponen

* **IndexedDB** melalui Dexie (`src/features/sync/db.ts`) — tabel lokal:
  `kv`, `categories`, `products`, `variants`, `ingredients`, `recipe_items`,
  `dtables`, `sale_queue`.
* **PWA + Service Worker** (`public/sw.js`, `public/manifest.webmanifest`) —
  app shell & aset ter-cache, navigasi network-first dengan fallback cache +
  halaman `/offline`.
* **Sync engine** (`src/features/sync/sync-engine.ts`) — antrean &
  pengiriman.

## Alur kasir offline

1. Saat online, `refreshCache()` menarik master data (produk, varian, kategori,
   bahan, resep, meja) ke IndexedDB. Dijalankan saat aplikasi dibuka.
2. Kasir membaca dari Dexie (live query) → tetap cepat & bekerja offline.
3. Saat bayar, `enqueueSale()` menyimpan transaksi ke `sale_queue` dengan status
   `pending_sync`, plus `idempotency_key` (UUID). Saldo stok bahan lokal
   dikurangi (estimasi; server yang menentukan final).
4. `applyLocalStockDeduction()` memperbarui `db.ingredients.qty` agar kasir
   berikutnya melihat stok menipis secara instan.
5. Item **tidak dihapus** sebelum server konfirmasi penyimpanan.

## Status antrean (seperti ketentuan)

`pending_sync` → `syncing` → `synced` / `failed` / `conflict`.

## Retry otomatis

* Saat aplikasi dibuka (`setupAutoSync` → `syncNow("startup")`).
* Saat event `online` browser.
* Saat tab kembali `visible`.
* Tombol manual "Sinkronkan" & "Coba gagal lagi".
* **Tidak mengandalkan Background Sync API saja** karena dukungan browser
  berbeda-beda (mekanisme retry ada di aplikasi).

## Anti-duplikat

* `idempotency_key` unique di klien & database.
* Kirim ulang entri yang sama → server mengembalikan `already_exists` (bukan
  duplikat).
* Bila gagal validasi permanen (`ES_*`), status `failed` & data tetap
  tersimpan — kasir menampilkan alasan untuk dikoreksi. Retry hanya untuk
  kegagalan jaringan / server sementara (`canAttempt` di `queue-rules.ts`).

## Rekonsiliasi stok

* `rpc_stock_reconcile()` membandingkan `stock_balances.qty` dengan total jurnal
  `stock_movements.qty_change`. Selisih ≠ 0 → tampilkan di Pengaturan.
* Tombol Masuk/Keluar/Opname pada Stok Bahan selalu lewat
  `rpc_stock_adjustment` (jurnal) — tidak boleh mengubah saldo langsung.
* `applyLocalStockDeduction` menyimpan `qty` negatif sementara di IndexedDB —
  setelah sinkron, `refreshCache()` menarik ulang saldo resmi dari server.

## Batasan sadar

* Hanya **satu perangkat utama** menulis transaksi offline. Perangkat lain
  digunakan untuk melihat data saat online.
* Jika beberapa perangkat melakukan penjualan saat sama-sama offline, stok
  global tidak dapat dijamin konsisten. Tandai stok lokal sebagai sementara
  dan lakukan rekonsiliasi setelah sinkronisasi.
* QR Menu pelanggan memerlukan internet kecuali kelak dibuat jaringan lokal
  khusus.
* IndexedDB **bukan** backup satu-satunya — data lokal dapat hilang bila
  penyimpanan browser dibersihkan atau perangkat rusak. Gunakan backup
  Supabase/JSON (lihat `docs/BACKUP.md`).
