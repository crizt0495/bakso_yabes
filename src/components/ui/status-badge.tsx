"use client";

import { useSyncStatus } from "@/features/sync/use-sync-status";
import { CloudOff, Cloud, RefreshCw } from "lucide-react";
import { Tooltip } from "./tooltip";

/** Indikator status koneksi & sinkronisasi (dipakai di dashboard/header). */
export function StatusBadge({ variant = "full" }: { variant?: "full" | "compact" }) {
  const { online, pending, syncing, syncNow } = useSyncStatus();

  const clickable = pending > 0 || online === false;
  const onClick = clickable ? syncNow : undefined;

  const content =
    variant === "compact" ? (
      <span className="flex items-center gap-1.5">
        {online ? <Cloud className="size-4" /> : <CloudOff className="size-4 text-red-500" />}
        {pending > 0 && <span className="text-xs font-semibold">{pending}</span>}
      </span>
    ) : (
      <span className="flex items-center gap-2">
        {online ? (
          <>
            <Cloud className="size-4 text-brand-500" />
            <span>{online ? "Online" : "Offline"}</span>
          </>
        ) : (
          <>
            <CloudOff className="size-4 text-red-500" />
            <span>Offline</span>
          </>
        )}
        {syncing && <RefreshCw className="size-4 animate-spin text-brand-400" />}
        {pending > 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
            {pending} belum sinkron
          </span>
        )}
      </span>
    );

  return (
    <Tooltip text={pending > 0 || !online ? "Klik untuk mencoba sinkronisasi" : "Status koneksi"}>
      <button
        type="button"
        onClick={onClick}
        disabled={!clickable}
        className="rounded-xl bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-white/20 disabled:cursor-default"
      >
        {content}
      </button>
    </Tooltip>
  );
}
