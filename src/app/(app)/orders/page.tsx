"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { DigitalOrder } from "@/types/database";
import { num, rupiah, jam, labelStatus, labelOrderType } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, Badge } from "@/components/ui/card";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/states";
import { Bell, Check, X } from "lucide-react";

/** Pesanan masuk via QR Menu — pemilik menerima / menolak / menyelesaikan. */
export default function OrdersPage() {
  const [orders, setOrders] = useState<DigitalOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    setLoading(true);
    void (async () => {
      try {
        const { data, error: err } = await supabaseBrowser()
          .from("digital_orders")
          .select("*, digital_order_items(product_name, variant_name, qty, unit_price, line_total)")
          .order("created_at", { ascending: false })
          .limit(50);
        if (err) throw err;
        setOrders((data ?? []) as unknown as DigitalOrder[]);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gagal memuat pesanan");
      } finally {
        setLoading(false);
      }
    })();
  }

  useEffect(reload, []);

  const newOrders = orders.filter((o) => o.status === "new");
  const others = orders.filter((o) => o.status !== "new");

  async function setStatus(o: DigitalOrder, status: "accepted" | "rejected" | "completed") {
    const { error: err } = await supabaseBrowser()
      .from("digital_orders")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", o.id);
    if (err) {
      toast.error(err.message);
      return;
    }
    toast.success(`Pesanan ${o.order_code}: ${labelStatus(status)}`);
    reload();
  }

  function renderList(list: DigitalOrder[]) {
    return list.map((o) => (
      <Card key={o.id}>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-bold tracking-wide text-brand-900">{o.order_code}</p>
              <p className="text-xs text-gray-500">
                {labelOrderType(o.order_type)}
                {o.order_type === "dine_in" && ` · ${o.table_no ?? "-"}`} · {jam(o.created_at)}
              </p>
            </div>
            <Badge tone={o.status === "new" ? "yellow" : o.status === "accepted" ? "blue" : o.status === "completed" ? "green" : "red"}>
              {labelStatus(o.status)}
            </Badge>
          </div>

          <p className="mt-2 text-sm font-medium text-brand-900">{o.customer_name}</p>
          <ul className="mt-1 text-sm">
            {(o.digital_order_items ?? []).map((it, i) => (
              <li key={i} className="flex justify-between text-gray-700">
                <span>
                  {num(it.qty)}× {it.product_name}
                  {it.variant_name && ` (${it.variant_name})`}
                </span>
                <span className="tnum">{rupiah(it.line_total)}</span>
              </li>
            ))}
          </ul>
          {o.note && <p className="mt-1 text-xs italic text-gray-500">Catatan: {o.note}</p>}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="tnum text-base font-bold text-brand-900">
              {rupiah(o.total)} <span className="text-xs font-normal text-gray-500">dibayar saat diambil</span>
            </p>
            <div className="flex gap-2">
              {o.status === "new" && (
                <>
                  <Button variant="outline" size="sm" onClick={() => void setStatus(o, "rejected")}>
                    <X className="size-3.5" /> Tolak
                  </Button>
                  <Button size="sm" onClick={() => void setStatus(o, "accepted")}>
                    <Check className="size-3.5" /> Terima
                  </Button>
                </>
              )}
              {o.status === "accepted" && (
                <Button size="sm" onClick={() => void setStatus(o, "completed")}>
                  <Check className="size-3.5" /> Selesai
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    ));
  }

  return (
    <div className="space-y-4 min-w-0 overflow-x-hidden">
      <div>
        <h1 className="text-xl font-bold text-brand-900">Pesanan Online</h1>
        <p className="text-sm text-gray-500">Pesanan masuk lewat QR Menu membutuhkan konfirmasi Anda.</p>
      </div>

      {error && <ErrorState message={error} />}
      {loading && <TableSkeleton rows={3} />}

      {!loading && !error && (
        <>
          <section>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-brand-900">
              <Bell className="size-4 text-amber-500" /> Baru ({newOrders.length})
            </h2>
            {newOrders.length === 0 ? (
              <p className="rounded-xl bg-white p-4 text-sm text-gray-400">Tidak ada pesanan baru.</p>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">{renderList(newOrders)}</div>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-brand-900">Riwayat</h2>
            {others.length === 0 ? (
              <EmptyState title="Belum ada pesanan yang diproses" />
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">{renderList(others)}</div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
