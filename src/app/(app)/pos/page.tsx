"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLiveQuery } from "dexie-react-hooks";
import { supabaseBrowser } from "@/lib/supabase/client";
import { buildSalePayload, totals, type CartLine } from "@/lib/business/sale";
import { rupiah } from "@/lib/utils/format";
import { cn, uid } from "@/lib/utils/cn";
import { db, type CachedCategory } from "@/features/sync/db";
import { enqueueSale, applyLocalStockDeduction, refreshCache, getDeviceId } from "@/features/sync/sync-engine";
import { useSyncStatus } from "@/features/sync/use-sync-status";
import { Badge, Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, TableSkeleton } from "@/components/ui/states";
import {
  Backpack,
  CircleDollarSign,
  Minus,
  Plus,
  QrCode,
  Search,
  Send,
  ShoppingBag,
  UtensilsCrossed,
} from "lucide-react";
import type { Customer } from "@/types/database";
import { ReceiptDialog, type ReceiptReady } from "./receipt-dialog";

/* ============================================================
 * Halaman Kasir — berjalan penuh OFFLINE:
 * - produk & resep di-cache ke IndexedDB (Dexie)
 * - transaksi disimpan lokal lalu disinkronkan otomatis
 * - klik ganda tidak membuat duplikat (UUID idempotency)
 * ============================================================ */
