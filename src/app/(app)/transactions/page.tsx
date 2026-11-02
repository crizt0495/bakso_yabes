"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Payment, Sale, SaleItem } from "@/types/database";
import { num, rupiah, tglPendek, jam, labelOrderType, labelStatus, hariIni } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, Badge } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/states";
import { Eye, RotateCcw, XCircle } from "lucide-react";

export default function TransactionsPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [from, setFrom] = useState(hariIni());
  const [to, setTo] = useState(hariIni());
  const [statusF, setStatusF] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Sale | null>(null);
  const [voidTarget, setVoidTarget] = useState<{ sale: Sale; mode: "void" | "refund" } | null>(null);

  function reload() {
    setLoading(true);
    void (async () => {
      try {
        let query = supabaseBrowser()
          .from("sales")
          .select("*, payments(method, status)")
          .gte("local_day", from)
          .lte("local_day", to)
          .order("occurred_at", { ascending: false })
          .limit(200);
        if (statusF !== "all") query = query.eq("status", statusF);
        const { data, error: err } = await query;
        if (err) throw err;
        setSales((data ?? []) as unknown as Sale[]);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gagal memuat transaksi");
      } finally {
        setLoading(false);
      }
    })();
  }

  useEffect(reload, [from, to, statusF]);

  const omzet = sales.filter((s) => s.status === "completed").reduce((s, x) => s + num(x.total), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-900">Transaksi</h1>
          <p className="text-sm text-gray-500">
            {omzet > 0 && (<>Omzet periode: <b className="tnum">{rupiah(omzet)}</b> · </>)}
            {sales.length} catatan
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} />
          <Select className="w-40" value={statusF} onChange={(e) => setStatusF(e.target.value)}>
            <option value="all">Semua status</option>
            <option value="completed">Selesai</option>
            <option value="voided">Dibatalkan</option>
            <option value="refunded">Direfund</option>
          </Select>
        </div>
      </div>

      {error && <ErrorState message={error} />}
      {loading && <TableSkeleton rows={5} />}

      {!loading && !error && (sales.length === 0 ? (
        <EmptyState title="Tidak ada transaksi" description="Belum ada transaksi pada periode ini." />
      ) : (
        <TransactionList
          sales={sales}
          onDetail={setDetail}
          onVoid={(s, m) => setVoidTarget({ sale: s, mode: m })}
        />
      ))}

      {detail && (
        <SaleDetail
          sale={detail}
          onClose={() => setDetail(null)}
          onDone={() => {
            setDetail(null);
            reload();
          }}
          onVoid={(s, m) => setVoidTarget({ sale: s, mode: m })}
        />
      )}

      {voidTarget && (
        <VoidDialog
          sale={voidTarget.sale}
          mode={voidTarget.mode}
          onClose={() => setVoidTarget(null)}
          onDone={() => {
            setVoidTarget(null);
            setDetail(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function TransactionList({
  sales,
  onDetail,
  onVoid,
}: {
  sales: Sale[];
  onDetail: (s: Sale) => void;
  onVoid: (s: Sale, mode: "void" | "refund") => void;
}) {
  return (
    <>
      {/* desktop */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-100 text-left text-xs uppercase text-gray-500">
                <th className="px-4 py-3">Nota</th>
                <th className="px-4 py-3">Waktu</th>
                <th className="px-4 py-3">Tipe</th>
                <th className="px-4 py-3">Pembayaran</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-50">
              {sales.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2.5 font-medium text-brand-900">{s.receipt_no}</td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {tglPendek(s.occurred_at)} {jam(s.occurred_at)}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{labelOrderType(s.order_type)}</td>
                  <td className="px-4 py-2.5 uppercase text-gray-600">{(s.payments as Payment[] | undefined)?.[0]?.method === "cash" ? "Tunai" : "QRIS"}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={s.status === "completed" ? "green" : "red"}>{labelStatus(s.status)}</Badge>
                  </td>
                  <td className="tnum px-4 py-2.5 text-right font-semibold">{rupiah(s.total)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => onDetail(s)} aria-label="Detail transaksi">
                        <Eye className="size-4" />
                      </Button>
                      {s.status === "completed" && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => onVoid(s, "void")} aria-label="Batalkan transaksi">
                            <XCircle className="size-4 text-red-500" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => onVoid(s, "refund")} aria-label="Refund transaksi">
                            <RotateCcw className="size-4 text-amber-500" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* mobile */}
      <div className="grid gap-3 md:hidden">
        {sales.map((s) => (
          <Card key={s.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-brand-900">{s.receipt_no}</p>
                  <p className="text-xs text-gray-500">
                    {tglPendek(s.occurred_at)} {jam(s.occurred_at)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="tnum font-semibold">{rupiah(s.total)}</p>
                  <Badge tone={s.status === "completed" ? "green" : "red"}>{labelStatus(s.status)}</Badge>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="outline" size="sm" onClick={() => onDetail(s)}>
                  <Eye className="size-3.5" /> Detail
                </Button>
                {s.status === "completed" && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => onVoid(s, "void")}>
                      <XCircle className="size-3.5" /> Batalkan
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => onVoid(s, "refund")}>
                      <RotateCcw className="size-3.5" /> Refund
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

/* ---------- detail ---------- */
interface Snapshot {
  ingredient_id: string | null;
  ingredient_name: string;
  qty: string | number;
  consumed_qty: string | number;
  unit_symbol: string | null;
  unit_cost: string | number;
  line_cost: string | number;
}

function SaleDetail({
  sale,
  onClose,
  onDone,
  onVoid,
}: {
  sale: Sale;
  onClose: () => void;
  onDone: () => void;
  onVoid: (s: Sale, mode: "void" | "refund") => void;
}) {
  const [items, setItems] = useState<SaleItem[] | null>(null);
  const [snap, setSnap] = useState<Snapshot[] | null>(null);

  useEffect(() => {
    void (async () => {
      const { data, error: e } = await supabaseBrowser().from("sale_items").select("*").eq("sale_id", sale.id);
      setItems((data ?? []) as unknown as SaleItem[]);
      if (e) console.error(e);
      const itemIds = ((data ?? []) as unknown as SaleItem[]).map((i) => i.id);
      if (itemIds.length > 0) {
        const { data: sn, error: e2 } = await supabaseBrowser()
          .from("sale_item_recipe_snapshots")
          .select("ingredient_id, ingredient_name, qty, consumed_qty, unit_symbol, unit_cost, line_cost")
          .filter("sale_item_id", "in", `(${itemIds.join(",")})`);
        if (e2) console.error(e2);
        setSnap((sn ?? []) as unknown as Snapshot[]);
      }
    })();
  }, [sale.id]);

  return (
    <Dialog open onClose={onClose} title={`Nota ${sale.receipt_no}`} size="md">
      <div className="mb-3 flex flex-wrap gap-2 text-sm">
        <Badge tone="blue">{labelOrderType(sale.order_type)}</Badge>
        <Badge tone="green">
          {(sale.payments as Payment[] | undefined)?.[0]?.method === "cash" ? "Tunai" : "QRIS"}
        </Badge>
        <Badge tone={sale.status === "completed" ? "green" : "red"}>{labelStatus(sale.status)}</Badge>
      </div>
      <p className="mb-3 text-sm text-gray-500">
        {tglPendek(sale.occurred_at)} {jam(sale.occurred_at)} · Perangkat {sale.device_id ? "kasir" : "—"}
      </p>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-brand-100 text-left text-xs uppercase text-gray-500">
            <th className="py-2">Item</th>
            <th className="py-2 text-center">Qty</th>
            <th className="py-2 text-right">Harga</th>
            <th className="py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-50">
          {(items ?? []).map((it) => (
            <tr key={it.id}>
              <td className="py-2">
                {it.product_name}
                {it.variant_name ? <span className="text-xs text-gray-500"> · {it.variant_name}</span> : null}
                {it.note && <span className="block text-xs italic text-gray-500">{it.note}</span>}
              </td>
              <td className="tnum py-2 text-center">{num(it.qty)}</td>
              <td className="tnum py-2 text-right">{rupiah(it.unit_price)}</td>
              <td className="tnum py-2 text-right">{rupiah(it.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 space-y-1 border-t border-brand-100 pt-3 text-sm">
        <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span className="tnum">{rupiah(sale.subtotal)}</span></div>
        {num(sale.discount) > 0 && <div className="flex justify-between"><span className="text-gray-500">Diskon</span><span className="tnum">- {rupiah(sale.discount)}</span></div>}
        <div className="flex justify-between font-semibold"><span>Total</span><span className="tnum">{rupiah(sale.total)}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">HPP (belanja bahan)</span><span className="tnum">{rupiah(sale.hpp_total)}</span></div>
        <div className="flex justify-between font-semibold text-brand-700"><span>Laba kotor</span><span className="tnum">{rupiah(num(sale.total) - num(sale.hpp_total))}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Diterima</span><span className="tnum">{rupiah(sale.paid_amount)}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Kembalian</span><span className="tnum">{rupiah(sale.change_amount)}</span></div>
      </div>

      {sale.void_reason && (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
          {labelStatus(sale.status)}: {sale.void_reason}
        </p>
      )}

      {snap && snap.length > 0 && sale.status === "completed" && (
        <details className="mt-3 rounded-xl bg-cream p-3 text-xs text-gray-600">
          <summary className="cursor-pointer font-medium text-brand-800">Resep yang dipakai (snapshot)</summary>
          <ul className="mt-2 space-y-1">
            {snap.filter((x) => x.ingredient_name).map((x, i) => (
              <li key={i} className="flex justify-between">
                <span>
                  {x.ingredient_name} × {num(x.consumed_qty)} {x.unit_symbol}
                </span>
                <span className="tnum">@{rupiah(x.unit_cost)} = {rupiah(x.line_cost)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="mt-4 flex justify-end gap-2">
        {sale.status === "completed" && (
          <>
            <Button variant="outline" onClick={() => onVoid(sale, "void")}>
              <XCircle className="size-4" /> Batalkan
            </Button>
            <Button variant="outline" onClick={() => onVoid(sale, "refund")}>
              <RotateCcw className="size-4" /> Refund
            </Button>
          </>
        )}
        <Button onClick={onDone}>Tutup</Button>
      </div>
    </Dialog>
  );
}

/* ---------- void / refund ---------- */
function VoidDialog({
  sale,
  mode,
  onClose,
  onDone,
}: {
  sale: Sale;
  mode: "void" | "refund";
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (reason.trim().length < 3) {
      setErr("Alasan minimal 3 karakter.");
      return;
    }
    setBusy(true);
    const { error: rpcErr } = await supabaseBrowser().rpc("rpc_void_sale", {
      p_sale_id: sale.id,
      p_mode: mode,
      p_reason: reason.trim(),
    });
    setBusy(false);
    if (rpcErr) {
      setErr(rpcErr.message);
      return;
    }
    toast.success(mode === "void" ? "Transaksi dibatalkan & stok dipulihkan" : "Refund diproses & stok dipulihkan");
    onDone();
  }

  return (
    <Dialog open onClose={onClose} title={mode === "void" ? `Batalkan ${sale.receipt_no}` : `Refund ${sale.receipt_no}`} size="sm">
      <p className="mb-3 text-sm text-gray-600">
        {mode === "void"
          ? "Transaksi dibatalkan: bahan dikembalikan ke stok, pembayaran direfund."
          : "Refund: bahan dikembalikan ke stok, pembayaran direfund. Catat alasannya."}
      </p>
      <Textarea
        className="min-h-[80px]"
        placeholder="Alasan (mis. salah input, pesanan batal, komplain)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Batal
        </Button>
        <Button variant="destructive" onClick={() => void submit()} disabled={busy}>
          {busy ? "Memproses…" : mode === "void" ? "Batalkan transaksi" : "Proses refund"}
        </Button>
      </div>
    </Dialog>
  );
}
