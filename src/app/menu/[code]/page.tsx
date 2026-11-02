"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ShoppingCart, CircleAlert } from "lucide-react";
import { rupiah } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/states";

/* ============================================================
 * QR Menu Publik — tanpa login. Pelanggan pilih menu → kirim pesanan.
 * Konfirmasi pesanan berhasil HANYA ketika server merespon HTTP 201.
 * ============================================================ */

interface PublicMenu {
  business: { name: string };
  categories: { id: string; name: string }[];
  products: {
    id: string;
    category_id: string | null;
    name: string;
    description: string | null;
    photo_url: string | null;
    price: number;
    is_available: boolean;
    product_variants: { id: string; name: string; price: number; is_available: boolean; is_active: boolean; sort_order: number }[];
  }[];
}

interface CartEntry {
  key: string;
  product: PublicMenu["products"][number];
  variant: { id: string; name: string; price: number } | null;
  qty: number;
}

const CART_KEY = "baksoku_cart";

export default function PublicMenuPage() {
  const { code, tableNo } = useMenuParams();
  const [menu, setMenu] = useState<PublicMenu | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [catId, setCatId] = useState<string>("all");
  const [cart, setCart] = useState<CartEntry[]>(loadCart);
  const [cartOpen, setCartOpen] = useState(false);
  const [name, setName] = useState("");
  const [orderType, setOrderType] = useState<"dine_in" | "takeaway">("dine_in");
  const [table, setTable] = useState(tableNo ?? "");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [placed, setPlaced] = useState<string | null>(null);
  const [variantFor, setVariantFor] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/public/menu/${code}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Gagal memuat menu");
          return;
        }
        setMenu(data as PublicMenu);
      } catch {
        setError("Tidak dapat menghubungi server. Pastikan Anda terhubung internet.");
      }
    })();
  }, [code]);

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart]);

  const filtered = useMemo(
    () => (menu?.products ?? []).filter((p) => catId === "all" || p.category_id === catId),
    [menu, catId],
  );

  const total = cart.reduce((s, c) => s + cLine(c) * c.qty, 0);
  const itemCount = cart.reduce((s, c) => s + c.qty, 0);

  function addToCart(product: PublicMenu["products"][number], variant?: { id: string; name: string; price: number }) {
    const key = `${product.id}|${variant?.id ?? ""}`;
    setCart((c) => {
      const idx = c.findIndex((x) => x.key === key);
      if (idx >= 0) {
        const copy = [...c];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
        return copy;
      }
      return [...c, { key, product, variant: variant ?? null, qty: 1 }];
    });
    toast.success(product.name + (variant ? ` (${variant.name})` : "") + " ditambahkan");
  }

  async function submitOrder() {
    if (cart.length === 0) return;
    if (!name.trim()) {
      toast.error("Nama wajib diisi");
      return;
    }
    if (orderType === "dine_in" && !table.trim()) {
      toast.error("Pilih / tulis nomor meja");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/public/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          business_code: code,
          customer_name: name.trim(),
          order_type: orderType,
          table_no: orderType === "dine_in" ? table.trim() : null,
          note: note.trim() || null,
          items: cart.map((c) => ({
            product_id: c.product.id,
            product_variant_id: c.variant?.id ?? null,
            qty: c.qty,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        toast.error(data.error ?? "Gagal mengirim pesanan");
        return;
      }
      // pesanan TERJAMAH hanya jika server mengonfirmasi (201)
      setPlaced(data.order_code);
      setCart([]);
      setCartOpen(false);
    } catch {
      toast.error("Koneksi bermasalah — pesanan belum terkirim.");
    } finally {
      setSending(false);
    }
  }

  if (error) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-cream px-6 text-center">
        <CircleAlert className="size-12 text-red-400" />
        <p className="font-semibold text-brand-900">{error}</p>
        <p className="text-sm text-gray-500">Pastikan QR Menu ditautkan dengan kode warung yang benar.</p>
      </main>
    );
  }
  if (!menu) {
    return (
      <main className="mx-auto max-w-xl space-y-3 p-4">
        <Skeleton className="h-8 w-40" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-dvh max-w-xl bg-cream pb-28">
      <header className="sticky top-0 z-20 bg-brand-800 px-4 py-4 text-white">
        <h1 className="text-lg font-bold">{menu.business.name}</h1>
        <p className="text-xs text-brand-200">Menu digital · beli langsung di warung</p>
        {tableNo && <p className="mt-1 text-xs">Meja: {tableNo}</p>}
      </header>

      <div className="flex gap-2 overflow-x-auto p-4 pb-2 scroll-thin">
        <Chip active={catId === "all"} onClick={() => setCatId("all")} label="Semua" />
        {menu.categories.map((c) => (
          <Chip key={c.id} active={catId === c.id} onClick={() => setCatId(c.id)} label={c.name} />
        ))}
      </div>

      <div className="space-y-2 px-4">
        {filtered.map((p) => (
          <Card key={p.id}>
            <div className="flex gap-3 p-3">
              {p.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.photo_url} alt={p.name} className="size-20 shrink-0 rounded-xl object-cover" />
              ) : (
                <div className="flex size-20 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-2xl">🍜</div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-brand-900">{p.name}</p>
                {p.description && <p className="line-clamp-2 text-xs text-gray-500">{p.description}</p>}
                <div className="mt-1.5 flex items-center justify-between">
                  <p className="tnum font-semibold text-brand-700">{rupiah(p.price)}</p>
                  {p.is_available ? (
                    p.product_variants?.filter((v) => v.is_active).length ? (
                      <Button size="sm" variant="outline" onClick={() => setVariantFor(p.id)}>Pilih variasi</Button>
                    ) : (
                      <Button size="sm" onClick={() => addToCart(p)}>
                        <ShoppingCart className="size-3.5" /> Tambah
                      </Button>
                    )
                  ) : (
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">Habis</span>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* cart floating */}
      {itemCount > 0 && (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="fixed inset-x-4 bottom-4 z-30 flex items-center justify-between rounded-2xl bg-brand-700 px-5 py-3.5 text-white shadow-xl"
        >
          <span className="flex items-center gap-2">
            <ShoppingCart className="size-5" />
            {itemCount} item
          </span>
          <span className="tnum font-semibold">{rupiah(total)}</span>
        </button>
      )}

      {/* variant picker */}
      <Dialog
        open={!!variantFor}
        onClose={() => setVariantFor(null)}
        title={menu.products.find((p) => p.id === variantFor)?.name ?? ""}
        size="sm"
      >
        {variantFor &&
          menu.products
            .find((p) => p.id === variantFor)!
            .product_variants.filter((v) => v.is_active)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((v) => (
              <Button
                key={v.id}
                size="lg"
                variant="outline"
                className="mb-2 w-full justify-between"
                disabled={!v.is_available}
                onClick={() => {
                  addToCart(menu.products.find((p) => p.id === variantFor)!, v);
                  setVariantFor(null);
                }}
              >
                <span>{v.name}</span>
                <span className="tnum">{rupiah(v.price)}</span>
              </Button>
            ))}
      </Dialog>

      {/* cart dialog */}
      <Dialog open={cartOpen} onClose={() => setCartOpen(false)} title="Keranjang & kirim pesanan" size="md">
        <div className="space-y-2">
          {cart.map((c) => (
            <div key={c.key} className="flex items-center gap-2 rounded-xl bg-cream p-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-brand-900">
                  {c.product.name} {c.variant && `- ${c.variant.name}`}
                </p>
                <p className="tnum text-xs text-gray-500">
                  {rupiah(cLine(c))} × {c.qty} = <b>{rupiah(cLine(c) * c.qty)}</b>
                </p>
              </div>
              <Button variant="outline" size="icon" className="size-7" onClick={() => setCart((xs) => xs.map((x) => (x.key === c.key ? { ...x, qty: x.qty - 1 } : x)).filter((x) => x.qty > 0))}>
                −
              </Button>
              <span className="tnum w-6 text-center">{c.qty}</span>
              <Button variant="outline" size="icon" className="size-7" onClick={() => setCart((xs) => xs.map((x) => (x.key === c.key ? { ...x, qty: x.qty + 1 } : x)))}>
                +
              </Button>
            </div>
          ))}
          {cart.length === 0 && <p className="py-4 text-center text-sm text-gray-400">Keranjang kosong</p>}
        </div>

        {cart.length > 0 && (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Nama Anda">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Ibu Ani" />
              </Field>
              <Field label="Tipe pesanan">
                <Select value={orderType} onChange={(e) => setOrderType(e.target.value as "dine_in" | "takeaway")}>
                  <option value="dine_in">Makan di tempat</option>
                  <option value="takeaway">Dibawa pulang</option>
                </Select>
              </Field>
            </div>
            {orderType === "dine_in" && (
              <Field label="Nomor meja">
                <Input value={table} onChange={(e) => setTable(e.target.value)} placeholder="mis. 5" />
              </Field>
            )}
            <Field label="Catatan (opsional)">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="mis. tanpa mie, kurangi sayur" />
            </Field>
            <p className="mb-2 text-right text-lg font-bold text-brand-900">Total: {rupiah(total)}</p>
        <Button size="lg" className="w-full" onClick={() => void submitOrder()} disabled={sending}>
          <ShoppingCart className="size-4" /> {sending ? "Mengirim…" : "Kirim pesanan"}
        </Button>
          </>
        )}
      </Dialog>

      {/* sukses */}
      <Dialog open={!!placed} onClose={() => setPlaced(null)} title="Pesanan tersimpan" size="sm">
        <p className="mb-2 text-sm text-gray-600">
          Pesanan Anda masuk ke warung. Tunjukkan kode berikut atau cek status berkala.
        </p>
        <p className="rounded-xl bg-brand-50 py-3 text-center text-2xl font-bold tracking-wider text-brand-800">{placed}</p>
        <Link
          href={`/order/${placed}`}
          className="mt-4 flex h-11 items-center justify-center rounded-xl bg-brand-700 text-sm font-medium text-white"
        >
          Lihat status pesanan
        </Link>
      </Dialog>
    </main>
  );
}

function cLine(c: CartEntry): number {
  return c.variant ? c.variant.price : c.product.price;
}

function useMenuParams(): { code: string; tableNo: string | null } {
  const [params, setParams] = useState<{ code: string; tableNo: string | null }>({ code: "", tableNo: null });
  useEffect(() => {
    setParams({ code: window.location.pathname.split("/")[2] ?? "", tableNo: new URLSearchParams(window.location.search).get("table") });
  }, []);
  return params;
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition",
        active ? "bg-brand-700 text-white" : "bg-white text-brand-800",
      )}
    >
      {label}
    </button>
  );
}

/* deterministik: muat keranjang dari localStorage */
function loadCart(): CartEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) ?? "[]") as CartEntry[];
  } catch {
    return [];
  }
}
