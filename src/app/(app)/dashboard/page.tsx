"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { hariIni, num, rupiah, tglPendek, labelOrderType, labelStatus, localDay } from "@/lib/utils/format";
import { angka } from "@/lib/utils/format";
import type { Expense, Ingredient, Sale } from "@/types/database";
import { profit } from "@/lib/business/hpp";
import { useSyncStatus } from "@/features/sync/use-sync-status";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/card";
import { TableSkeleton, EmptyState } from "@/components/ui/states";
import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  BadgeDollarSign,
  Receipt,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { SyncStatusCard } from "./sync-status-card";

interface DayPoint {
  day: string;
  total: number;
}

interface DashboardData {
  todayOmzet: number;
  todayCount: number;
  todayHpp: number;
  todayExpense: number;
  monthOmzet: number;
  monthHpp: number;
  monthExpense: number;
  lowStock: Ingredient[];
  topProducts: { name: string; qty: number; revenue: number }[];
  recent: Sale[];
  series: DayPoint[];
}

function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { online, pending } = useSyncStatus();

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = supabaseBrowser();
        const today = hariIni();
        const monthStart = today.slice(0, 8) + "01";
        const desde7 = new Date();
        desde7.setDate(desde7.getDate() - 6);
        const desde7Str = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(desde7);

        // ambil data paralel
        const [salesToday, salesMonth, expenses, ingredients, topRes, recentRes] = await Promise.all([
          supabase.from("sales").select("id,receipt_no,total,hpp_total,occurred_at,order_type,status")
            .eq("status", "completed")
            .gte("local_day", today).lte("local_day", today),
          supabase.from("sales").select("id,receipt_no,total,hpp_total,local_day,occurred_at,order_type,status")
            .eq("status", "completed")
            .gte("local_day", monthStart).lte("local_day", today)
            .gte("occurred_at", `${desde7Str}T00:00:00+07:00`),
          supabase.from("expenses").select("category,description,amount,spent_at").gte("spent_at", monthStart).lte("spent_at", today),
          supabase.from("ingredients").select("*, stock_balances(qty,avg_cost), units(symbol)").eq("is_active", true).order("name"),
          supabase.from("sales").select("*, sale_items(product_name, qty, line_total)")
            .eq("status", "completed").gte("local_day", monthStart).lte("local_day", today),
          supabase.from("sales").select("*, payments(method)")
            .order("occurred_at", { ascending: false }).limit(6),
        ]);

        if (salesToday.error) throw salesToday.error;
        if (salesMonth.error) throw salesMonth.error;
        if (expenses.error) throw expenses.error;
        if (ingredients.error) throw ingredients.error;
        if (topRes.error) throw topRes.error;
        if (recentRes.error) throw recentRes.error;

        const st = (salesToday.data ?? []) as unknown as Sale[];
        const sm = (salesMonth.data ?? []) as unknown as Sale[];
        const exp = (expenses.data ?? []) as unknown as Expense[];
        const monthSalesAll = (salesMonth.data ?? []) as unknown as Sale[];
        const ingredientsRows = (ingredients.data ?? []) as unknown as Ingredient[];

        // — omzet & HPP hari ini
        const todayOmzet = st.reduce((s, x) => s + num(x.total), 0);
        const todayHpp = st.reduce((s, x) => s + num(x.hpp_total), 0);
        const todayExpense = exp
          .filter((e) => e.spent_at === today)
          .reduce((s, e) => s + num(e.amount), 0);

        // — ringkasan bulan
        const monthOmzet = sm.reduce((s, x) => s + num(x.total), 0);
        const monthHpp = sm.reduce((s, x) => s + num(x.hpp_total), 0);
        const monthExpense = exp.reduce((s, e) => s + num(e.amount), 0);

        // — stok hampir habis
        const lowStock = ingredientsRows.filter((i) => num(i.stock_balances?.qty) <= num(i.minimum_stock));

        // — produk terlaris (bulan ini)
        const byProduct = new Map<string, { name: string; qty: number; revenue: number }>();
        for (const sale of monthSalesAll) {
          for (const item of (sale as any).sale_items ?? []) {
            const cur = byProduct.get(item.product_name) ?? { name: item.product_name, qty: 0, revenue: 0 };
            cur.qty += num(item.qty);
            cur.revenue += num(item.line_total);
            byProduct.set(item.product_name, cur);
          }
        }
        const topProducts = [...byProduct.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);

        // — grafik 7 hari terakhir
        const seriesMap = new Map<string, number>();
        for (const sale of monthSalesAll) {
          const day = sale.local_day ?? localDay(sale.occurred_at);
          seriesMap.set(day, (seriesMap.get(day) ?? 0) + num(sale.total));
        }
        const series: DayPoint[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(d);
          series.push({ day, total: seriesMap.get(day) ?? 0 });
        }

        if (!active) return;
        setData({
          todayOmzet,
          todayCount: st.length,
          todayHpp,
          todayExpense,
          monthOmzet,
          monthHpp,
          monthExpense,
          lowStock,
          topProducts,
          recent: (recentRes.data ?? []) as unknown as Sale[],
          series,
        });
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Gagal memuat dashboard");
      }
    })();
    return () => {
      active = false;
    };
  }, [online, pending]);

  if (error) return <EmptyState title="Gagal memuat data" description={error} />;
  if (!data) return <TableSkeleton rows={8} />;

  const m = profit({ revenue: data.monthOmzet, hpp: data.monthHpp, expenses: data.monthExpense });
  const d = profit({ revenue: data.todayOmzet, hpp: data.todayHpp, expenses: data.todayExpense });

  const maxSeries = Math.max(1, ...data.series.map((p) => p.total));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-brand-900">Dashboard</h1>
        <p className="text-sm text-gray-500">
          Ringkasan bisnis · {tglPendek(new Date())} · Zona waktu Asia/Jakarta
        </p>
      </div>

      {/* Status koneksi & sinkronisasi */}
      <SyncStatusCard />

      {/* Statistik hari ini */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <StatCard icon={ShoppingBag} title="Omzet hari ini" value={rupiah(data.todayOmzet)} tone="green" />
        <StatCard icon={Receipt} title="Transaksi hari ini" value={`${data.todayCount} transaksi`} />
        <StatCard icon={BadgeDollarSign} title="HPP hari ini" value={rupiah(data.todayHpp)} tone="yellow" />
        <StatCard
          icon={d.gross_profit >= 0 ? TrendingUp : TrendingDown}
          title="Laba kotor hari ini"
          value={rupiah(d.gross_profit)}
          tone={d.gross_profit >= 0 ? "green" : "red"}
        />
      </section>

      {/* Ringkasan bulan ini */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={Wallet} title="Omzet bulan ini" value={rupiah(data.monthOmzet)} />
        <StatCard icon={BadgeDollarSign} title="HPP bulan ini" value={rupiah(data.monthHpp)} tone="yellow" />
        <StatCard icon={TrendingDown} title="Pengeluaran bulan ini" value={rupiah(data.monthExpense)} tone="red" />
        <StatCard
          icon={ArrowUpRight}
          title="Laba bersih (bulan ini)"
          value={rupiah(m.net_profit)}
          sub={`Margin ${angka(m.net_margin_pct, 1)}%`}
          tone={m.net_profit >= 0 ? "green" : "red"}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {/* Grafik penjualan 7 hari */}
        <Card className="lg:col-span-2">
          <CardContent className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-brand-900">Penjualan 7 hari terakhir</h2>
            <Chart7 series={data.series} max={maxSeries} />
          </CardContent>
        </Card>

        {/* Stok menipis */}
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-brand-900">Stok hampir habis</h2>
            </div>
            {data.lowStock.length === 0 ? (
              <p className="text-sm text-gray-500">Semua stok aman 👍</p>
            ) : (
              <ul className="space-y-2">
                {data.lowStock.slice(0, 6).map((i) => (
                  <li key={i.id} className="flex items-center justify-between text-sm">
                    <span className="truncate text-gray-700">{i.name}</span>
                    <Badge tone={num(i.stock_balances?.qty) <= 0 ? "red" : "yellow"}>
                      {angka(num(i.stock_balances?.qty), 2)} {i.units?.symbol ?? ""}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {/* Produk terlaris */}
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <Boxes className="size-4 text-brand-500" />
              <h2 className="text-sm font-semibold text-brand-900">Produk terlaris (bulan ini)</h2>
            </div>
            {data.topProducts.length === 0 ? (
              <p className="text-sm text-gray-500">Belum ada penjualan bulan ini.</p>
            ) : (
              <ol className="space-y-2">
                {data.topProducts.map((p, idx) => (
                  <li key={p.name} className="flex items-center gap-3 text-sm">
                    <span className="flex size-6 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-800">
                      {idx + 1}
                    </span>
                    <span className="flex-1 truncate text-gray-700">{p.name}</span>
                    <span className="tnum text-gray-500">{angka(p.qty)} terjual</span>
                    <span className="tnum font-medium text-brand-700">{rupiah(p.revenue)}</span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        {/* Transaksi terbaru */}
        <Card>
          <CardContent className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-brand-900">Transaksi terbaru</h2>
            {data.recent.length === 0 ? (
              <p className="text-sm text-gray-500">Belum ada transaksi.</p>
            ) : (
              <ul className="divide-y divide-brand-50">
                {data.recent.map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div>
                      <p className="font-medium text-brand-900">{s.receipt_no}</p>
                      <p className="text-xs text-gray-500">
                        {tglPendek(s.occurred_at)} · {labelOrderType(s.order_type)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="tnum font-medium">{rupiah(s.total)}</p>
                      <Badge tone={s.status === "completed" ? "green" : "red"}>
                        {labelStatus(s.status)}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

/* ---------- sub-komponen ---------- */
const TONES: Record<string, { wrap: string; icon: string }> = {
  gray: { wrap: "", icon: "bg-gray-100 text-gray-600" },
  green: { wrap: "", icon: "bg-brand-100 text-brand-700" },
  yellow: { wrap: "", icon: "bg-amber-100 text-amber-700" },
  red: { wrap: "", icon: "bg-red-100 text-red-600" },
};

function StatCard({
  icon: Icon,
  title,
  value,
  sub,
  tone = "gray",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: string;
  sub?: string;
  tone?: "gray" | "green" | "yellow" | "red";
}) {
  const t = TONES[tone] ?? TONES.gray;
  return (
    <Card className={t.wrap}>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${t.icon}`}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs text-gray-500">{title}</p>
          <p className="tnum truncate text-base font-bold text-brand-900">{value}</p>
          {sub && <p className="text-xs text-gray-400">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function Chart7({ series, max }: { series: DayPoint[]; max: number }) {
  const fmt = (d: string) =>
    new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", weekday: "short" }).format(new Date(d + "T00:00:00+07:00"));
  return (
    <div className="flex h-40 items-end gap-2">
      {series.map((p) => (
        <div key={p.day} className="flex flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-t-lg bg-brand-200 transition-all"
            style={{ height: `${max > 0 ? Math.max(3, (p.total / max) * 100) : 3}%` }}
            title={rupiah(p.total)}
          />
          <span className="text-[10px] text-gray-400">{fmt(p.day)}</span>
        </div>
      ))}
    </div>
  );
}

export default DashboardPage;
