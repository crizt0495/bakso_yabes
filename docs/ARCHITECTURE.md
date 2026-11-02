# Arsitektur & keputusan teknis

## Prinsip

Satu warung, satu pemilik (user) = kasir. Kesederhanaan dijaga: tidak ada
multi-tenant kompleks, tetapi seluruh tabel tetap berkolom `business_id`
untuk keamanan siap-tumbuh.

## Pemisahan domain

```
src/
  app/(app)/            halaman terproteksi (kasir, stok, laporan, dst.)
  app/api/              Route Handlers (auth, setup, publik QR menu)
  components/ui/        kit komponen (gaya shadcn/ui: cva + cn)
  components/layout/    shell sidebar/bottom-nav
  features/sync/        IndexedDB (Dexie) + sync engine + aturan antrean
  lib/business/         logika bisnis murni (HPP, laba, payload transaksi)
  lib/supabase/        client browser / server(cookies) / admin(service)
  lib/validation/       Zod (dipakai klien & server)
  supabase/migrations/  SQL: skema → RLS → fungsi atomik
```

## Keputusan penting

1. **UI kit gaya shadcn/ui tanpa dependensi radix berat** — fungsional,
   aksesibel, mudah dipelihara; jika nanti migrasi ke shadcn CLI, API-nya
   nyaris identik.
2. **Semua proses penting atomik di database** melalui RPC PL/pgSQL
   (`rpc_create_sale`, dst.), bukan diaplikasi — aman dari klik ganda &
   lalu-lalang jaringan.
3. **Idempotency di tingkat database**: `idempotency_key` (UUID klien) unique
   pada tabel `sales` + tabel `idempotency_keys`. Kirim ulang yang sama
   → `already_exists`, bukan duplikat.
4. **Nomor nota** via `receipt_counters` (upsert increment atomik per
   hari/bisnis, dilindungi advisory lock per bisnis).
5. **Snapshot saat transaksi**: harga/unit, nama produk, resep
   (`sale_item_recipe_snapshots`) → laporan historis tidak berubah saat
   master diupdate. Metode biaya persediaan:
   **Moving Weighted Average** —
   `avg_baru = (qty_lama × avg_lama + qty_masuk × harga_beli)/ (qty_lama + qty_masuk)`;
   bila saldo ≤ 60 (perangkat kalah race / offline tandem) `avg_baru =
   harga_beli terakhir`. Pembelian persediaan **TIDAK** dicebak langsung ke
   HPP — HPP baru tercatat saat bahan terpakai (penjualan/korban lain).
   Dampak pembelian muncul di nilai persediaan & arus kas.
6. **Stok bisa minus** secara sengaja: transaksi offline tandem memang membuat
   stok global tak konsisten. Stok lokal perangkat adalah estimasi sementara;
   `rpc_stock_reconcile()` & opname menutup celah setelah sinkron.
   `stock_movements` adalah jurnal, saldo `stock_balances` lapisan cepat.
7. **Login username**: melalui Route Handler; server mencari profile→id auth
   user→email (tidak pernah dikirim ke browser), verifikasi password, lalu
   menyimpan sesi ke cookie HTTP-only (`@supabase/ssr`), middleware meng-
   refresh token.
8. **QRIS**: status pembayaran `pending` sampai verifikasi penyedia (webhook /
   status API) — screenshot pelanggan bukan bukti. Titik integrasi webhook:
   tabel `payments` kolom `provider_ref` + `status`.
9. **Pesanan digital** ditulis server-side (service role) sehingga tabel
   pelanggan tetap tertutup dari anon; konfirmasi pesanan (HTTP 201) hanya
   jika tersimpan penuh.
10. **Zona waktu**: `Asia/Jakarta` menentukan `local_day` (tanggal harian)
    sehingga laporan harian stabil meski sever UTC.
11. **Uang & kuantitas**: `numeric` (bukan float); di TypeScript dikonversi
    via util `num()` supaya DBNull numeric-string tidak merusak angka.

## Keamanan summary

* RLS + revoke anon.
* Service-key hanya di Route Handlers server.
* Zod validasi di klien & server.
* Rate limiting sederhana (in-memory) pada login — naik ke Upstash kalau
  nanti di-route di lingkungan serverless beragam-instance.
* Audit log untuk aksi penting (buat/ubah/hapus/batal/refund/konfirmasi).
