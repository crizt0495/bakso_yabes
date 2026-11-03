"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabase/client";
import { angka, num } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import type { Ingredient } from "@/types/database";

/** Kind penyesuaian: in (stok masuk), out (keluar/boros), opname (setel jumlah fisik) */
export type MovementKind = "in" | "out" | "opname";

const LABEL: Record<MovementKind, string> = {
  in: "Stok masuk",
  out: "Stok keluar",
  opname: "Stok opname (hitung fisik)",
};

/**
 * Semua perubahan stok WAJIB lewat jurnal (RPC rpc_stock_adjustment),
 * tidak boleh mengubah saldo langsung.
 */
export function StockAdjustDialog({
  ingredient,
  kind,
  onClose,
  onDone,
}: {
  ingredient: Ingredient;
  kind: MovementKind;
  onClose: () => void;
  onDone: () => void;
}) {
  const [type, setType] = useState(kind === "in" ? "initial" : kind === "out" ? "waste" : "opname");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setQty("");
    setNote("");
    setErr(null);
    setType(kind === "in" ? "adjustment" : kind === "out" ? "waste" : "opname");
  }, [kind]);

  const current = num(ingredient.stock_balances?.qty);
  const delta =
    kind === "opname"
      ? parseNum(qty) - current // opname: hasil hitung fisik → selisih otomatis
      : parseNum(qty) * (kind === "out" ? -1 : 1); // in/out: jumlah penuh

  async function save() {
    if (kind === "opname") {
      const counted = parseNum(qty);
      if (counted === current) {
        toast.info("Jumlah fisik sama dengan saldo — tidak ada perubahan.");
        return;
      }
    } else if (Math.abs(parseNum(qty)) <= 0) {
      setErr("Jumlah tidak boleh 0");
      return;
    }

    setBusy(true);
    const { data, error: rpcErr } = await supabaseBrowser().rpc("rpc_stock_adjustment", {
      p_ingredient_id: ingredient.id,
      p_movement_type: kind === "opname" ? "opname" : type,
      p_qty: delta,
      p_note: note || null,
    });
    setBusy(false);
    if (rpcErr) {
      setErr(rpcErr.message);
      return;
    }
    toast.success("Stok diperbarui");
    onDone();
  }

  return (
    <Dialog open onClose={onClose} title={`${LABEL[kind]} — ${ingredient.name}`} size="sm">
      <p className="mb-4 rounded-xl bg-cream px-3 py-2 text-sm text-gray-600">
        Saldo saat ini:{" "}
        <span className="tnum font-semibold text-brand-800">
          {angka(current, 2)} {ingredient.units?.symbol}
        </span>
      </p>

      {kind === "opname" ? (
        <Field label="Jumlah hasil hitung fisik" hint="Selisih dikalkulasi otomatis & tercatat di jurnal">
          <Input type="number" step="0.001" value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>
      ) : (
        <Field label={`Jumlah (${ingredient.units?.symbol})`}>
          <Input type="number" step="0.001" min={0} value={qty} onChange={(e) => setQty(e.target.value)} placeholder="mis. 5" />
        </Field>
      )}

      {kind !== "opname" && (
        <Field label="Tipe" hint="initial = stok awal, adjustment = koreksi, waste = bahan terbuang">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="adjustment">Penyesuaian (adjustment)</option>
            <option value="waste">Boros / terbuang (waste)</option>
            <option value="initial">Stok awal (initial)</option>
          </Select>
        </Field>
      )}

      <Field label="Catatan (opsional)">
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Sekat, operasional, dsb." />
      </Field>

      <p className="mb-3 text-xs text-gray-500">
        Saldo menjadi:{" "}
        <span className="tnum font-semibold text-brand-800">
          {angka(current + delta, 2)} {ingredient.units?.symbol} {delta < 0 ? "(berkurang)" : "(bertambah)"}
        </span>
      </p>

      {err && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{err}</p>}

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

function parseNum(v: string): number {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
