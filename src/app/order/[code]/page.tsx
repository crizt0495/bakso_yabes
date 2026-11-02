"use client";

import { useEffect, useState } from "react";
import { Check, Clock, UtensilsCrossed, Backpack } from "lucide-react";
import { rupiah, labelStatus, tglPendek } from "@/lib/utils/format";
import { Skeleton, EmptyState } from "@/components/ui/states";

interface OrderData {
  order_code: string;
  status: string;
  customer_name: string;
  order_type: string;
  table_no: string | null;
  total: number | string;
  note: string | null;
  created_at: string;
  digital_order_items: { product_name: string; variant_name: string | null; qty: number | string; line_total: number | string }[];
}

const STEPS: [string, string][] = [
  ["new", "Diterima warung"],
  ["accepted", "Diproses dapur"],
  ["completed", "Selesai"],
];

export default function OrderStatusPage() {
  const [order, setOrder] = useState<OrderData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const code = window.location.pathname.split("/").pop() ?? "";
    let alive = true;

    void (async () => {
      try {
        const res = await fetch(`/api/public/order/${code}`);
        const data = await res.json();
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        if (alive) setOrder(data.order as OrderData);
      } catch {
        if (alive) setError("Koneksi bermasalah. Coba refresh.");
      }
    })();

    // polling status (pesanan online membutuhkan internet)
    const timer = setInterval(async () => {
      if (document.visibilityState === "hidden" || typeof code === "undefined") {
        return;
      }
      try {
        const res = await fetch(`/api/public/order/${code}`);
        if (res.ok) {
          const data = await res.json();
          if (alive) setOrder(data.order as OrderData);
        }
      } catch {
        /* biarkan data terakhir */
      }
    }, 8000);

    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  if (notFound) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-cream px-4">
        <EmptyState
          title="Pesanan tidak ditemukan"
          description="Periksa kode pesanan Anda atau hubungi kasir."
        />
      </main>
    );
  }
  if (error && !order) {
    return <main className="p-6 text-center text-sm text-gray-600">{error}</main>;
  }
  if (!order) {
    return (
      <main className="mx-auto max-w-md space-y-3 p-4">
        <Skeleton className="h-10 w-52" />
        <Skeleton className="h-24 w-full" />
      </main>
    );
  }

  const stepIdx = order.status === "new" ? 0 : order.status === "accepted" ? 1 : order.status === "completed" ? 2 : -1;

  return (
    <main className="mx-auto max-w-md bg-cream p-4">
      <h1 className="text-xl font-bold text-brand-900">Status pesanan</h1>
      <p className="mb-4 text-sm text-gray-500">Kode: {order.order_code} · {tglPendek(order.created_at)}</p>

      {stepIdx < 0 ? (
        <div className="mb-4 rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-700">
          Pesanan {labelStatus(order.status)} — hubungi kasir untuk keterangan.
        </div>
      ) : (
        <ol className="mb-4 flex flex-col gap-2">
          {STEPS.map(([s, label], i) => (
            <li key={s} className="flex items-center gap-3">
              <span
                className={`flex size-8 items-center justify-center rounded-full text-sm ${
                  i <= stepIdx ? "bg-brand-600 text-white" : "bg-gray-200 text-gray-400"
                }`}
              >
                {i <= stepIdx ? <Check className="size-4" /> : i + 1}
              </span>
              <span className={i <= stepIdx ? "font-medium text-brand-900" : "text-gray-400"}>{label}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="rounded-2xl bg-white p-4 shadow-card">
        <p className="flex items-center gap-2 text-sm text-gray-500">
          {order.order_type === "dine_in" ? <UtensilsCrossed className="size-4" /> : <Backpack className="size-4" />}
          {order.order_type === "dine_in" ? `Makan di tempat · Meja ${order.table_no ?? "-"}` : "Dibawa pulang"}
        </p>
        <ul className="mt-2 divide-y divide-brand-50 text-sm">
          {(order.digital_order_items ?? []).map((it, i) => (
            <li key={i} className="flex justify-between py-1.5">
              <span>
                {it.qty}× {it.product_name}
                {it.variant_name && ` (${it.variant_name})`}
              </span>
              <span className="tnum">{rupiah(it.line_total)}</span>
            </li>
          ))}
        </ul>
        {order.note && <p className="mt-2 text-xs italic text-gray-500">Catatan: {order.note}</p>}
        <p className="mt-3 flex items-center justify-between border-t border-brand-100 pt-2 font-semibold">
          <span>Total (dibayar di kasir)</span>
          <span className="tnum">{rupiah(order.total)}</span>
        </p>
      </div>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-gray-400">
        <Clock className="size-3.5" /> Halaman diperbarui otomatis setiap 8 detik
      </p>
    </main>
  );
}
