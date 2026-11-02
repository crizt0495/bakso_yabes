# Instalasi lokal

## Prasyarat

- Node.js LTS (≥ 20) & npm
- Akun Supabase (gratis) — lihat `docs/SUPABASE.md`

## Langkah

1. **Salin env**

   ```bash
   cp .env.example .env.local
   ```

   Isi `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (atau *publishable key* bila proyek memakai format key baru).
   `SUPABASE_SERVICE_ROLE_KEY` HANYA untuk server (Vercel/dev), tidak pernah
   diakses oleh browser. `SETUP_SECRET` = string acak kuat, mis.
   `openssl rand -hex 24`.

2. **Pasang dependensi**

   ```bash
   npm install
   ```

3. **Terapkan migration** (urutan penting):

   ```bash
   # Opsional: pakai CLI Supabase
   npx supabase link --project-ref <PROYECT_REF>
   npx supabase db push
   ```
   Atau lewat **Supabase Dashboard → SQL Editor**, jalankan berurutan:
   1. `supabase/migrations/0001_init.sql`
   2. `supabase/migrations/0002_rls.sql`
   3. `supabase/migrations/0003_functions.sql`

4. **Jalankan**

   ```bash
   npm run dev
   ```

5. **Buat pemilik pertama** — buka `http://localhost:3000/setup`:
   isi `Setup Secret` (dari SETUP_SECRET), nama warung, nama lengkap,
   username, password.

6. **Login** di `/login` dengan username & password. Halaman setup boleh
   Anda abaikan setelahnya (hapus `SETUP_SECRET` dari env).

7. **Setup operasional awal** (aman dari keduanya benar-benar dipakai):
   * Produk → tambah kategori/produk/varian.
   * Stok Bahan → tambah satuan & bahan, isi stok awal (tombol “Masuk” →
     jenis “Stok awal”).
   * Resep & HPP → buat resep tiap produk.
   * QR Menu → aktifkan & cetak QR untuk meja.

## PWA di HP

Buka aplikasi di Chrome (HP) → menu “Tambahkan ke layar utama”.
Kasir offline membutuhkan PWA terpasang & perangkat utama yang sama.

## Troubleshooting

| Gejala | Sebab umum |
|---|---|
| “Server misconfigured” di log server | `SUPABASE_SERVICE_ROLE_KEY` belum diisi |
| Login selalu salah | profil pemilik belum dibuat (jalankan /setup) atau password < 8 |
| Menu kosong di kasir | belum pernah online sejak data master dibuat — tekan “Segarkan” di Kasir saat online |
| Nota tidak muncul di laporan | transaksi masih `pending_sync`; cek kartu status di Dashboard |
