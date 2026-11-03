"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Business, Device } from "@/types/database";
import { tglPendek, angka } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ButtonPanel } from "@/components/ui/button-panel";
import { Field, Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { TableSkeleton } from "@/components/ui/states";
import { CloudDownload, RotateCcw, Save, Smartphone } from "lucide-react";

export default function SettingsPage() {
  const [biz, setBiz] = useState<Business | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", phone: "", address: "" });
  const [saving, setSaving] = useState(false);
  const [reconcileOpen, setReconcileOpen] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const supabase = supabaseBrowser();
        const { data: profile } = await supabase.from("profiles").select("business_id").maybeSingle();
        if (!profile) return;
        const [{ data: b }, { data: d }] = await Promise.all([
          supabase.from("businesses").select("*").eq("id", (profile as { business_id: string }).business_id).single(),
          supabase.from("devices").select("*").order("last_seen_at", { ascending: false }),
        ]);
        setBiz((b ?? null) as unknown as Business);
        setDevices((d ?? []) as unknown as Device[]);
        if (b) setForm({ name: (b as Business).name, phone: (b as Business).phone ?? "", address: (b as Business).address ?? "" });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function saveBusiness() {
    if (!biz) return;
    if (!form.name.trim()) {
      toast.error("Nama wajib diisi");
      return;
    }
    setSaving(true);
    const { error: err } = await supabaseBrowser()
      .from("businesses")
      .update({ name: form.name.trim(), phone: form.phone || null, address: form.address || null })
      .eq("id", biz.id);
    setSaving(false);
    if (err) {
      toast.error(err.message);
      return;
    }
    toast.success("Info warung diperbarui");
  }

  function backupJson() {
    void (async () => {
      try {
        const supabase = supabaseBrowser();
        const [sales, expenses, purchases, ingredients] = await Promise.all([
          supabase.from("sales").select("*").order("occurred_at", { ascending: false }).limit(5000),
          supabase.from("expenses").select("*").limit(5000),
          supabase.from("purchases").select("*").limit(5000),
          supabase.from("ingredients").select("*").limit(1000),
        ]);
        const payload = {
          exported_at: new Date().toISOString(),
          warning: "Backup manual. Untuk backup penuh gunakan fitur backup Supabase (docs/BACKUP.md).",
          sales: sales.data ?? [],
          expenses: expenses.data ?? [],
          purchases: purchases.data ?? [],
          ingredients: ingredients.data ?? [],
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `baksoku-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Backup diunduh");
      } catch {
        toast.error("Gagal membuat backup");
      }
    })();
  }

  return (
    <div className="space-y-4 min-w-0 overflow-x-hidden">
      <div>
        <h1 className="text-xl font-bold text-brand-900">Pengaturan</h1>
        <p className="text-sm text-gray-500">Data warung, perangkat, konsistensi stok & backup.</p>
      </div>

      {loading && <TableSkeleton rows={4} />}

      {biz && (
        <>
          <Card>
            <CardContent className="p-4">
              <h2 className="mb-3 text-sm font-semibold text-brand-900">Info warung</h2>
              <Field label="Nama warung">
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </Field>
              <Field label="Telepon">
                <Input value={form.phone ?? ""} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </Field>
              <Field label="Alamat">
                <Input value={form.address ?? ""} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
              </Field>
              <Button onClick={() => void saveBusiness()} disabled={saving}>
                <Save className="size-4" /> {saving ? "Menyimpan…" : "Simpan"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <h2 className="mb-1 text-sm font-semibold text-brand-900">Perangkat kasir</h2>
              <p className="mb-3 text-xs text-gray-500">
                Satu perangkat utama menulis transaksi offline. Sesuai design: perangkat lain hanya untuk lihat data saat online.
              </p>
              <ul className="space-y-1 text-sm">
                {devices.map((d) => (
                  <li key={d.id} className="flex items-center justify-between rounded-xl bg-cream px-3 py-2">
                    <span className="flex items-center gap-2">
                      <Smartphone className="size-4 text-brand-600" />
                      {d.label ?? d.device_code}
                    </span>
                    <span className="text-xs text-gray-500">
                      terakhir aktif: {d.last_seen_at ? tglPendek(d.last_seen_at) : "baru pertama"}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <h2 className="mb-1 text-sm font-semibold text-brand-900">Data & konsistensi</h2>
              <p className="mb-3 text-xs text-gray-500">
                Jika beberapa perangkat melakukan penjualan saat sama-sama offline, stok global
                tidak dapat dijamin konsisten — saldo menjadi sementara dan perlu rekonsiliasi
                setelah sinkronisasi.
              </p>
              <ButtonPanel
                items={[
                  {
                    icon: RotateCcw,
                    label: "Rekonsiliasi stok",
                    onClick: () => setReconcileOpen(true),
                  },
                  {
                    icon: CloudDownload,
                    label: "Backup (JSON)",
                    onClick: backupJson,
                  },
                ]}
              />
            </CardContent>
          </Card>
        </>
      )}

      {reconcileOpen && <ReconcileDialog onClose={() => setReconcileOpen(false)} />}
    </div>
  );
}

function ReconcileDialog({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<{ ingredient_name: string; balance_qty: number; journal_qty: number; diff: number }[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const { data, error: err } = await supabaseBrowser().rpc("rpc_stock_reconcile");
      setLoading(false);
      if (err) {
        toast.error(err.message);
        return;
      }
      setRows(
        ((data ?? []) as { ingredient_name: string; balance_qty: string; journal_qty: string; diff: string }[]).map((r) => ({
          ingredient_name: r.ingredient_name,
          balance_qty: Number(r.balance_qty),
          journal_qty: Number(r.journal_qty),
          diff: Number(r.diff),
        })),
      );
    })();
  }, []);

  return (
    <Dialog open onClose={onClose} title="Rekonsiliasi stok" size="lg">
      <p className="mb-3 text-sm text-gray-600">
        Membandingkan <b>saldo</b> (stock_balances) dengan total <b>jurnal pergerakan</b>. Selisih ≠ 0 berarti ada
        ketidaksinkronan (mis. transaksi offline ganda) — gunakan tombol Masuk/Keluar pada menu Stok untuk koreksi.
      </p>
      {loading ? (
        <TableSkeleton rows={3} />
      ) : (rows ?? []).length === 0 ? (
        <p className="rounded-xl bg-brand-50 p-4 text-sm text-brand-800">✓ Konsisten — semua saldo cocok dengan jurnal.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brand-100 text-left text-xs uppercase text-gray-500">
              <th className="py-2">Bahan</th>
              <th className="py-2 text-right">Saldo</th>
              <th className="py-2 text-right">Jurnal</th>
              <th className="py-2 text-right">Selisih</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-50">
            {(rows ?? []).map((r) => (
              <tr key={r.ingredient_name}>
                <td className="py-2">{r.ingredient_name}</td>
                <td className="tnum py-2 text-right">{angka(r.balance_qty, 2)}</td>
                <td className="tnum py-2 text-right">{angka(r.journal_qty, 2)}</td>
                <td className="tnum py-2 text-right font-semibold text-red-600">{angka(r.diff, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="mt-4 flex justify-end">
        <Button onClick={onClose}>Tutup</Button>
      </div>
    </Dialog>
  );
}
