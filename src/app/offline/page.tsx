import { CloudOff } from "lucide-react";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-cream px-6 text-center">
      <CloudOff className="mb-4 size-16 text-brand-300" />
      <h1 className="text-xl font-bold text-brand-900">Halaman ini butuh internet</h1>
      <p className="mt-2 max-w-sm text-sm text-gray-600">
        Perangkat sedang offline dan halaman ini belum tersimpan di cache. Kasir tetap bisa digunakan
        dari halaman yang sudah terbuka atau ikon aplikasi (PWA).
      </p>
    </main>
  );
}
