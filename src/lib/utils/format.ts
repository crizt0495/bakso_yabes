/** Format & util waktu — semua uang & tanggal pakai standar Indonesia. */

export function rupiah(value: number | string | null | undefined, suffix = true): string {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  if (!Number.isFinite(n)) return "Rp 0";
  // tingkat thousand: <1000 menampilkan "Rp 1.000", <10.000 menampilkan ribuan kalau
  // diperlukan agar merchant/admin mudah baca; tapi tidak memperkalkan salah formatting
  const formatted = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
  return suffix ? formatted : String(formatted).replace(/^\D+/, "");
}

export function rupiahWithThousand(value: number | string | null | undefined): string {
  // Format dalam ribuan separasi: 15 → "Rp 15", 1.000 → "Rp 1.000", 1.000.000 → "Rp 1.000.000"
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  if (!Number.isFinite(n)) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export function kodeRupiah(value: number | string | null | undefined): string {
  // Tampilan angka tanpa satuan ("1.000.000") dan abaikan "+/-" leading — buat
  // "nominal auto ribuan": gunakan compact separasi bila jumlah besar, biasa bila kecil
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("id-ID", {
    minimumIntegerDigits: 1,
    maximumFractionDigits: 0,
  }).format(n);
}

export function angka(value: number | string | null | undefined, digits = 0): string {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: digits,
  }).format(Number.isFinite(n) ? n : 0);
}

/** Konversi numeric Postgres (di-return sbg string) ke number. */
export function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

type Opts = { withTime?: boolean };
const TZ = "Asia/Jakarta";

export function tglPanjang(iso: string | Date | null | undefined, opts: Opts = {}): string {
  if (!iso) return "-";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: TZ,
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(opts.withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(d);
}

export function tglPendek(iso: string | Date | null | undefined): string {
  if (!iso) return "-";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function jam(iso: string | Date | null | undefined): string {
  if (!iso) return "-";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** ISO string mengikuti hari kalender Asia/Jakarta (dipakai utk .gte/.lte). */
export function jakartaDayStart(date: string): string {
  // Supabase terima ISO; UTC offset Jakarta +07:00
  return `${date}T00:00:00+07:00`;
}
export function jakartaDayEnd(date: string): string {
  return `${date}T23:59:59.999+07:00`;
}

/** Tanggal hari ini (kalender Asia/Jakarta) dalam format YYYY-MM-DD. */
export function hariIni(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

/** Tanggal lokal Indonesia saat pesanan/transaksi dibuat, dari ISO apa pun. */
export function localDay(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));
}

export function labelOrderType(t: string | null | undefined): string {
  return t === "dine_in" ? "Makan di tempat" : "Dibawa pulang";
}

export function labelStatus(status: string | null | undefined): string {
  const m: Record<string, string> = {
    completed: "Selesai",
    voided: "Dibatalkan",
    refunded: "Direfund",
    new: "Baru",
    accepted: "Diterima",
    rejected: "Ditolak",
    cancelled: "Dibatalkan",
    pending_sync: "Menunggu sinkron",
    syncing: "Menyinkronkan",
    synced: "Tersinkron",
    failed: "Gagal",
    conflict: "Konflik",
    prepared: "Siap",
  };
  return m[status ?? ""] ?? (status ?? "-");
}
