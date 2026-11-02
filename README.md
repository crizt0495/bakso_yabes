# BaksoKu 🍜

**BaksoKu** adalah aplikasi manajemen warung bakso: kasir (online + offline),
stok bahan otomatis lewat resep, resep & HPP, pembelian, keuangan, pelanggan,
QR Menu pelanggan, dan laporan lengkap — dibangun untuk satu pemilik yang
merangkap kasir, dipakai di HP maupun laptop.

## Stack

| Lapisan | Teknologi |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS |
| UI kit | Komponen gaya shadcn/ui (cva + tailwind-merge), ikon Lucide, toast sonner |
| Database | Supabase (PostgreSQL) dengan RLS & RPC atomik |
| Auth | Supabase Auth, login **username** (pemetaan email dilakukan di server) |
| Offline | IndexedDB via Dexie.js, PWA + Service Worker, antrean sinkron idempotent |
| Validasi | Zod (dipakai di klien & server) |
| Testing | Vitest (unit) & Playwright (E2E, HP + desktop) |
| Deployment | Vercel |

## Mulai cepat (lokal)

```bash
cp .env.example .env.local     # isi kredensial (lihat docs/SUPABASE.md)
npm install
npx supabase link --project-ref <ref>      # atau jalankan SQL via SQL Editor
# terapkan migration berurutan:
#   supabase/migrations/0001_init.sql
#   supabase/migrations/0002_rls.sql
#   supabase/migrations/0003_functions.sql
npm run dev
```

Selanjutnya:

1. Buka `/setup` untuk membuat akun pemilik pertama (butuh `SETUP_SECRET`).
2. Login di `/login` dengan username & password.
3. Mulai dari Produk → Resep & HPP → Stok Bahan → siap menjual di Kasir.

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Server development |
| `npm run build` / `start` | Build & jalankan produksi |
| `npm run typecheck` | Pemeriksaan TypeScript |
| `npm run lint` | ESLint (Next) |
| `npm test` | Unit test (Vitest) |
| `npm run test:e2e` | E2E (Playwright; jalankan `npm run dev` dulu, atau biarkan config memulainya) |

## Panduan fungsional (ringkas)

- **Kasir (`/pos`)**: pilih produk/varian, catatan per item, diskon, makan di
  tempat (pilih meja) atau bawa pulang, tunai/QRIS, kembalian, struk cetak.
  Tanpa internet pun terus berjalan — transaksi disimpan di perangkat dan
  dikirim otomatis saat online (lihat docs/OFFLINE.md).
- **Produk & kategori**, variasi, urutan tampil, aktif/nonaktif/habis.
- **Resep & HPP**: takaran bahan per porsi, HPP dihitung dari biaya rata-rata
  bahan, margin per varian. Transaksi menyimpan snapshot resep.
- **Stok Bahan**: saldo, masuk/keluar/opname (semuanya melalui jurnal
  `stock_movements`), nilai persediaan, peringatan stok menipis.
- **Pembelian**: pemasok, item, harga satuan; konfirmasi menambah stok &
  memperbarui biaya rata-rata tertimbang (TIDAK langsung dihitung HPP).
- **Keuangan**: pengeluaran (listrik/air/gas/gaji/transport/lainnya), arus kas,
  laba kotor & bersih.
- **Pelanggan**, opsional per transaksi.
- **QR Menu**: URL publik + QR per meja (`?table=5`), pesanan online perlu
  konfirmasi pemilik di menu Pesanan.
- **Laporan**: per hari/periode/produk, pembatalan & refund, ekspor
  Excel/CSV dan PDF (print).

## Dokumentasi lanjut

| File | Isi |
|---|---|
| `docs/INSTALL.md` | instalasi lokal terperinci |
| `docs/SUPABASE.md` | setup Supabase, migration, RLS, urutan SQL |
| `docs/ARCHITECTURE.md` | keputusan arsitektur, metode biaya persediaan, anti-duplikat |
| `docs/OFFLINE.md` | offline-first: Dexie, sync engine, idempotency, rekonsiliasi |
| `docs/BACKUP.md` | backup & pemulihan data |
| `docs/DEPLOYMENT.md` | deployment Vercel langkah demi langkah |
