"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabase/client";
import { customerSchema } from "@/lib/validation/schemas";
import type { Customer, Sale } from "@/types/database";
import { num, rupiah, tglPendek } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, Badge } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/states";
import { Eye, Plus, Users } from "lucide-react";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);

  function reload() {
    setLoading(true);
    void (async () => {
      try {
        const supabase = supabaseBrowser();
        const [c, s] = await Promise.all([
          supabase.from("customers").select("*").order("name").limit(500),
          supabase.from("sales").select("customer_id, total, receipt_no, occurred_at, status").order("occurred_at", { ascending: false }).limit(1000),
        ]);
        if (c.error) throw c.error;
        setCustomers((c.data ?? []) as unknown as Customer[]);
        setSales((s.data ?? []) as unknown as Sale[]);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gagal memuat");
      } finally {
        setLoading(false);
      }
    })();
  }

  useEffect(reload, []);

  const stats = useMemo(() => {
    const map = new Map<string, { count: number; total: number; last: string | null }>();
    for (const s of sales) {
      if (!s.customer_id || s.status !== "completed") continue;
      const cur = map.get(s.customer_id) ?? { count: 0, total: 0, last: null };
      cur.count += 1;
      cur.total += num(s.total);
      cur.last = !cur.last || s.occurred_at > cur.last ? s.occurred_at : cur.last;
      map.set(s.customer_id, cur);
    }
    return map;
  }, [sales]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-900">Pelanggan</h1>
          <p className="text-sm text-gray-500">Pelanggan boleh transaksi tanpa terdaftar — data ini opsional.</p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="size-4" /> Pelanggan baru
        </Button>
      </div>

      {error && <ErrorState message={error} />}
      {loading && <TableSkeleton rows={4} />}
      {!loading && !error && (customers.length === 0 ? (
        <EmptyState icon={<Users className="size-12" />} title="Belum ada pelanggan" description="Tambahkan pelanggan langganan untuk melacak riwayat belanja." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-100 text-left text-xs uppercase text-gray-500">
                  <th className="px-4 py-3">Nama</th>
                  <th className="px-4 py-3">HP</th>
                  <th className="px-4 py-3 text-center">Transaksi</th>
                  <th className="px-4 py-3 text-right">Total belanja</th>
                  <th className="px-4 py-3">Terakhir</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-50">
                {customers.map((c) => {
                  const st = stats.get(c.id);
                  return (
                    <tr key={c.id}>
                      <td className="px-4 py-2.5 font-medium text-brand-900">{c.name}</td>
                      <td className="px-4 py-2.5 text-gray-600">{c.phone ?? "-"}</td>
                      <td className="tnum px-4 py-2.5 text-center">{st?.count ?? 0}</td>
                      <td className="tnum px-4 py-2.5 text-right font-semibold">{rupiah(st?.total ?? 0)}</td>
                      <td className="px-4 py-2.5 text-gray-500">{st?.last ? tglPendek(st.last) : "-"}</td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setDetailCustomer(c)} aria-label="Riwayat pelanggan">
                            <Eye className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditing(c);
                              setFormOpen(true);
                            }}
                            aria-label="Edit pelanggan"
                          >
                            <Plus className="size-4 rotate-45 text-brand-600" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}

      {formOpen && (
        <CustomerForm
          customer={editing}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            reload();
          }}
        />
      )}

      {detailCustomer && (
        <Dialog open onClose={() => setDetailCustomer(null)} title={`Riwayat — ${detailCustomer.name}`} size="md">
          {(() => {
            const rows = sales.filter((s) => s.customer_id === detailCustomer.id).slice(0, 50);
            return (
              <ul className="divide-y divide-brand-50 text-sm">
                {rows.map((s) => (
                  <li key={s.receipt_no} className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium text-brand-900">{s.receipt_no}</p>
                      <p className="text-xs text-gray-500">{tglPendek(s.occurred_at)}</p>
                    </div>
                    <Badge tone={s.status === "completed" ? "green" : "red"}>{rupiah(s.total)}</Badge>
                  </li>
                ))}
                {rows.length === 0 && <EmptyState title="Belum ada transaksi terekam untuk pelanggan ini." />}
              </ul>
            );
          })()}
          <div className="mt-3 flex justify-end">
            <Button onClick={() => setDetailCustomer(null)}>Tutup</Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function CustomerForm({
  customer,
  onClose,
  onSaved,
}: {
  customer: Customer | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({ name: customer?.name ?? "", phone: customer?.phone ?? "", note: customer?.note ?? "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    const parsed = customerSchema.safeParse({ name: form.name, phone: form.phone || null, note: form.note || null });
    if (!parsed.success) {
      setErr(parsed.error.issues[0]?.message ?? "Data tidak valid");
      return;
    }
    setBusy(true);
    const supabase = supabaseBrowser();
    const { data: profile } = await supabase.from("profiles").select("business_id").maybeSingle();
    const businessId = (profile as { business_id?: string } | null)?.business_id ?? null;
    const dataWithBiz = { ...parsed.data, business_id: businessId };
    const q = customer
      ? supabase.from("customers").update(dataWithBiz).eq("id", customer.id)
      : supabase.from("customers").insert(dataWithBiz);
    const { error: dbErr } = await q;
    setBusy(false);
    if (dbErr) {
      setErr(dbErr.message);
      return;
    }
    toast.success(customer ? "Pelanggan diperbarui" : "Pelanggan ditambahkan");
    onSaved();
  }

  return (
    <Dialog open onClose={onClose} title={customer ? "Edit pelanggan" : "Pelanggan baru"} size="sm">
      <Field label="Nama" error={err ? [err] : undefined}>
        <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
      </Field>
      <Field label="Nomor HP (opsional)">
        <Input value={form.phone ?? ""} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} inputMode="tel" />
      </Field>
      <Field label="Catatan (opsional)">
        <Textarea value={form.note ?? ""} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="mis. langganan mingguan" />
      </Field>
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