export default function PosPage() {
  const { online, pending } = useSyncStatus();
  const [loading, setLoading] = useState(true);
  const [cats, setCats] = useState<(CachedCategory & { pinned?: boolean })[]>([]);
  const [catId, setCatId] = useState<string>("all");
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [orderType, setOrderType] = useState<"dine_in" | "takeaway">("takeaway");
  const [tableId, setTableId] = useState<string>("");
  const [discount, setDiscount] = useState<number>(0);
  const [method, setMethod] = useState<"cash" | "qris">("cash");
  const [paid, setPaid] = useState<string>("");
  const [note, setNote] = useState("");
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptReady | null>(null);

  const products: any = [];
  const variants: any = [];
  const tables: any = [];

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSel, setCustomerSel] = useState<string | null>(null);

  /* cache pertama kali */
  useEffect(() => {
    (async () => {
      let ok = false;
      try { ok = await refreshCache(); } catch { ok = false; }
      if (!ok) {
        const cached = await db.products.count();
        if (cached > 0) toast.info("Menampilkan data ter-cache — internet tidak tersedia.");
        else if (!offlineNote.current) {
          toast.error("Belum ada data menu ter-cache. Sambungkan internet sekali untuk pertama kali.");
          offlineNote.current = true;
        }
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try { db?.categories?.orderBy("sort_order").toArray().then(setCats).catch(() => {}); } catch { /* ignore */ }
  }, [products?.length]);

  /* pelanggan (butuh internet, opsional) */
  useEffect(() => {
    try {
      supabaseBrowser()
        .from("customers")
        .select("id,name,phone,note")
        .order("name")
        .limit(200)
        .then(({ data }) => setCustomers((data ?? []) as unknown as Customer[]))
        .catch(() => {});
    } catch {
      // env belum ada — abaikan
    }
  }, [online]);

  const filteredProducts = useMemo(() => {
    let list = (products ?? []).filter((p) => p.is_active);
    if (catId !== "all") list = list.filter((p) => p.category_id === catId);
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
    return list;
  }, [products, catId, q]);

  const variantMap = useMemo(() => {
    const map = new Map<string, typeof variants>();
    for (const v of variants ?? []) {
      const arr = map.get(v.product_id) ?? [];
      arr.push(v);
      map.set(v.product_id, arr.filter((x) => x.is_active));
    }
    return map;
  }, [variants]);


  const paidNum = method === "cash" ? parseNumber(paid) : 0;
  const t = totals(cart, discount, paidNum);

  function addProduct(productId: string, variantId?: string) {
    const product = (products ?? []).find((p) => p.id === productId);
    if (!product) return;
    if (!product.is_available) {
      toast.warning(`${product.name} sedang habis. Ubah status ketersediaan di menu Produk.`);
      return;
    }
    const variant = variantId ? (variantMap.get(productId) ?? []).find((v) => v.id === variantId) : undefined;
    const unitPrice = variant ? variant.price : product.price;

    setCart((c) => {
      const key = `${productId}|${variantId ?? ""}`;
      const idx = c.findIndex((l) => `${l.product_id}|${l.variant_id ?? ""}` === key);
      if (idx >= 0) {
        const copy = [...c];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
        return copy;
      }
      return [
        ...c,
        {
          product_id: productId,
          variant_id: variantId ?? null,
          product_name: product.name,
          variant_name: variant?.name ?? null,
          unit_price: unitPrice,
          qty: 1,
          note: null,
        },
      ];
    });
  }

  function updateQty(index: number, delta: number) {
    setCart((c) =>
      c
        .map((l, i) => (i === index ? { ...l, qty: Math.max(0, l.qty + delta) } : l))
        .filter((l) => l.qty > 0),
    );
  }
  function setQty(index: number, qty: number) {
    setCart((c) =>
      c.map((l, i) => (i === index ? { ...l, qty: Math.max(1, qty) } : l)),
    );
  }
  function setLineNote(index: number, note: string) {
    setCart((c) => c.map((l, i) => (i === index ? { ...l, note: note || null } : l)));
  }

  async function checkout() {
    if (cart.length === 0) return;
    if (t.total <= 0) {
      toast.error("Total tidak boleh nol");
      return;
    }
    if (orderType === "dine_in" && !tableId) {
      toast.error("Pilih nomor meja untuk makan di tempat");
      return;
    }
    if (method === "cash" && parseNumber(paid) < t.total) {
      toast.error("Nominal uang diterima kurang dari total");
      return;
    }
    setCheckoutBusy(true);
    const idem = uid();
    const occurred = new Date().toISOString();
    const deviceId = await getDeviceId();
    const payload = buildSalePayload(cart, {
      discount,
      paidAmount: method === "cash" ? parseNumber(paid) : t.total,
      paymentMethod: method,
      orderType,
      tableId: orderType === "dine_in" ? tableId : null,
      customerId: customerSel,
      customerName: customerSel ? customers.find((c) => c.id === customerSel)?.name ?? null : null,
      note,
      deviceId,
      idempotencyKey: idem,
      occurredAt: occurred,
    });

    const res = await enqueueSale({
      idempotency_key: idem,
      total: t.total,
      occurred_at: occurred,
      receiptPreview: previewNo.current,
      cart: cart,
      salePayload: payload,
    });

    // kurangi stok lokal (estimasi; server yang menghitung final)
    await applyLocalStockDeduction(payload);

    void res;
    const fake = {
      idem,
      lines: cart,
      discount,
      method,
      paid: method === "cash" ? parseNumber(paid) : t.total,
      total: t.total,
      orderType,
      tableId,
    } satisfies ReceiptReady;

    setReceiptData(fake);
    setCart([]);
    setDiscount(0);
    setPaid("");
    setNote("");
    setOrderType("takeaway");
    toast.success(
      online
        ? "Transaksi tersimpan — menyinkronkan…"
        : "Transaksi disimpan di HP. Akan terkirim otomatis saat online.",
    );

    await refreshCache().catch(() => undefined);
    setCheckoutBusy(false);
  }

  const offlineNote = useRef(false);
  const previewNo = useRef("(menunggu nota online)");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-brand-900">Kasir</h1>
          <p className="text-sm text-gray-500">
            {online ? "Terhubung" : "Offline — transaksi tersimpan lokal"} {pending > 0 && `· ${pending} antre`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refreshCache()}>
          <Search className="size-3.5" /> Segarkan menu
        </Button>
      </div>

      {loading && <TableSkeleton rows={4} />}

      {!loading && (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          {/* ---- Katalog ---- */}
          <div>
            <div className="mb-3 flex flex-wrap gap-2">
              <div className="relative min-w-[180px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-3 size-4 text-gray-400" />
                <Input className="pl-9" placeholder="Cari menu…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            </div>
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1 scroll-thin">
              <CatChip all active={catId === "all"} onClick={() => setCatId("all")} label="Semua" />
              {cats.map((c) => (
                <CatChip key={c.id} active={catId === c.id} onClick={() => setCatId(c.id)} label={c.name} />
              ))}
            </div>

            {(filteredProducts?.length ?? 0) === 0 && (products ?? []).length === 0 ? (
              <EmptyState
                icon={<ShoppingBag className="size-12" />}
                title="Menu belum tersedia"
                description={online ? "Tambahkan produk di menu Produk." : "Sambungkan internet sekali untuk mengunduh menu."}
              />
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                {filteredProducts.map((p) => (
                  <ProductTile
                    key={p.id}
                    name={p.name}
                    price={p.price}
                    isAvailable={p.is_available}
                    hasVariants={(variantMap.get(p.id) ?? []).length > 0}
                    variants={(variantMap.get(p.id) ?? []).filter((v) => v.is_available).map((v) => ({ id: v.id, name: v.name }))}
                    onPick={() => addProduct(p.id)}
                    onPickVariant={(vid) => addProduct(p.id, vid)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ---- Keranjang ---- */}
          <div className="lg:sticky lg:top-20 self-start">
            <Card>
              <CardContent className="p-4">
                <div className="mb-3 grid grid-cols-2 gap-2">
                  <Button
                    variant={orderType === "dine_in" ? "default" : "outline"}
                    onClick={() => setOrderType("dine_in")}
                    className="flex-1"
                  >
                    <UtensilsCrossed className="size-4" /> Di tempat
                  </Button>
                  <Button
                    variant={orderType === "takeaway" ? "default" : "outline"}
                    onClick={() => setOrderType("takeaway")}
                    className="flex-1"
                  >
                    <Backpack className="size-4" /> Bawa pulang
                  </Button>
                </div>

                {orderType === "dine_in" && (
                  <Field label="Meja">
                    <Select value={tableId} onChange={(e) => setTableId(e.target.value)}>
                      <option value="">— pilih meja —</option>
                      {(tables ?? []).map((tb) => (
                        <option key={tb.id} value={tb.id}>
                          {tb.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}

                {/* item list */}
                <div className="max-h-64 space-y-2 overflow-y-auto scroll-thin">
                  {cart.length === 0 && <p className="py-6 text-center text-sm text-gray-400">Keranjang kosong</p>}
                  {cart.map((line, idx) => (
                    <div key={`${line.product_id}|${line.variant_id ?? ""}`} className="rounded-xl bg-cream p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-brand-900">{line.product_name}</p>
                          {line.variant_name && <p className="text-xs text-gray-500">{line.variant_name}</p>}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="outline" size="icon" className="size-7" onClick={() => updateQty(idx, -1)}>
                            <Minus className="size-3" />
                          </Button>
                          <Input
                            className="h-7 w-12 px-1 text-center text-sm"
                            type="number"
                            min={1}
                            value={line.qty}
                            onChange={(e) => setQty(idx, Number(e.target.value))}
                          />
                          <Button variant="outline" size="icon" className="size-7" onClick={() => updateQty(idx, 1)}>
                            <Plus className="size-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between">
                        <Input
                          className="mr-2 h-7 min-w-0 flex-1 text-xs"
                          placeholder="Catatan (mis. tidak pakai mie)"
                          value={line.note ?? ""}
                          onChange={(e) => setLineNote(idx, e.target.value)}
                        />
                        <span className="tnum text-sm font-semibold">{rupiah(line.unit_price * line.qty)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* customer */}
                <Field label="Pelanggan (opsional)">
                  <Select value={customerSel ?? ""} onChange={(e) => setCustomerSel(e.target.value || null)}>
                    <option value="">Tanpa data pelanggan</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Diskon (Rp)">
                  <Input type="number" min={0} value={discount}
                    onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))} />
                </Field>

                <Field label="Catatan">
                  <Textarea className="min-h-[48px]" value={note} onChange={(e) => setNote(e.target.value)} placeholder="mis. tanpa sayur, pedas" />
                </Field>

                {/* metode */}
                <div className="grid grid-cols-2 gap-2">
                  <Button variant={method === "cash" ? "default" : "outline"} onClick={() => setMethod("cash")}>
                    <CircleDollarSign className="size-4" /> Tunai
                  </Button>
                  <Button variant={method === "qris" ? "default" : "outline"} onClick={() => setMethod("qris")}>
                    <QrCode className="size-4" /> QRIS
                  </Button>
                </div>

                {method === "cash" && (
                  <Field label="Uang diterima (Rp)">
                    <Input
                      type="number"
                      value={paid}
                      onChange={(e) => setPaid(e.target.value)}
                      placeholder="0"
                      min={0}
                    />
                  </Field>
                )}
                {method === "qris" && (
                  <p className="mb-3 rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-800">
                    QRIS: pastikan pelanggan menunjukkan <b>screenshot pembayaran yang benar</b>, status final
                    diverifikasi lewat penyedia pembayaran.
                  </p>
                )}

                <div className="mt-1 space-y-1 border-t border-brand-100 pt-3 text-sm">
                  <Row label="Subtotal" value={rupiah(t.subtotal)} />
                  {discount > 0 && <Row label="Diskon" value={`- ${rupiah(t.discount)}`} red />}
                  <Row label="Total" value={rupiah(t.total)} big />
                  {method === "cash" && parseNumber(paid) >= t.total && (
                    <Row label="Kembali" value={rupiah(t.change)} />
                  )}
                </div>

                <Button
                  size="xl"
                  className="mt-3 w-full text-lg"
                  disabled={cart.length === 0 || checkoutBusy}
                  onClick={() => void checkout()}
                >
                  <Send className="size-5" /> {checkoutBusy ? "Menyimpan…" : "Bayar & Simpan"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* struk */}
      {receiptData && (
        <ReceiptDialog
          data={receiptData}
          note={note}
          customers={customers.filter((c) => c.id === customerSel)}
          onClose={() => setReceiptData(null)}
        />
      )}
    </div>
  );
}

/* ---------- potongan UI ---------- */
function CatChip({ label, active, onClick, all }: { label: string; active: boolean; onClick: () => void; all?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-medium transition",
        active ? "bg-brand-700 text-white" : "bg-white text-brand-800 hover:bg-brand-100",
      )}
    >
      {all && "Semua"}
      {label}
    </button>
  );
}

interface MiniVariant {
  id: string;
  name: string;
}

function ProductTile({
  name,
  price,
  isAvailable,
  hasVariants,
  variants,
  onPick,
  onPickVariant,
}: {
  name: string;
  price: number;
  isAvailable: boolean;
  hasVariants: boolean;
  variants: MiniVariant[];
  onPick: () => void;
  onPickVariant: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        disabled={!isAvailable}
        onClick={() => {
          if (hasVariants) setOpen(true);
          else onPick();
        }}
        className={cn(
          "flex h-24 w-full flex-col items-start justify-between rounded-2xl border border-brand-100 bg-white p-3 text-left shadow-card transition active:scale-95 disabled:opacity-40 disabled:grayscale",
          isAvailable && "hover:border-brand-300",
        )}
      >
        <span className="line-clamp-2 text-sm font-medium text-brand-900">{name}</span>
        <span className="tnum text-sm font-bold text-brand-700">{rupiah(price)}</span>
      </button>
      {!isAvailable && (
        <Badge tone="red" className="absolute right-2 top-2">
          Habis
        </Badge>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title={name} size="sm">
        <p className="mb-2 text-sm text-gray-500">Pilih variasi:</p>
        <div className="grid gap-2">
          {variants.map((v) => (
            <Button key={v.id} size="lg" onClick={() => { setOpen(false); onPickVariant(v.id); }}>
              {v.name}
            </Button>
          ))}
        </div>
      </Dialog>
    </div>
  );
}

function Row({ label, value, big, red }: { label: string; value: string; big?: boolean; red?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between", big && "text-lg font-bold text-brand-900")}>
      <span className={cn("text-gray-500", big && "text-base font-semibold text-brand-900")}>{label}</span>
      <span className={cn("tnum", red && "text-red-600")}>{value}</span>
    </div>
  );
}

function parseNumber(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

