"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabase/client";
import { ingredientSchema, unitSchema } from "@/lib/validation/schemas";
import type { Ingredient, StockMovement, Unit } from "@/types/database";
import { num, angka, tglPendek, jam, rupiah, fmtInputRibuan, parseInputRibuan } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, Badge } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/states";
import { Boxes, Plus, Pencil, Coins, ArrowDownCircle, ArrowUpCircle, PackageMinus } from "lucide-react";
import { StockAdjustDialog, type MovementKind } from "./stock-adjust-dialog";

type TabKind = "bahan" | "riwayat";

export default function InventoryPage() {
  const [tab, setTab] = useState<TabKind>("bahan");
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [ingredientDialog, setIngredientDialog] = useState<
    { kind: "new" } | { kind: "edit"; ingredient: Ingredient } | null
  >(null);
  const [unitOpen, setUnitOpen] = useState(false);
  const [adjustDialog, setAdjustDialog] = useState<{ ingredient: Ingredient; kind: MovementKind } | null>(null);

  function reload() {
    setLoading(true);
    Promise.all([
      supabaseBrowser()
        .from("ingredients")
        .select("*, units(id,name,symbol), stock_balances(qty,avg_cost)")
        .order("name")
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []) as unknown as Ingredient[];
        }),
      supabaseBrowser().from("units").select("*").order("name"),
      supabaseBrowser()
        .from("stock_movements")
        .select("*, ingredients(name, units(symbol))")
        .order("occurred_at", { ascending: false })
        .limit(50)
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []) as unknown as StockMovement[];
        }),
    ])
      .then(([ing, unitList, moves]) => {
        setIngredients(ing);
        setUnits((unitList.data ?? []) as unknown as Unit[]);
        setMovements(moves);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(reload, []);

  const inventoryValue = useMemo(
    () => ingredients.reduce((s, i) => s + num(i.stock_balances?.qty) * num(i.stock_balances?.avg_cost), 0),
    [ingredients],
  );
  const lowStock = useMemo(
    () => ingredients.filter((i) => i.is_active && num(i.stock_balances?.qty) <= num(i.minimum_stock)),
    [ingredients],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-900">Stok Bahan</h1>
          <p className="text-sm text-gray-500">
            Nilai persediaan: <span className="tnum font-semibold">{rupiah(inventoryValue)}</span>
            {lowStock.length > 0 && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                {lowStock.length} bahan menipis
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setUnitOpen(true)}>
            Satuan
          </Button>
          <Button onClick={() => setIngredientDialog({ kind: "new" })}>
            <Plus className="size-4" /> Bahan baku
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-brand-100 p-1 text-sm font-medium">
        {([["bahan", "Bahan baku"], ["riwayat", "Riwayat pergerakan"]] as [TabKind, string][]).map(([id, label]) => (
          <button
            key={id}
            className={clsxClasses(tab === id)}
            onClick={() => setTab(id)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      {error && <ErrorState message={error} />}
      {loading && <TableSkeleton rows={6} />}

      {!loading && !error && tab === "bahan" && (
        <>
          {ingredients.length === 0 ? (
            <EmptyState
              icon={<Boxes className="size-12" />}
              title="Belum ada bahan baku"
              description="Tambahkan bahan seperti Daging sapi, Tepung tapioka, Me."
              action={
                <Button className="mt-3" onClick={() => setIngredientDialog({ kind: "new" })}>
                  <Plus className="size-4" /> Tambah bahan
                </Button>
              }
            />
          ) : (
            <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-3" id="ingredients-data">
              {ingredients.map((i) => {
                const qty = num(i.stock_balances?.qty);
                const low = qty <= num(i.minimum_stock);
                const value = qty * num(i.stock_balances?.avg_cost);
                return (
                  <Card key={i.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-brand-900">{i.name}</p>
                          <p className="text-xs text-gray-500">Min. {angka(num(i.minimum_stock), 2)} {i.units?.symbol}</p>
                        </div>
                        <Badge tone={low ? (qty <= 0 ? "red" : "yellow") : "green"}>
                          {angka(qty, 2)} {i.units?.symbol}
                        </Badge>
                      </div>
                      <p className="mt-2 tnum text-xs text-gray-500">
                        Biaya rata-rata: {rupiah(num(i.stock_balances?.avg_cost))}/{i.units?.symbol} · Nilai:{" "}
                        <span className="font-semibold text-brand-800">{rupiah(value)}</span>
                      </p>
                      <div className="mt-3 flex flex-wrap gap-1">
                        <Button variant="outline" size="sm" onClick={() => setAdjustDialog({ ingredient: i, kind: "in" })}>
                          <ArrowUpCircle className="size-3.5" /> Masuk
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setAdjustDialog({ ingredient: i, kind: "out" })}>
                          <ArrowDownCircle className="size-3.5" /> Keluar
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setAdjustDialog({ ingredient: i, kind: "opname" })}>
                          <PackageMinus className="size-3.5" /> Opname
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setIngredientDialog({ kind: "edit", ingredient: i })}>
                          <Pencil className="size-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </section>
          )}
        </>
      )}

      {!loading && !error && tab === "riwayat" && (
        <Card>
          <CardContent className="p-0">
            {movements.length === 0 ? (
              <EmptyState title="Belum ada pergerakan stok" description="Semua perubahan stok otomatis tercatat di sini." />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-brand-100 text-left text-xs uppercase text-gray-500">
                    <th className="px-4 py-3">Waktu</th>
                    <th className="px-4 py-3">Bahan</th>
                    <th className="px-4 py-3">Tipe</th>
                    <th className="px-4 py-3 text-right">Perubahan</th>
                    <th className="px-4 py-3">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-50">
                  {movements.map((m) => (
                    <tr key={m.id}>
                      <td className="px-4 py-2.5 text-gray-500">{tglPendek(m.occurred_at)} {jam(m.occurred_at)}</td>
                      <td className="px-4 py-2.5 text-brand-900">{m.ingredients?.name ?? "-"}</td>
                      <td className="px-4 py-2.5">
                        <Badge tone={m.movement_type === "sale" ? "blue" : m.movement_type === "purchase" ? "green" : "gray"}>
                          {m.movement_type}
                        </Badge>
                      </td>
                      <td className={`tnum px-4 py-2.5 text-right font-medium ${num(m.qty_change) > 0 ? "text-brand-700" : "text-red-600"}`}>
                        {num(m.qty_change) > 0 ? "+" : ""}
                        {angka(num(m.qty_change), 2)} {m.ingredients?.units?.symbol}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">{m.ref_note ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <IngredientDialog
        state={ingredientDialog}
        onClose={() => setIngredientDialog(null)}
        units={units}
        onSaved={() => {
          setIngredientDialog(null);
          reload();
        }}
      />
      <UnitDialog
        open={unitOpen}
        onClose={() => setUnitOpen(false)}
        units={units}
        onChanged={() => {
          reload();
          setUnitOpen(false);
        }}
      />
      {adjustDialog && (
        <StockAdjustDialog
          ingredient={adjustDialog.ingredient}
          kind={adjustDialog.kind}
          onClose={() => setAdjustDialog(null)}
          onDone={() => {
            setAdjustDialog(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function clsxClasses(active: boolean): string {
  return `flex-1 rounded-lg px-3 py-2 text-center transition ${active ? "bg-white text-brand-900 shadow-sm" : "text-gray-500"}`;
}

/* ---------- Form bahan ---------- */
function IngredientDialog({
  state,
  onClose,
  units,
  onSaved,
}: {
  state: { kind: "new" } | { kind: "edit"; ingredient: Ingredient } | null;
  onClose: () => void;
  units: Unit[];
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [unitId, setUnitId] = useState<string>("");
  const [minimumStock, setMinimumStock] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const editIngredient = state?.kind === "edit" ? state.ingredient : null;

  useEffect(() => {
    if (!state) return;
    setName(editIngredient?.name ?? "");
    setUnitId(editIngredient?.unit_id ?? units[0]?.id ?? "");
    setMinimumStock(num(editIngredient?.minimum_stock ?? 0));
    setIsActive(editIngredient?.is_active ?? true);
    setErr(null);
  }, [state, units, editIngredient]);

  async function save() {
    const parsed = ingredientSchema.safeParse({ name, unit_id: unitId, minimum_stock: minimumStock, is_active: isActive });
    if (!parsed.success) {
      setErr(parsed.error.issues[0]?.message ?? "Data tidak valid");
      return;
    }
    if (!unitId) {
      setErr("Tambahkan setidaknya satu satuan terlebih dahulu (tombol 'Satuan').");
      return;
    }
    setSaving(true);
    const supabase = supabaseBrowser();
    const q = editIngredient
      ? supabase.from("ingredients").update(parsed.data).eq("id", editIngredient.id)
      : supabase.from("ingredients").insert(parsed.data);
    const { error: dbErr } = await q;
    setSaving(false);
    if (dbErr) {
      setErr(dbErr.message);
      return;
    }
    toast.success(editIngredient ? "Bahan diperbarui" : "Bahan ditambahkan");
    onSaved();
  }

  return (
    <Dialog open={!!state} onClose={onClose} title={editIngredient ? "Edit bahan" : "Bahan baru"} size="sm">
      <Field label="Nama bahan" error={err ? [err] : undefined}>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Daging sapi" />
      </Field>
      <Field label="Satuan">
        <Select value={unitId} onChange={(e) => setUnitId(e.target.value)}>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.symbol})
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Batas minimum stok" hint="Notifikasi muncul saat stok menipis">
        <Input type="text" inputMode="numeric" min={0} step="0.001" value={minimumStock ? fmtInputRibuan(String(minimumStock)) : ""} onChange={(e) => setMinimumStock(String(parseInputRibuan(e.target.value)))} placeholder="mis. 10" />
      </Field>
      <label className="mb-4 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        Bahan aktif
      </label>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Batal
        </Button>
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? "Menyimpan…" : "Simpan"}
        </Button>
      </div>
    </Dialog>
  );
}

/* ---------- Satuan ---------- */
function UnitDialog({
  open,
  onClose,
  units,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  units: Unit[];
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function add() {
    const parsed = unitSchema.safeParse({ name, symbol });
    if (!parsed.success) {
      setErr(parsed.error.issues[0]?.message ?? "Data tidak valid");
      return;
    }
    setSaving(true);
    const { error: dbErr } = await supabaseBrowser().from("units").insert(parsed.data);
    setSaving(false);
    if (dbErr) {
      setErr(dbErr.message);
      return;
    }
    toast.success("Satuan ditambahkan");
    setName("");
    setSymbol("");
    setErr(null);
    onChanged();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Satuan bahan" size="sm">
      <div className="grid grid-cols-2 gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Kilogram" />
        <Input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="kg" />
      </div>
      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
      <Button className="mt-3 w-full" variant="secondary" onClick={() => void add()} disabled={saving}>
        <Plus className="size-4" /> Tambah satuan
      </Button>
      <ul className="mt-4 flex flex-wrap gap-2">
        {units.map((u) => (
          <li key={u.id} className="rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-800">
            {u.name} ({u.symbol})
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
