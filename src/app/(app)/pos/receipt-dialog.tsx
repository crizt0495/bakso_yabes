"use client";

import { Printer, BadgeCheck, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { rupiah, angka, labelOrderType } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { CartLine } from "@/lib/business/sale";
import type { Customer } from "@/types/database";

/**
 * Struk kasir — tampil di layar & bisa dicetak (window.print).
 * Nomor nota final akan tampil di Riwayat/Transaksi setelah sinkron.
 */
export interface ReceiptReady {
  idem: string;
  lines: CartLine[];
  discount: number;
  method: string;
  paid: number;
  total: number;
  orderType: string;
  tableId: string;
}
export function ReceiptDialog({
  data,
  note,
  customers,
  onClose,
}: {
  data: ReceiptReady;
  note: string;
  customers: Customer[];
  onClose: () => void;
}) {
  const customer = customers[0];
  const t = data.total;

  function print() {
    window.print();
  }

  const body = (
    <div id="struk" className="mx-auto w-[300px] bg-white font-mono text-[13px] text-gray-900">
      <div className="text-center">
        <p className="text-lg font-bold tracking-widest">BAKSO YABES</p>
        <p className="text-xs text-gray-500">Struk transaksi</p>
      </div>
      <div className="my-2 border-y border-dashed border-gray-300 py-1.5 text-xs">
        <p>Kode: {data.idem.slice(0, 8).toUpperCase()}</p>
        <p>{new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}</p>
        <p>{labelOrderType(data.orderType)}</p>
        {customer && <p>Pelanggan: {customer.name}</p>}
      </div>
      <table className="w-full text-left">
        <tbody>
          {data.lines.map((l, i) => (
            <tr key={i} className="align-top">
              <td className="py-0.5 pr-1">
                {angka(l.qty)}× {l.product_name}
                {l.variant_name ? ` (${l.variant_name})` : ""}
                {l.note && <span className="block text-[11px] italic text-gray-500">· {l.note}</span>}
              </td>
              <td className="tnum py-0.5 text-right">{rupiah(l.unit_price * l.qty)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {note && <p className="border-t border-dashed border-gray-300 py-1 text-xs italic">Catatan: {note}</p>}
      <div className="mt-2 border-t border-dashed border-gray-300 pt-1.5 text-sm">
        <RowSum label="Subtotal" value={rupiah(t)} />
        {data.discount > 0 && <RowSum label="Diskon" value={`- ${rupiah(data.discount)}`} />}
        <RowSum label="TOTAL" value={rupiah(t)} bold />
        <RowSum label={data.method === "cash" ? "Tunai" : "QRIS"} value={rupiah(data.paid)} />
        {data.method === "cash" && <RowSum label="Kembali" value={rupiah(data.paid - t)} />}
      </div>
      <p className="mt-3 text-center text-xs text-gray-500">Terima kasih — silakan datang kembali!</p>
    </div>
  );

  return (
    <Dialog open onClose={onClose} title="Struk" size="sm">
      <div className="flex items-center gap-2 mb-3">
        {data.method === "qris" ? (
          <span className="flex items-center gap-1.5 rounded-lg bg-sky-50 px-2 py-1 text-xs text-sky-800">
            <WifiOff className="size-3.5" /> Menunggu sinkronisasi QRIS dinamis
          </span>
        ) : (
          <BadgeCheck className="size-4 text-brand-600" />
        )}
        <span className="text-xs text-gray-500">Transaksi tersimpan di perangkat & antrean sinkron.</span>
      </div>
      <div className="rounded-xl border border-dashed border-gray-300 p-3">{body}</div>
      <div className={cn("mt-4 grid grid-cols-2 gap-2")}>
        <Button variant="outline" onClick={print}>
          <Printer className="size-4" /> Cetak
        </Button>
        <Button onClick={onClose}>Selesai</Button>
      </div>
    </Dialog>
  );
}

function RowSum({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={cn("flex justify-between", bold && "text-base font-bold")}>
      <span>{label}</span>
      <span className="tnum">{value}</span>
    </div>
  );
}
