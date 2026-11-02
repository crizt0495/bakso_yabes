# Deployment Vercel

## 1. Persiapan

1. Push repo ke GitHub/GitLab (tanpa `.env.local`).
2. Impor proyek di [vercel.com](https://vercel.com) → **Add New → Project**.
3. Framework Preset: Next.js (otomatis terdeteksi).

## 2. Environment Variables (Vercel)

| Key | Nilai | Scope |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon/publishable key | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role/secret key | **Production only** (server) |
| `SETUP_SECRET` | string acak kuat (sekali pakai) | Production (hapus setelah setup) |

⚠ Jangan pernah mengekspos `SUPABASE_SERVICE_ROLE_KEY` sebagai
`NEXT_PUBLIC_*`.

## 3. Deploy

1. Klik **Deploy**. Build menjalankan `next build` (lint + typecheck).
2. Setelah deploy, buka `<url>/setup` dengan `SETUP_SECRET` → buat pemilik.
3. Hapus `SETUP_SECRET` dari Environment Variables → redeploy.
4. Login di `<url>/login`.

## 4. PWA

* `manifest.webmanifest` & `sw.js` terpasang otomatis. PWA install
  memerlukan HTTPS (Vercel otomatis). Service Worker diizinkan di `/`.
* Ikon: `/icons/icon.svg` (any + maskable).

## 5. Supabase RLS & CORS

* Tidak perlu konfigurasi CORS khusus — Supabase mengizinkan semua origin
  untuk anon key; RLS melindungi data.
* Pastikan migration teraplikasi pada proyek production (bukan hanya lokal).
* Backup Supabase diaktifkan sesuai plan.

## 6. Skala & operasional

* Satu perangkat utama menulis transaksi offline; perangkat lain hanya
  melihat data saat online.
* Rate limiting login (in-memory) cocok untuk single instance; bila
  digunakan di lingkungan serverless multi-instance, ganti ke Upstash Redis.
* Monitoring: Vercel Logs + Supabase Logs. Audit log tersimpan di
  tabel `audit_logs`.

## 7. Rollback

* Vercel → Deployments → pilih deployment sebelumnya → **Promote to
  Production**.
* Database rollback via backup SQL (lihat `docs/BACKUP.md`).
