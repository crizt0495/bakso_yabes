"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabase/client";
import { productSchema, categorySchema, type ProductInput } from "@/lib/validation/schemas";
import type { Category, Product } from "@/types/database";
import { num, rupiah } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/states";
import { Package, Plus, Search, Pencil, ArrowLeftRight, Tag, X } from "lucide-react";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [showInactive, setShowInactive] = useState(true);
  const [editing, setEditing] = useState<Product | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);

  function reload() {
    const supabase = supabaseBrowser();
    setLoading(true);
    Promise.all([
      supabase
        .from("products")
        .select("*, categories(id,name), product_variants(*)")
        .order("sort_order")
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []) as unknown as Product[];
        }),
      supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order")
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []) as Category[];
        }),
    ])
      .then(([p, c]) => {
        setProducts(p);
        setCategories(c);
        setError(null);
      })
      .catch((e) => setError(e.message ?? "Gagal memuat"))
      .finally(() => setLoading(false));
  }

  useEffect(reload, []);

  const filtered = useMemo(
    () =>
      products.filter((p) => {
        if (!showInactive && !p.is_active) return false;
        if (catFilter !== "all" && p.category_id !== catFilter) return false;
        if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      }),
    [products, search, catFilter, showInactive],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-900">Produk</h1>
          <p className="text-sm text-gray-500">Menu warung ditampilkan di kasir & QR Menu</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCatOpen(true)}>
            <Tag className="size-4" /> Kategori
          </Button>
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" /> Produk baru
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-3 size-4 text-gray-400" />
          <Input
            className="pl-9"
            placeholder="Cari produk…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select className="w-44" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
          <option value="all">Semua kategori</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-2 rounded-xl border border-brand-200 bg-white px-3 text-sm">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Tampilkan nonaktif
        </label>
      </div>

      {error && <ErrorState message={error} />}
      {loading && <TableSkeleton rows={5} />}

      {!loading && !error && (
        <>
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Package className="size-12" />}
              title="Belum ada produk"
              description="Tambahkan produk pertama Anda, lalu atur resep & HPP-nya."
              action={
                <Button
                  className="mt-3"
                  onClick={() => {
                    setEditing(null);
                    setFormOpen(true);
                  }}
                >
                  <Plus className="size-4" /> Produk pertama
                </Button>
              }
            />
          ) : (
            <>
              {/* desktop table */}
              <Card className="hidden md:block">
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-brand-100 text-left text-xs uppercase text-gray-500">
                        <th className="px-4 py-3">Produk</th>
                        <th className="px-4 py-3">Kategori</th>
                        <th className="px-4 py-3 text-right">Harga</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-50">
                      {filtered.map((p) => (
                        <tr key={p.id} className={p.is_active ? "" : "opacity-50"}>
                          <td className="px-4 py-3">
                            <p className="font-medium text-brand-900">{p.name}</p>
                            {p.product_variants && p.product_variants.length > 0 && (
                              <p className="text-xs text-gray-500">
                                Variasi: {p.product_variants.filter((v) => v.is_active).map((v) => v.name).join(", ")}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-600">{p.categories?.name ?? "-"}</td>
                          <td className="tnum px-4 py-3 text-right font-medium">{rupiah(p.price)}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              <Badge tone={p.is_active ? "green" : "gray"}>
                                {p.is_active ? "Aktif" : "Nonaktif"}
                              </Badge>
                              {!p.is_available && <Badge tone="red">Habis</Badge>}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => setEditing(p)} aria-label="Edit">
                                <Pencil className="size-4" />
                              </Button>
                              <ToggleActiveButton product={p} onDone={reload} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {/* mobile cards */}
              <div className="grid gap-3 md:hidden" id="products-mobile">
                {filtered.map((p) => (
                  <Card key={p.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-brand-900">{p.name}</p>
                          <p className="text-xs text-gray-500">{p.categories?.name ?? "-"}</p>
                        </div>
                        <p className="tnum font-semibold">{rupiah(p.price)}</p>
                      </div>
                      {p.product_variants && p.product_variants.length > 0 && (
                        <p className="mt-1 text-xs text-gray-500">
                          Variasi: {p.product_variants.filter((v) => v.is_active).map((v) => v.name).join(", ")}
                        </p>
                      )}
                      <div className="mt-3 flex items-center justify-between">
                        <Badge tone={p.is_active ? "green" : "gray"}>{p.is_active ? "Aktif" : "Nonaktif"}</Badge>
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" onClick={() => setEditing(p)}>
                            <Pencil className="size-3.5" /> Edit
                          </Button>
                          <ToggleActiveButton product={p} onDone={reload} compact />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <ProductFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        product={editing}
        categories={categories}
        onSaved={() => {
          setFormOpen(false);
          reload();
        }}
      />
      <CategoryDialog
        open={catOpen}
        onClose={() => setCatOpen(false)}
        categories={categories}
        onChanged={reload}
      />
    </div>
  );
}

/* ---------- aktif/nonaktif ---------- */
function ToggleActiveButton({
  product,
  onDone,
  compact = false,
}: {
  product: Product;
  onDone: () => void;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    const supabase = supabaseBrowser();
    const { error: err } = await supabase
      .from("products")
      .update({ is_active: !product.is_active })
      .eq("id", product.id);
    setBusy(false);
    if (err) {
      toast.error(err.message);
      return;
    }
    toast.success(product.is_active ? "Produk dinonaktifkan" : "Produk diaktifkan");
    onDone();
  }
  return (
    <Button variant={compact ? "ghost" : "ghost"} size="icon" onClick={toggle} disabled={busy} aria-label="Aktif/Hapus produk">
      <ArrowLeftRight className="size-4" />
    </Button>
  );
}

/* ---------- form product ---------- */
function ProductFormDialog({
  open,
  onClose,
  product,
  categories,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  product: Product | null;
  categories: Category[];
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [form, setForm] = useState<ProductInput>({
    name: "",
    category_id: null,
    description: "",
    photo_url: "",
    price: 0,
    is_available: true,
    is_active: true,
    sort_order: 0,
    variants: [],
  });

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm({
      name: product?.name ?? "",
      category_id: product?.category_id ?? null,
      description: product?.description ?? "",
      photo_url: product?.photo_url ?? "",
      price: num(product?.price),
      is_available: product?.is_available ?? true,
      is_active: product?.is_active ?? true,
      sort_order: product?.sort_order ?? 0,
      variants: (product?.product_variants ?? []).map((v) => ({
        id: v.id,
        name: v.name,
        price: num(v.price),
        is_available: v.is_available,
        sort_order: v.sort_order,
      })),
    });
  }, [open, product]);

  const set = <K extends keyof ProductInput>(k: K, v: ProductInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    const parsed = productSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string[]> = {};
      for (const iss of parsed.error.issues) {
        const key = iss.path.join(".") || "root";
        (errs[key] ??= []).push(iss.message);
      }
      setErrors(errs);
      return;
    }
    setSaving(true);
    try {
      const supabase = supabaseBrowser();
      const { variants, ...values } = parsed.data;
      const payloadDB = {
        ...values,
        category_id: values.category_id || null,
        photo_url: values.photo_url || null,
      };

      let productId: string;
      if (product) {
        const { error: err } = await supabase.from("products").update(payloadDB).eq("id", product.id);
        if (err) throw err;
        productId = product.id;
      } else {
        const { data: created, error: err } = await supabase
          .from("products")
          .insert(payloadDB)
          .select("id")
          .single();
        if (err) throw err;
        productId = (created as { id: string }).id;
      }

      // variants sync
      const keepIds = variants.filter((v) => v.id).map((v) => v.id);
      const existing = product?.product_variants ?? [];
      const toDelete = existing.filter((e) => !keepIds.includes(e.id)).map((e) => e.id);
      if (toDelete.length > 0) {
        await supabase.from("product_variants").delete().in("id", toDelete);
      }
      for (const [i, v] of variants.entries()) {
        const row = {
          product_id: productId,
          name: v.name,
          price: v.price,
          is_available: v.is_available,
          sort_order: v.sort_order ?? i,
        };
        if (v.id) {
          await supabase.from("product_variants").update(row).eq("id", v.id);
        } else {
          await supabase.from("product_variants").insert(row);
        }
      }

      toast.success(product ? "Produk diperbarui" : "Produk disimpan");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan produk");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={product ? "Edit produk" : "Produk baru"} size="lg">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="grid gap-0 sm:grid-cols-2">
          <div>
            <Field label="Nama produk" error={errors.name}>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Bakso Spesial" />
            </Field>
          </div>
          <div>
            <Field label="Kategori" error={errors.category_id}>
              <Select
                value={form.category_id ?? ""}
                onChange={(e) => set("category_id", e.target.value || null)}
              >
                <option value="">- pilih kategori -</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div>
            <Field label="Harga jual (Rp)" error={errors.price}>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                value={form.price || ""}
                onChange={(e) => set("price", Number(e.target.value))}
                placeholder="mis. 15000"
              />
              {form.price ? (
                <p className="mt-1 text-xs text-gray-500">{rupiah(form.price)} — ribuan otomatis</p>
              ) : null}
            </Field>
          </div>
          <div>
            <Field label="Urutan tampil" hint="Semakin kecil semakin atas" error={errors.sort_order}>
              <Input
                type="number"
                value={form.sort_order ?? 0}
                onChange={(e) => set("sort_order", Number(e.target.value))}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Foto (URL)" hint="Opsional — tautan foto produk" error={errors.photo_url}>
              <Input value={form.photo_url ?? ""} onChange={(e) => set("photo_url", e.target.value)} placeholder="https://…" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Deskripsi" error={errors.description}>
              <Textarea value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} />
            </Field>
          </div>
          <div className="sm:col-span-2 flex gap-6 rounded-xl bg-brand-50 p-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_available}
                onChange={(e) => set("is_available", e.target.checked)}
              />
              Tersedia (tidak habis)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_active} onChange={(e) => set("is_active", e.target.checked)} />
              Aktif (tampil di kasir & QR menu)
            </label>
          </div>
        </div>

        {/* variations */}
        <div className="mt-4 rounded-xl border border-brand-100 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-brand-900">Variasi (opsional)</p>
            <Button variant="secondary" size="sm" onClick={() => set("variants", [...form.variants, { name: "", price: form.price, is_available: true, sort_order: form.variants.length }])}>
              <Plus className="size-3.5" /> Tambah variasi
            </Button>
          </div>
          {form.variants.length === 0 && <p className="text-xs text-gray-500">Contoh: Kecil / Sedang / Jumbo.</p>}
          <div className="space-y-2">
            {form.variants.map((v, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  className="flex-1"
                  placeholder="Nama variasi"
                  value={v.name}
                  onChange={(e) =>
                    set(
                      "variants",
                      form.variants.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)),
                    )
                  }
                />
                <div className="w-32">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={v.price || ""}
                    onChange={(e) =>
                      set(
                        "variants",
                        form.variants.map((x, j) => (j === i ? { ...x, price: Number(e.target.value) } : x)),
                      )
                    }
                    placeholder="mis. 15000"
                  />
                  {v.price ? (
                    <p className="mt-0.5 text-[11px] text-gray-400">{rupiah(v.price)}</p>
                  ) : null}
                </div>
                <Button variant="ghost" size="icon" onClick={() => set("variants", form.variants.filter((_, j) => j !== i))} aria-label="Hapus variasi">
                  <X className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving}>
            {saving ? "Menyimpan…" : "Simpan"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/* ---------- categories ---------- */
function CategoryDialog({
  open,
  onClose,
  categories,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function add() {
    const parsed = categorySchema.safeParse({ name, sort_order: categories.length });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Nama kategori tidak valid");
      return;
    }
    setSaving(true);
    const { error: err } = await supabaseBrowser().from("categories").insert(parsed.data);
    setSaving(false);
    if (err) {
      toast.error(err.message);
      return;
    }
    toast.success("Kategori ditambahkan");
    setName("");
    onChanged();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Kategori" size="sm">
      <div className="mb-4 flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama kategori" />
        <Button onClick={() => void add()} disabled={saving}>
          <Plus className="size-4" />
        </Button>
      </div>
      <ul className="space-y-1 text-sm">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center justify-between rounded-lg bg-cream px-3 py-2">
            <span>{c.name}</span>
            <span className="text-xs text-gray-400">urutan {c.sort_order}</span>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
