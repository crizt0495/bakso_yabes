"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Expense, Purchase, Sale } from "@/types/database";
import { num, rupiah, angka, hariIni } from "@/lib/utils/format";
import { profit } from "@/lib/business/hpp";
import { Button } from "@/components/ui/button";
import { Card, CardContent, Badge } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ErrorState, TableSkeleton } from "@/components/ui/states";
import { Download, FileSpreadsheet, Printer } from "lucide-react";

/**
 * Laporan — angka dari data transaksi & pergerakan nyata.
 * Ekspor: CSV (kompatibel Excel), CSV tanda pemisah mentah, dan PDF via print.
 */
export default function ReportsPage() {
  const [from, setFrom] = useState(hariIni().slice(0, 8) + "01");
  const [to, setTo] = useState(hariIni());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [itemsFlat, setItemsFlat] = useState<{ name: string; qty: number; revenue: number }[]>([]);

  function reload() {
    setLoading(true);
    void (async () => {
      try {
        const supabase = supabaseBrowser();
        const [s, ex, pu] = await Promise.all([
          supabase.from("sales").select("*").gte("local_day", from).lte("local_day", to).order("occurred_at", { ascending: false }).limit(2000),
          supabase.from("expenses").select("*").gte("spent_at", from).lte("spent_at", to),
          supabase.from("purchases").select("*, purchase_items(qty, unit_cost, line_total)").gte("purchase_date", from).lte("purchase_date", to),
        ]);
        if (s.error) throw s.error;
        setSales((s.data ?? []) as unknown as Sale[]);
        setExpenses((ex.data ?? []) as unknown as Expense[]);
        setPurchases((pu.data ?? []) as unknown as Purchase[]);

        // item level untuk per produk
        const { data: items, error: itErr } = await supabase
          .from("sale_items")
          .select("product_name, variant_name, qty, line_total, sale_id");
        if (itErr) throw itErr;
        const salesIds = new Set(((s.data ?? []) as unknown as Sale[]).filter((x) => x.status === "completed").map((x) => x.id));
        const byProduct = new Map<string, { name: string; qty: number; revenue: number }>();
        for (const it of (items ?? []) as unknown as { product_name: string; variant_name: string | null; qty: string; line_total: string; sale_id: string }[]) {
          if (!salesIds.has(it.sale_id)) continue;
          const key = it.variant_name ? `${it.product_name} (${it.variant_name})` : it.product_name;
          const cur = byProduct.get(key) ?? { name: key, qty: 0, revenue: 0 };
          cur.qty += num(it.qty);
          cur.revenue += num(it.line_total);
          byProduct.set(key, cur);
        }
        setItemsFlat([...byProduct.values()].sort((a, b) => b.revenue - a.revenue));
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gagal memuat laporan");
      } finally {
        setLoading(false);
      }
    })();
  }

  useEffect(reload, [from, to]);

  const completed = useMemo(() => sales.filter((s) => s.status === "completed"), [sales]);
  const revenue = completed.reduce((a, s) => a + num(s.total), 0);
  const hpp = completed.reduce((a, s) => a + num(s.hpp_total), 0);
  const expenseTotal = expenses.reduce((a, e) => a + num(e.amount), 0);
  const purchaseTotal = purchases.reduce((a, p) => a + num(p.total), 0);
  const m = profit({ revenue, hpp, expenses: expenseTotal });

  const daily = useMemo(() => {
    const map = new Map<string, { day: string; count: number; revenue: number; hpp: number }>();
    for (const s of completed) {
      const d = s.local_day ?? s.occurred_at.slice(0, 10);
      const cur = map.get(d) ?? { day: d, count: 0, revenue: 0, hpp: 0 };
      cur.count += 1;
      cur.revenue += num(s.total);
      cur.hpp += num(s.hpp_total);
      map.set(d, cur);
    }
    return [...map.values()].sort((a, b) => b.day.localeCompare(a.day));
  }, [completed]);

  const voided = useMemo(() => sales.filter((s) => s.status !== "completed"), [sales]);

  /* ---------- Ekspor ---------- */
  function downloadCsv(filename: string, rows: (string | number)[][]) {
    const csv = rows
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
      .join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }); // BOM agar Excel aman
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportSummary() {
    downloadCsv(`laporan-${from}_${to}.csv`, [
      ["Laporan BaksoKu", from, "s/d", to],
      [],
      ["Ringkasan", "Nilai"],
      ["Penjualan bersih", round2v(revenue)],
      ["Jumlah transaksi selesai", completed.length],
      ["HPP", round2v(hpp)],
      ["Laba kotor", round2v(m.gross_profit)],
      ["Pengeluaran operasional", round2v(expenseTotal)],
      ["Laba bersih", round2v(m.net_profit)],
      ["Margin bersih (%)", round2v(m.net_margin_pct)],
      ["Pembelian bahan", round2v(purchaseTotal)],
      [],
      ["Per produk", "Qty", "Omzet"],
      ...itemsFlat.map((i) => [i.name, round2v(i.qty), round2v(i.revenue)]),
      [],
      ["Per hari", "Transaksi", "Omzet", "HPP"],
      ...daily.map((d) => [d.day, d.count, round2v(d.revenue), round2v(d.hpp)]),
    ]);
  }

  function exportTransactions() {
    downloadCsv(`transaksi-${from}_${to}.csv`, [
      ["Nota", "Waktu", "Tipe", "Status", "Subtotal", "Diskon", "Total", "HPP", "Laba kotor", "Alasan batal"],
      ...sales.map((s) => [
        s.receipt_no,
        s.occurred_at,
        s.order_type,
        s.status,
        round2v(num(s.subtotal)),
        round2v(num(s.discount)),
        round2v(num(s.total)),
        round2v(num(s.hpp_total)),
        round2v(num(s.total) - num(s.hpp_total)),
        s.void_reason ?? "",
      ]),
    ]);
  }

  function printPdf() {
    window.print();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-900">Laporan</h1>
          <p className="text-sm text-gray-500">Semua angka dihitung dari data transaksi nyata.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input type="date" className="w-36" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" className="w-36" value={to} onChange={(e) => setTo(e.target.value)} />
          <Button variant="outline" onClick={exportSummary}>
            <FileSpreadsheet className="size-4" /> Excel/CSV
          </Button>
          <Button variant="outline" onClick={exportTransactions}>
            <Download className="size-4" /> Transaksi CSV
          </Button>
          <Button variant="outline" onClick={printPdf}>
            <Printer className="size-4" /> PDF/Print
          </Button>
        </div>
      </div>

      {error && <ErrorState message={error} />}
      {loading && <TableSkeleton rows={6} />}

      {!loading && !error && (
        <div id="reports-print" className="space-y-4">
          {/* ringkasan */}
          <Card>
            <CardContent className="p-4">
              <h2 className="mb-3 text-sm font-semibold text-brand-900">Ringkasan periode</h2>
              <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
                <KV label="Penjualan bersih" value={rupiah(revenue)} />
                <KV label="Transaksi selesai" value={`${completed.length}`} />
                <KV label="HPP" value={rupiah(hpp)} />
                <KV label="Laba kotor" value={rupiah(m.gross_profit)} />
                <KV label="Pengeluaran" value={rupiah(expenseTotal)} />
                <KV label="Laba bersih" value={`${rupiah(m.net_profit)} (${angka(m.net_margin_pct, 1)}%)`} strong />
                <KV label="Pembelian bahan" value={rupiah(purchaseTotal)} />
                <KV label="Pembatalan/refund" value={`${voided.length} transaksi`} />
              </div>
            </CardContent>
          </Card>

          {/* per hari */}
          <Card>
            <CardContent className="p-0">
              <h2 className="px-4 pt-4 text-sm font-semibold text-brand-900">Penjualan harian</h2>
              <table className="mt-2 w-full text-sm">
                <thead>
                  <tr className="border-b border-brand-100 text-left text-xs uppercase text-gray-500">
                    <th className="px-4 py-2">Tanggal</th>
                    <th className="px-4 py-2 text-center">Transaksi</th>
                    <th className="px-4 py-2 text-right">Omzet</th>
                    <th className="px-4 py-2 text-right">HPP</th>
                    <th className="px-4 py-2 text-right">Laba kotor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-50">
                  {daily.map((d) => (
                    <tr key={d.day}>
                      <td className="px-4 py-2">{d.day}</td>
                      <td className="tnum px-4 py-2 text-center">{d.count}</td>
                      <td className="tnum px-4 py-2 text-right">{rupiah(d.revenue)}</td>
                      <td className="tnum px-4 py-2 text-right">{rupiah(d.hpp)}</td>
                      <td className="tnum px-4 py-2 text-right font-medium text-brand-700">{rupiah(d.revenue - d.hpp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* per produk */}
          <Card>
            <CardContent className="p-0">
              <h2 className="px-4 pt-4 text-sm font-semibold text-brand-900">Penjualan per produk</h2>
              <table className="mt-2 w-full text-sm">
                <thead>
                  <tr className="border-b border-brand-100 text-left text-xs uppercase text-gray-500">
                    <th className="px-4 py-2">Produk</th>
                    <th className="px-4 py-2 text-center">Qty</th>
                    <th className="px-4 py-2 text-right">Omzet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-50">
                  {itemsFlat.map((p, i) => (
                    <tr key={p.name}>
                      <td className="px-4 py-2">{i + 1}. {p.name}</td>
                      <td className="tnum px-4 py-2 text-center">{angka(p.qty, 2)}</td>
                      <td className="tnum px-4 py-2 text-right">{rupiah(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* batal/refund */}
          <Card>
            <CardContent className="p-0">
              <h2 className="px-4 pt-4 text-sm font-semibold text-brand-900">Pembatalan & refund</h2>
              {voided.length === 0 ? (
                <p className="px-4 py-4 text-sm text-gray-400">Tidak ada pada periode ini 👍</p>
              ) : (
                <table className="mt-2 w-full text-sm">
                  <thead>
                    <tr className="border-b border-brand-100 text-left text-xs uppercase text-gray-500">
                      <th className="px-4 py-2">Nota</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Alasan</th>
                      <th className="px-4 py-2 text-right">Nilai</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-50">
                    {voided.map((s) => (
                      <tr key={s.id}>
                        <td className="px-4 py-2 font-medium">{s.receipt_no}</td>
                        <td className="px-4 py-2">
                          <Badge tone="red">{s.status}</Badge>
                        </td>
                        <td className="px-4 py-2 text-gray-600">{s.void_reason}</td>
                        <td className="tnum px-4 py-2 text-right">{rupiah(s.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function KV({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`tnum font-semibold text-brand-900 ${strong ? "text-lg" : ""}`}>{value}</p>
    </div>
  );
}

function round2v(n: number): number {
  return Math.round(n * 100) / 100;
}
