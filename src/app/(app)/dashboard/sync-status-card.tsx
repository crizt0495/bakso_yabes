"use client";

import { useSyncStatus } from "@/features/sync/use-sync-status";
import { refreshCache, retryFailed, syncNow } from "@/features/sync/sync-engine";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CloudOff, Cloud, RefreshCw, DatabaseZap, RotateCcw } from "lucide-react";

/** Kartu status koneksi internet + sinkronisasi (requiro dashboard #12 & #13). */
export function SyncStatusCard() {
  const { online, pending, syncing } = useSyncStatus();

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          {online ? (
            <Cloud className="size-5 text-brand-500" />
          ) : (
            <CloudOff className="size-5 text-red-500" />
          )}
          <div>
            <p className="text-sm font-semibold text-brand-900">
              {online ? "Terhubung ke internet" : "Mode offline"}
            </p>
            <p className="text-xs text-gray-500">
              {online
                ? "Data master & transaksi tersinkron otomatis saat koneksi pulih."
                : "Kasir tetap bisa dipakai. Transaksi tersimpan aman di perangkat."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {pending > 0 && (
            <span className="flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
              <DatabaseZap className="size-3.5" />
              {pending} transaksi belum tersinkron
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => void refreshCache()} disabled={!online || syncing}>
            <RefreshCw className={`size-3.5 ${syncing ? "animate-spin" : ""}`} />
            Segarkan data
          </Button>
          <Button variant="outline" size="sm" onClick={() => void syncNow("ui")} disabled={!online || syncing}>
            <DatabaseZap className="size-3.5" />
            Sinkronkan
          </Button>
          {pending > 0 && (
            <Button variant="ghost" size="sm" onClick={() => void retryFailed()} disabled={!online || syncing}>
              <RotateCcw className="size-3.5" />
              Coba gagal lagi
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
