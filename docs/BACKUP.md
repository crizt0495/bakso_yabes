# Backup & pemulihan data

## 1. Backup Supabase (rekomendasi utama)

### Otomatis (plan Pro)
* Database → Backups: harian otomatis, PITR (Point-in-Time Recovery).
* Storage: bucket product-photos (bila dipakai) ikut di-backup.

### Manual via CLI
```bash
# instal CLI: npm i -g supabase
supabase db dump --linked -f backups/baksoku-$(date +%F).sql
# atau dump schema + data terpisah
supabase db dump --linked -f backups/schema.sql
supabase db dump --linked --data-only -f backups/data.sql
```

Jadwalkan via cron (contoh harian jam 02:00 WIB):
```cron
0 2 * * * cd /home/chris/Documents/aplikasi/bakso_yabes && supabase db dump --linked -f backups/baksoku-$(date +\%F).sql
```

## 2. Backup JSON dari aplikasi (ringan, tanpa CLI)

Menu **Pengaturan → Data & konsistensi → Backup (JSON)** mengunduh
`baksoku-backup-YYYY-MM-DD.json` berisi sales, expenses, purchases, ingredients
(≤ 5000 baris). Cocok sebagai snapshot cepat, bukan pengganti backup DB.

## 3. Ekspor laporan

Menu **Laporan** menyediakan ekspor CSV (kompatibel Excel) & Transaksi CSV
untuk arsip independen. PDF via print.

## 4. Pemulihan

### A. Dari backup SQL
1. Buat proyek Supabase baru (atau reset).
2. `supabase db reset` lalu apply migration berurutan (0001→0003).
3. Restore: `psql <connection> -f backups/baksoku-YYYY-MM-DD.sql`.
4. Buat ulang akun pemilik (via /setup) — auth.users tidak ikut dump.

### B. Dari backup JSON
* Tidak mendukung restore otomatis. Buat skrip yang membaca JSON dan
  `insert` ke tabel yang sesuai (perhatikan FK). Lebih cocok untuk audit
  manual daripada disaster recovery.

### C. IndexedDB lokal (perangkat)
* Bila data server hilang tetapi perangkat masih memegang antrean
  (`pending_sync`), buka aplikasi → item akan dikirim ulang ke server baru
  (dengan idempotency key) — **asalkan server baru punya idempotency key
  yang sama kosong**.
* Bila perangkat direset, IndexedDB hilang — jangan andalkan ini.

## 5. Checklist keandalan

- [ ] Backup SQL harian + uji restore minimal bulanan.
- [ ] Backup JSON sebelum perubahan besar (update app, opname).
- [ ] Simpan backup di lokasi terpisah (Drive/USB, bukan cuma perangkat kasir).
- [ ] Cek `rpc_stock_reconcile()` rutin (mingguan) untuk mendeteksi drift.
- [ ] Simpan `.env.local`/Vercel env di password manager (bukan di git).
