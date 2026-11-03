"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabase/client";
import { purchaseSchema, supplierSchema } from "@/lib/validation/schemas";
import type { Ingredient, Purchase, Supplier } from "@/types/database";
import { rupiah, tglPendek, hariIni, fmtInputRibuan, parseInputRibuan } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, Badge } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/states";
import { Check, Plus, Trash2, Truck } from "lucide-react";

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [supplierOpen, setSupplierOpen] = useState(false);

  function reload() {
    setLoading(true);
    void (async () => {
      try {
        const supabase = supabaseBrowser();
        const [p, s, i] = await Promise.all([
          supabase.from("purchases").select("*, suppliers(id,name), purchase_items(ingredient_id, qty, unit_cost, line_total, ingredients(name, units(symbol)))").order("purchase_date", { ascending: false }).limit(100),
          supabase.from("suppliers").select("*").order("name"),
          supabase.from("ingredients").select("*, units(symbol)").eq("is_active", true).order("name"),
        ]);
        if (p.error) throw p.error;
        setPurchases((p.data ?? []) as unknown as Purchase[]);
        setSuppliers((s.data ?? []) as unknown as Supplier[]);
        setIngredients((i.data ?? []) as unknown as Ingredient[]);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gagal memuat");
      } finally {
        setLoading(false);
      }
    })();
  }

  useEffect(reload, []);

  return (
    <div className="space-y-4 min-w-0 overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-900">Pembelian</h1>
          <p className="text-sm text-gray-500">
            Konfirmasi pembelian menambah stok & memperbarui biaya rata-rata bahan.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setSupplierOpen(true)}>
            Pemasok
          </Button>
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="size-4" /> Pembelian baru
          </Button>
        </div>
      </div>

      {error && <ErrorState message={error} />}
      {loading && <TableSkeleton rows={5} />}

      {!loading && !error && (purchases.length === 0 ? (
        <EmptyState icon={<Truck className="size-12" />} title="Belum ada pembelian" description="Catat pembelian bahan dari pemasok di sini." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-100 text-left text-xs uppercase text-gray-500">
                  <th className="px-4 py-3">Ref</th>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Pemasok</th>
                  <th className="px-4 py-3">Bayar</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-50">
                {purchases.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2.5 font-medium text-brand-900">{p.ref_no}</td>
                    <td className="px-4 py-2.5 text-gray-600">{tglPendek(p.purchase_date)}</td>
                    <td className="px-4 py-2.5 text-gray-600">{p.suppliers?.name ?? "-"}</td>
                    <td className="px-4 py-2.5">
                      <Badge tone={p.payment_status === "paid" ? "blue" : "yellow"}>
                        {p.payment_status === "paid" ? "Dibayar" : "Hutang"}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tone={p.status === "confirmed" ? "green" : p.status === "cancelled" ? "red" : "gray"}>
                        {p.status}
                      </Badge>
                    </td>
                    <td className="tnum px-4 py-2.5 text-right font-semibold">{rupiah(p.total)}</td>
                    <td className="px-4 py-2.5 text-right">
                      {p.status === "draft" && <DraftActions purchase={p} onDone={reload} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}

      {newOpen && (
        <PurchaseForm
          ingredients={ingredients}
          suppliers={suppliers}
          onClose={() => setNewOpen(false)}
          onSaved={() => {
            setNewOpen(false);
            reload();
          }}
        />
      )}
      <SupplierDialog open={supplierOpen} onClose={() => setSupplierOpen(false)} suppliers={suppliers} onChanged={reload} />
    </div>
  );
}

function DraftActions({ purchase, onDone }: { purchase: Purchase; onDone: () => void }) {
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    const { error: rpcErr } = await supabaseBrowser().rpc("rpc_confirm_purchase", { p_purchase_id: purchase.id });
    setBusy(false);
    if (rpcErr) {
      toast.error(rpcErr.message);
      return;
    }
    toast.success("Pembelian dikonfirmasi — stok & biaya rata-rata diperbarui");
    onDone();
  }

  async function cancel() {
    setBusy(true);
    const { error: err } = await supabaseBrowser()
      .from("purchases")
      .update({ status: "cancelled" })
      .eq("id", purchase.id);
    setBusy(false);
    if (err) {
      toast.error(err.message);
      return;
    }
    toast.success("Pembelian dibatalkan");
    onDone();
  }

  return (
    <div className="flex justify-end gap-1">
      <Button variant="ghost" size="icon" onClick={cancel} aria-label="Batalkan purchase draft">
        <Trash2 className="size-4 text-red-500" />
      </Button>
      <Button variant="ghost" size="icon" onClick={confirm} disabled={busy} aria-label="Konfirmasi pembelian">
        <Check className="size-4 text-brand-600" />
      </Button>
    </div>
  );
}

/* ---------- form pembelian ---------- */
interface DraftItem {
  ingredient_id: string;
  qty: string;
  unit_cost: string;
}

function PurchaseForm({
  ingredients,
  suppliers,
  onClose,
  onSaved,
}: {
  ingredients: Ingredient[];
  suppliers: Supplier[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [supplierId, setSupplierId] = useState<string>("");
  const [refNo, setRefNo] = useState(purchaseNo());
  const [date, setDate] = useState(hariIni());
  const [payment, setPayment] = useState<"paid" | "unpaid">("paid");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const total = useMemo(
    () =>
      items.reduce(
        (s, it) => s + (Math.round(parse(it.qty) * parse(it.unit_cost) * 100) / 100),
        0,
      ),
    [items],
  );

  async function save() {
    const parsed = purchaseSchema.safeParse({
      supplier_id: supplierId || null,
      ref_no: refNo,
      purchase_date: date,
      payment_status: payment,
      note: note || null,
      items: items.map((i) => ({
        ingredient_id: i.ingredient_id,
        qty: i.qty,
        unit_cost: i.unit_cost,
      })),
    });
    if (!parsed.success) {
      setErr(parsed.error.issues[0]?.message ?? "Data tidak valid");
      return;
    }
    setBusy(true);
    try {
      const supabase = supabaseBrowser();
      const { items: vs, ...head } = parsed.data;
      const { data: created, error: e1 } = await supabase
        .from("purchases")
        .insert(head)
        .select("id")
        .single();
      if (e1) throw e1;
      const purchaseId = (created as { id: string }).id;
      const { error: e2 } = await supabase.from("purchase_items").insert(
        vs.map((i) => ({ purchase_id: purchaseId, ...i })),
      );
      if (e2) throw e2;
      toast.success("Pembelian tersimpan sebagai DRAFT — konfirmasi untuk menambah stok.");
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal menyimpan pembelian");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title="Pembelian bahan baku" size="xl">
      <div className="grid gap-0 sm:grid-cols-3">
        <Field label="Pemasok">
          <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">— tanpa pemasok —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="No. referensi">
          <Input value={refNo} onChange={(e) => setRefNo(e.target.value)} />
        </Field>
        <Field label="Tanggal">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>

      <div className="space-y-2">
        {items.map((it, idx) => {
          return (
            <div key={idx} className="flex flex-wrap items-center gap-2 rounded-xl bg-cream p-2">
              <Select
                className="min-w-[150px] flex-1"
                value={it.ingredient_id}
                onChange={(e) => setItems((xs) => xs.map((x, j) => (j === idx ? { ...x, ingredient_id: e.target.value } : x)))}
              >
                <option value="">— pilih bahan —</option>
                {ingredients.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.units?.symbol})
                  </option>
                ))}
              </Select>
              <div className="w-24">
                <Input
                  className="w-full"
                  inputMode="numeric"
                  min={0}
                  placeholder="Qty"
                  value={it.qty ? fmtInputRibuan(String(it.qty)) : ""}
                  onChange={(e) => setItems((xs) => xs.map((x, j) => (j === idx ? { ...x, qty: String(parseInputRibuan(e.target.value)) } : x)))}
                />
              </div>
              <div className="w-full sm:w-32">
                <Input
                  className="w-full"
                  inputMode="numeric"
                  min={0}
                  placeholder="Harga satuan"
                  value={it.unit_cost ? fmtInputRibuan(String(it.unit_cost)) : ""}
                  onChange={(e) => setItems((xs) => xs.map((x, j) => (j === idx ? { ...x, unit_cost: String(parseInputRibuan(e.target.value)) } : x)))}
                />
              </div>
              <span className="tnum">{rupiah(parse(it.qty) * parse(it.unit_cost))}</span>
              <Button variant="ghost" size="icon" onClick={() => setItems((xs) => xs.filter((_, j) => j !== idx))} aria-label="Hapus item">
                <Trash2 className="size-4 text-red-500" />
              </Button>
            </div>
          );
        })}
      </div>
      <Button
        variant="secondary"
        className="mt-2"
        onClick={() => setItems((xs) => [...xs, { ingredient_id: "", qty: "", unit_cost: "" }])}
      >
        <Plus className="size-4" /> Tambah item
      </Button>

      <div className="mt-4 grid gap-0 sm:grid-cols-2">
        <Field label="Status pembayaran">
          <Select value={payment} onChange={(e) => setPayment(e.target.value as "paid" | "unpaid")}>
            <option value="paid">Dibayar (tunai)</option>
            <option value="unpaid">Hutang</option>
          </Select>
        </Field>
        <Field label="Catatan">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>

      <p className="text-right text-lg font-bold text-brand-900">
        Total: <span className="tnum">{rupiah(total)}</span>
      </p>
      <p className="mb-2 text-xs text-gray-500">
        Catatan: pembelian persediaan TIDAK langsung dihitung HPP — HPP tercatat saat bahan dipakai.
      </p>

      {err && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
      <div className="mt-2 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Batal
        </Button>
        <Button onClick={() => void save()} disabled={busy || ingredients.length === 0}>
          {busy ? "Menyimpan…" : "Simpan draft"}
        </Button>
      </div>
    </Dialog>
  );
}

function purchaseNo(): string {
  const d = new Date();
  const stamp = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(d).replace(/-/g, "");
  return `PO-${stamp}-${Math.floor(Math.random() * 900 + 100)}`;
}

function parse(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/* ---------- pemasok ---------- */
function SupplierDialog({
  open,
  onClose,
  suppliers,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  suppliers: Supplier[];
  onChanged: () => void;
}) {
  const [form, setForm] = useState({ name: "", phone: "", address: "", note: "" });
  const [busy, setBusy] = useState(false);

  async function add() {
    const parsed = supplierSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Data tidak valid");
      return;
    }
    setBusy(true);
    const { error: err } = await supabaseBrowser().from("suppliers").insert(parsed.data);
    setBusy(false);
    if (err) {
      toast.error(err.message);
      return;
    }
    toast.success("Pemasok ditambahkan");
    setForm({ name: "", phone: "", address: "", note: "" });
    onChanged();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Pemasok" size="md">
      <div className="grid grid-cols-1 gap-0 sm:grid-cols-2">
        <Field label="Nama">
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Daging Aby" />
        </Field>
        <Field label="HP">
          <Input value={form.phone ?? ""} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
        </Field>
      </div>
      <Field label="Alamat">
        <Input value={form.address ?? ""} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
      </Field>
      <Field label="Catatan">
        <Input value={form.note ?? ""} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
      </Field>
      <Button className="mb-4 w-full" variant="secondary" onClick={() => void add()} disabled={busy}>
        <Plus className="size-4" /> Tambah pemasok
      </Button>
      <ul className="space-y-1 text-sm">
        {suppliers.map((s) => (
          <li key={s.id} className="rounded-lg bg-cream px-3 py-2">
            <p className="font-medium text-brand-900">{s.name}</p>
            <p className="text-xs text-gray-500">{s.phone ?? "-"}</p>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
