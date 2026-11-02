"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { expenseSchema } from "@/lib/validation/schemas";
import type { CashTransaction, Expense } from "@/types/database";
import { num, rupiah, tglPendek, hariIni } from "@/lib/utils/format";
import { profit, round2 } from "@/lib/business/hpp";
import { Button } from "@/components/ui/button";
import { Card, CardContent, Badge } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { RupiahInput } from "@/components/ui/rupiah-input";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/states";
import { ArrowDownCircle, ArrowUpCircle, Plus, Wallet } from "lucide-react";

const EXP_CATS: [string, string][] = [
  ["electricity", "Listrik"],
  ["water", "Air"],
  ["gas", "Gas / LPG"],
  ["salary", "Gaji"],
  ["transport", "Transportasi"],
  ["other", "Lainnya"],
];

export default function FinancePage() {
  const [from, setFrom] = useState(hariIni().slice(0, 8) + "01");
  const [to, setTo] = useState(hariIni());
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [cash, setCash] = useState<CashTransaction[]>([]);
  const [salesTotals, setSalesTotals] = useState({ revenue: 0, hpp: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  function reload() {
    setLoading(true);
    void (async () => {
      try {
        const supabase = supabaseBrowser();
        const [ex, cas, s] = await Promise.all([
          supabase.from("expenses").select("*").gte("spent_at", from).lte("spent_at", to).order("spent_at", { ascending: false }),
          supabase.from("cash_transactions").select("*").gte("occurred_at", `${from}T00:00:00+07:00`).lte("occurred_at", `${to}T23:59:59.999+07:00`).order("occurred_at", { ascending: false }).limit(300),
          supabase.from("sales").select("total, hpp_total, status").gte("local_day", from).lte("local_day", to),
        ]);
        if (ex.error) throw ex.error;
        setExpenses((ex.data ?? []) as unknown as Expense[]);
        setCash((cas.data ?? []) as unknown as CashTransaction[]);
        const rows = (s.data ?? []) as unknown as { total: string; hpp_total: string; status: string }[];
        const completed = rows.filter((r) => r.status === "completed");
        setSalesTotals({
          revenue: round2(completed.reduce((a, r) => a + num(r.total), 0)),
          hpp: round2(completed.reduce((a, r) => a + num(r.hpp_total), 0)),
        });
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gagal memuat");
      } finally {
        setLoading(false);
      }
    })();
  }

  useEffect(reload, [from, to]);

  const expenseTotal = useMemo(() => expenses.reduce((s, e) => s + num(e.amount), 0), [expenses]);
  const cashIn = useMemo(() => cash.filter((c) => c.direction === "in").reduce((s, c) => s + num(c.amount), 0), [cash]);
  const cashOut = useMemo(() => cash.filter((c) => c.direction === "out").reduce((s, c) => s + num(c.amount), 0), [cash]);
  const m = profit({ revenue: salesTotals.revenue, hpp: salesTotals.hpp, expenses: expenseTotal });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-900">Keuangan</h1>
          <p className="text-sm text-gray-500">
            Periode {tglPendek(from + "T00:00:00+07:00")} – {tglPendek(to + "T00:00:00+07:00")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} />
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" /> Pengeluaran
          </Button>
        </div>
      </div>

      {/* rekap */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniStat icon={ArrowUpCircle} label="Penjualan bersih" value={rupiah(salesTotals.revenue)} tone="green" />
        <MiniStat icon={Wallet} label="HPP" value={rupiah(salesTotals.hpp)} tone="yellow" />
        <MiniStat icon={ArrowDownCircle} label="Pengeluaran" value={rupiah(expenseTotal)} tone="red" />
        <MiniStat
          icon={ArrowUpCircle}
          label={m.net_profit >= 0 ? "Laba bersih" : "Rugi"}
          value={rupiah(m.net_profit)}
          sub={`Margin ${m.net_margin_pct.toFixed(1)}% · Laba kotor ${rupiah(m.gross_profit)}`}
          tone={m.net_profit >= 0 ? "green" : "red"}
        />
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold text-brand-900">
            Arus kas (dari transaksi tunai/pembersihan) — masuk {rupiah(cashIn)} · keluar {rupiah(cashOut)}
          </h2>
          <Card>
            <CardContent className="max-h-80 overflow-y-auto scroll-thin p-0">
              {cash.length === 0 ? (
                <EmptyState title="Belum ada arus kas" description="Kas otomatis tercatat dari penjualan tunai, refund & pembelian." />
              ) : (
                <ul className="divide-y divide-brand-50 text-sm">
                  {cash.map((c) => (
                    <li key={c.id} className="flex items-center justify-between px-4 py-2">
                      <div>
                        <p className="text-brand-900">{c.note ?? c.source}</p>
                        <p className="text-xs text-gray-500">{tglPendek(c.occurred_at)}</p>
                      </div>
                      <span className={`tnum font-semibold ${c.direction === "in" ? "text-brand-700" : "text-red-600"}`}>
                        {c.direction === "in" ? "+" : "-"} {rupiah(c.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold text-brand-900">Pengeluaran operasional</h2>
          <Card>
            <CardContent className="max-h-80 overflow-y-auto scroll-thin p-0">
              {expenses.length === 0 ? (
                <EmptyState title="Belum ada pengeluaran" description="Catat biaya listrik, air, gas, gaji, dsb." />
              ) : (
                <ul className="divide-y divide-brand-50 text-sm">
                  {expenses.map((e) => (
                    <li key={e.id} className="flex items-center justify-between px-4 py-2">
                      <div>
                        <p className="text-brand-900">
                          {expLabel(e.category)} — {e.description}
                        </p>
                        <p className="text-xs text-gray-500">{tglPendek(e.spent_at)}</p>
                      </div>
                      <Badge tone="red">{rupiah(e.amount)}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {error && <ErrorState message={error} />}
      {loading && <TableSkeleton rows={4} />}

      {dialogOpen && (
        <ExpenseDialog
          onClose={() => setDialogOpen(false)}
          onSaved={() => {
            setDialogOpen(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

function expLabel(c: string): string {
  return EXP_CATS.find(([k]) => k === c)?.[1] ?? c;
}

function MiniStat({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  tone: "green" | "yellow" | "red";
}) {
  const tones = {
    green: "bg-brand-100 text-brand-700",
    yellow: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-600",
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2">
          <div className={`flex size-8 items-center justify-center rounded-lg ${tones[tone]}`}>
            <Icon className="size-4" />
          </div>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
        <p className="tnum mt-1.5 text-lg font-bold text-brand-900">{value}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function ExpenseDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ category: "other", amount: "", description: "", spent_at: hariIni() });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    const parsed = expenseSchema.safeParse({
      category: form.category,
      description: form.description,
      amount: form.amount,
      spent_at: form.spent_at,
    });
    if (!parsed.success) {
      setErr(parsed.error.issues[0]?.message ?? "Data tidak valid");
      return;
    }
    setBusy(true);
    const { error: dbErr } = await supabaseBrowser().from("expenses").insert(parsed.data);
    setBusy(false);
    if (dbErr) {
      setErr(dbErr.message);
      return;
    }
    onSaved();
  }

  return (
    <Dialog open onClose={onClose} title="Catat pengeluaran" size="sm">
      <Field label="Kategori">
        <Select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as typeof f.category }))}>
          {EXP_CATS.map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Deskripsi">
        <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Token listrik" />
      </Field>
      <Field label="Jumlah (Rp)">
        <RupiahInput min={0} value={form.amount} onChange={(v) => setForm((f) => ({ ...f, amount: v > 0 ? String(v) : "" }))} />
      </Field>
      <Field label="Tanggal">
        <Input type="date" value={form.spent_at} onChange={(e) => setForm((f) => ({ ...f, spent_at: e.target.value }))} />
      </Field>
      {err && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Batal
        </Button>
        <Button onClick={() => void save()} disabled={busy}>
          {busy ? "Menyimpan…" : "Simpan"}
        </Button>
      </div>
    </Dialog>
  );
}
