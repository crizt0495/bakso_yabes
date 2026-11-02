# Konfigurasi Supabase

## 1. Buat proyek

1. Daftar/masuk di [supabase.com](https://supabase.com) → **New project**.
3. Simpan password database yang Anda buat saat diminta.
3. Di **Project Settings → API** ambil:
   * `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   * `anon public` / `publishable` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   * `service_role` / `secret` key → `SUPABASE_SERVICE_ROLE_KEY`
     (⚠ hanya untuk server: Route Handlers + Vercel Environment Variables,
     TIDAK untuk NEXT_PUBLIC_* dan tidak pernah di frontend/log/repo publik).

## 2. Migration (urutkan!)

| Urutan | File | Isi |
|---|---|---|
| 1 | `supabase/migrations/0001_init.sql` | Tabel, indeks, constraint, timestamptz,UUID, `touch_updated_at` |
| 2 | `supabase/migrations/0002_rls.sql` | RLS semua tabel + helper `app_is_owner()` + revoke dari anon |
| 3 | `supabase/migrations/0003_functions.sql` | RPC: `rpc_create_sale`, `rpc_void_sale`, `rpc_confirm_purchase`, `rpc_stock_adjustment`, `rpc_stock_reconcile` |

Jalankan via CLI (`npx supabase db push`) atau SQL Editor Dashboard.

## 3. Desain keamanan

* **RLS aktif di semua tabel** berkolom `business_id`. Policy =
  `app_is_owner(business_id)` → user hanya boleh menyentuh data bisnisnya.
* `anon` **tidak di-grant apa pun** (revoke semua) — QR Menu publik berkomunikasi
  lewat Route Handler menggunakan service role di server, bukan PostgREST anon.
* `SETUP_SECRET` memproteksi endpoint `/api/setup` pembuatan pemilik pertama.
  Setelah pemilik dibuat, hapus variabel dari environment.
* Email login pemilik tidak pernah dikirim ke browser (pemetaan
  username→email terjadi di server; lihat `src/app/api/auth/login/route.ts`).
* Rate limiting login (5 percobaan/username/10 menit) dan pesan error generik.

## 4. Struktur data utama

* `businesses` (1 row) → semua tabel ber-child `business_id`.
* Katalog: `categories`, `products`, `product_variants`.
* Inventori: `ingredients`, `units`, `stock_balances` (saldo+biaya rata-rata),
  `stock_movements` (jurnal; ketertiban saldo wajib lewat sini).
* Penjualan: `sales`, `sale_items`, `sale_item_recipe_snapshots` (snapshot HPP),
  `payments`, `receipt_counters` (nomor nota atomik).
* Pembelian: `suppliers`, `purchases`, `purchase_items`.
* Keuangan: `expenses`, `cash_transactions`.
* Pelanggan & QR: `customers`, `dining_tables`, `digital_orders`,
  `digital_order_items`.
* Infra: `devices`, `profiles`, `sync_operations`, `idempotency_keys`,
  `audit_logs`.

## 5. Storage (opsional)

Foto produk berupa URL saat ini menunggu fungsi mengunggah; bila nanti ingin
menggunakan Supabase Storage:

1. Bucket `product-photos`, pembayaran URL publik.
2. Insert dengan path
   `https://<ref>.supabase.co/storage/v1/object/public/product-photos/...`.

## 6. Backup

Backup otomatis tersedia di plan Supabase tertentu, atau lakukan prosedur —
lihat `docs/BACKUP.md`.
