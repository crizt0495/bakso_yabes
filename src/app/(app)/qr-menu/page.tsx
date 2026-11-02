"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Business } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";


export default function QrMenuPage() {
  const [biz, setBiz] = useState<Business | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [menuUrl, setMenuUrl] = useState("");

  useEffect(() => {
    void (async () => {
      const { data: profile } = await supabaseBrowser().from("profiles").select("business_id").maybeSingle();
      if (!profile) return;
      const { data: b } = await supabaseBrowser()
        .from("businesses")
        .select("*")
        .eq("id", (profile as { business_id: string }).business_id)
        .single();
      setBiz((b ?? null) as unknown as Business);
    })();
  }, []);

  useEffect(() => {
    if (!biz) return;
    const url = `${window.location.origin}/menu/${biz.qr_menu_code}`;
    setMenuUrl(url);
    QRCode.toDataURL(url, { width: 512, margin: 2, color: { dark: "#1a3d27", light: "#ffffff" } })
      .then(setQrUrl)
      .catch(() => setQrUrl(null));
  }, [biz]);

  async function toggle() {
    if (!biz) return;
    setBusy(true);
    const { error: err } = await supabaseBrowser()
      .from("businesses")
      .update({ qr_menu_enabled: !biz.qr_menu_enabled })
      .eq("id", biz.id);
    setBusy(false);
    if (err) {
      toast.error(err.message);
      return;
    }
    toast.success(biz.qr_menu_enabled ? "QR menu dinonaktifkan" : "QR menu diaktifkan");
    setBiz({ ...biz, qr_menu_enabled: !biz.qr_menu_enabled });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-brand-900">QR Menu</h1>
        <p className="text-sm text-gray-500">
          Cetak QR untuk meja — pelanggan melihat menu & mengirim pesanan.
        </p>
      </div>

      {biz && (
        <>
          <Card>
            <CardContent className="flex flex-col items-center gap-4 p-6 sm:flex-row sm:items-start">
              <div className="rounded-2xl border-4 border-brand-700 p-2">
                {qrUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrUrl} alt="QR Menu" className="size-52" />
                ) : (
                  <div className="flex size-52 items-center justify-center text-sm text-gray-400">Membuat QR…</div>
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600">
                  URL menu:
                  <a className="block truncate font-medium text-brand-700 underline" href={menuUrl} target="_blank" rel="noreferrer">
                    {menuUrl}
                  </a>
                </p>
                <p className="mt-3 text-sm text-gray-600">
                  Kode menu: <code className="rounded bg-cream px-2 py-0.5">{biz.qr_menu_code}</code>
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button onClick={toggle} variant={biz.qr_menu_enabled ? "outline" : "default"} disabled={busy}>
                    {biz.qr_menu_enabled ? "Nonaktifkan QR Menu" : "Aktifkan QR Menu"}
                  </Button>
                  {qrUrl && (
                    <a href={qrUrl} download="qr-menu-baksoku.png">
                      <Button variant="outline">Unduh QR (PNG)</Button>
                    </a>
                  )}
                  <Link href={menuUrl} target="_blank">
                    <Button variant="ghost">Buka menu publik</Button>
                  </Link>
                </div>
                <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Status:{biz.qr_menu_enabled ? " AKTIF — pelanggan dapat mengirim pesanan." : " NONAKTIF — pelanggan hanya melihat pesan menu tutup."}
                </p>
              </div>
            </CardContent>
          </Card>

          <p className="text-xs text-gray-500">
            Tips: tambahkan <code className="rounded bg-cream px-1">?table=5</code> di akhir URL untuk QR
            per-meja (meja otomatis terisi saat pelanggan scan).
          </p>
        </>
      )}
    </div>
  );
}
