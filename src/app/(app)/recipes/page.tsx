"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabase/client";
import { recipeItemSchema } from "@/lib/validation/schemas";
import type { Ingredient, Product, RecipeItem } from "@/types/database";
import { num, rupiah, angka } from "@/lib/utils/format";
import { recipeHpp } from "@/lib/business/hpp";
import { Button } from "@/components/ui/button";
import { Card, CardContent, Badge } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/states";
import { ChefHat, Plus, Pencil, Trash2, Percent } from "lucide-react";

// (logika HPP diimpor dari lib/business/hpp)

export default function RecipesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [recipes, setRecipes] = useState<Record<string, RecipeItem[]>>({});
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  function reload() {
    setLoading(true);
    Promise.all([
      supabaseBrowser()
        .from("products")
        .select("*, recipes(recipe_items(id, ingredient_id, product_variant_id, qty))")
        .eq("is_active", true)
        .order("sort_order"),
      supabaseBrowser()
        .from("ingredients")
        .select("*, units(symbol), stock_balances(avg_cost)")
        .eq("is_active", true)
        .order("name"),
    ])
      .then(([prodRes, ingRes]) => {
        const prods = ((prodRes.data ?? []) as unknown as (Product & { recipes: { recipe_items: Omit<RecipeItem, "qty">[] }[] })[]);
        const byIngredient = new Map((ingRes.data ?? []).map((i: any) => [i.id, i]));
        const recipeMap: Record<string, RecipeItem[]> = {};
        for (const p of prods) {
          const rr = p.recipes?.[0];
          recipeMap[p.id] = (rr?.recipe_items ?? []).map((it: any) => ({
            ...it,
            qty: Number(it.qty),
          })) as unknown as RecipeItem[];
        }
        void byIngredient;
        setProducts(prods);
        setRecipes(recipeMap);
        setIngredients((ingRes.data ?? []) as unknown as Ingredient[]);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(reload, []);

  const ingredientMap = useMemo(
    () => new Map(ingredients.map((i) => [i.id, i])),
    [ingredients],
  );

  function hppOf(productId: string, variantId?: string | null): number {
    return recipeHpp(
      (recipes[productId] ?? []).map((it) => ({
        qty: num(it.qty),
        unit_cost: num(ingredientMap.get(it.ingredient_id)?.stock_balances?.["avg_cost"] ?? 0),
        product_variant_id: it.product_variant_id,
      })),
      variantId ?? null,
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-brand-900">Resep & HPP</h1>
        <p className="text-sm text-gray-500">
          HPP dihitung otomatis dari takaran bahan × biaya rata-rata. Bahan stok berkurang saat penjualan.
        </p>
      </div>

      {error && <ErrorState message={error} />}
      {loading && <TableSkeleton rows={6} />}

      {!loading && !error && (
        <>
          {products.length === 0 ? (
            <EmptyState icon={<ChefHat className="size-12" />} title="Belum ada produk" description="Tambahkan produk terlebih dahulu di menu Produk." />
          ) : (
            <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => {
                const has = (recipes[p.id] ?? []).length > 0;
                const hpp = hppOf(p.id);
                const price = num(p.price);
                const profitRp = price - hpp;
                const margin = price > 0 ? (profitRp / price) * 100 : 0;
                return (
                  <Card key={p.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-brand-900">{p.name}</p>
                          <p className="text-xs text-gray-500">Jual {rupiah(price)}</p>
                        </div>
                        <Badge tone={has ? (hpp > 0 ? "green" : "yellow") : "gray"}>
                          {has ? `HPP ${rupiah(hpp)}` : "Belum ada resep"}
                        </Badge>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1 text-gray-500">
                          <Percent className="size-3.5" /> Margin
                        </span>
                        <span className={`tnum font-semibold ${margin >= 0 ? "text-brand-700" : "text-red-600"}`}>
                          {angka(margin, 1)}% · {rupiah(profitRp)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        {(recipes[p.id] ?? []).length} bahan dalam resep
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 w-full"
                        onClick={() => setEditingProduct(p)}
                      >
                        {has ? <Pencil className="size-3.5" /> : <Plus className="size-3.5" />}
                        {has ? "Edit resep" : "Buat resep"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </section>
          )}
        </>
      )}

      {editingProduct && (
        <RecipeEditor
          product={editingProduct}
          ingredients={ingredients}
          initialItems={recipes[editingProduct.id] ?? []}
          onClose={() => setEditingProduct(null)}
          onSaved={() => {
            setEditingProduct(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

/* ============================================================
 * Editor resep
 * ============================================================ */
interface DraftItem {
  ingredient_id: string;
  product_variant_id: string | null; // null = semua varian
  qty: string;
}

function RecipeEditor({
  product,
  ingredients,
  initialItems,
  onClose,
  onSaved,
}: {
  product: Product;
  ingredients: Ingredient[];
  initialItems: RecipeItem[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [items, setItems] = useState<DraftItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ingMap = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients]);

  useEffect(() => {
    setItems(
      initialItems.map((it) => ({
        ingredient_id: it.ingredient_id,
        product_variant_id: it.product_variant_id,
        qty: String(num(it.qty)),
      })),
    );
  }, [product.id, initialItems]);

  const priceList = [
    { id: null as string | null, name: "Semua varian", price: num(product.price) },
    ...(product.product_variants ?? []).map((v) => ({ id: v.id, name: v.name, price: num(v.price) })),
  ];

  const hppPerVariant = priceList.map((v) => ({
    ...v,
    hpp: recipeHpp(
      items.map((it) => ({
        qty: Number(it.qty.replace(",", ".")) || 0,
        unit_cost: num(ingMap.get(it.ingredient_id)?.stock_balances?.["avg_cost"] ?? 0),
        product_variant_id: it.product_variant_id,
      })),
      v.id,
    ),
  }));

  async function save() {
    // validasi zod per item
    for (const [idx, it] of items.entries()) {
      const parsed = recipeItemSchema.safeParse({
        ingredient_id: it.ingredient_id,
        product_variant_id: it.product_variant_id,
        qty: it.qty,
      });
      if (!parsed.success) {
        setErr(`Item #${idx + 1}: ${parsed.error.issues[0]?.message}`);
        return;
      }
      if (!ingMap.has(it.ingredient_id)) {
        setErr(`Item #${idx + 1}: pilih bahan terlebih dahulu`);
        return;
      }
    }
    if (items.length === 0) {
      setErr("Resep minimal punya satu bahan");
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const supabase = supabaseBrowser();
      // upsert resep aktif untuk produk
      const { data: existing, error: e1 } = await supabase
        .from("recipes")
        .select("id")
        .eq("product_id", product.id)
        .maybeSingle();
      if (e1) throw e1;
      let recipeId: string;
      if (existing) {
        recipeId = (existing as { id: string }).id;
      } else {
        const { data: created, error: e2 } = await supabase
          .from("recipes")
          .insert({ product_id: product.id, name: `Resep ${product.name}` })
          .select("id")
          .single();
        if (e2) throw e2;
        recipeId = (created as { id: string }).id;
      }
      // replace items
      const { error: e3 } = await supabase.from("recipe_items").delete().eq("recipe_id", recipeId);
      if (e3) throw e3;
      const rows = items.map((it) => ({
        recipe_id: recipeId,
        ingredient_id: it.ingredient_id,
        product_variant_id: it.product_variant_id,
        qty: Number(it.qty.replace(",", ".")),
      }));
      const { error: e4 } = await supabase.from("recipe_items").insert(rows);
      if (e4) throw e4;

      toast.success("Resep tersimpan");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan resep");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title={`Resep — ${product.name}`} size="lg">
      <p className="mb-4 text-sm text-gray-500">
        Tentukan takaran bahan per porsi{" "}
        <span className="font-medium text-brand-800">{product.name}</span>. Item bertanda
        <span className="mx-1 rounded bg-brand-100 px-1 text-xs">varian</span> khusus untuk varian tertentu.
      </p>

      {ingMap.size === 0 && (
        <div className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          Belum ada bahan aktif — tambahkan dulu di menu <b>Stok Bahan</b>.
        </div>
      )}

      <div className="space-y-2">
        {items.map((it, idx) => {
          const ing = ingMap.get(it.ingredient_id);
          return (
            <div key={idx} className="flex flex-wrap items-center gap-2 rounded-xl bg-cream p-2">
              <Select
                className="min-w-[150px] flex-1"
                value={it.ingredient_id}
                onChange={(e) =>
                  setItems((xs) => xs.map((x, j) => (j === idx ? { ...x, ingredient_id: e.target.value } : x)))
                }
              >
                <option value="">— pilih bahan —</option>
                {ingredients.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.units?.symbol})
                  </option>
                ))}
              </Select>
              <Input
                className="w-24"
                type="number"
                step="0.001"
                min={0}
                placeholder="0"
                value={it.qty}
                onChange={(e) => setItems((xs) => xs.map((x, j) => (j === idx ? { ...x, qty: e.target.value } : x)))}
              />
              <Select
                className="w-40"
                value={it.product_variant_id ?? ""}
                onChange={(e) =>
                  setItems((xs) =>
                    xs.map((x, j) =>
                      j === idx ? { ...x, product_variant_id: e.target.value || null } : x,
                    ),
                  )
                }
              >
                <option value="">Semua varian</option>
                {(product.product_variants ?? []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </Select>
              <span className="tnum ml-auto text-xs text-gray-500">
                {rupiah((Number(it.qty.replace(",", ".")) || 0) * num(ing?.stock_balances?.["avg_cost"] ?? 0))}
              </span>
              <Button variant="ghost" size="icon" onClick={() => setItems((xs) => xs.filter((_, j) => j !== idx))} aria-label="Hapus item">
                <Trash2 className="size-4 text-red-500" />
              </Button>
            </div>
          );
        })}
      </div>

      <Button
        variant="secondary"
        className="mt-3"
        onClick={() => setItems((xs) => [...xs, { ingredient_id: "", product_variant_id: null, qty: "" }])}
      >
        <Plus className="size-4" /> Tambah bahan
      </Button>

      {/* HPP preview */}
      <div className="mt-4 rounded-xl bg-brand-50 p-3">
        <p className="mb-1 text-sm font-semibold text-brand-900">Ringkasan HPP</p>
        <ul className="space-y-1 text-sm">
          {hppPerVariant.map((v) => (
            <li key={v.name} className="flex items-center justify-between">
              <span className="text-gray-600">{v.name}</span>
              <span className="tnum">
                HPP {rupiah(v.hpp)} · jual {rupiah(v.price)} · margin{" "}
                <b className={v.price > 0 ? "text-brand-700" : ""}>
                  {angka(v.price > 0 ? ((v.price - v.hpp) / v.price) * 100 : 0, 1)}%
                </b>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Batal
        </Button>
        <Button onClick={() => void save()} disabled={busy || ingredients.length === 0}>
          {busy ? "Menyimpan…" : "Simpan resep"}
        </Button>
      </div>
    </Dialog>
  );
}
