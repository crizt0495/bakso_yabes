"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { db } from "./db";
import { onSyncStateChange, retryFailed, setupAutoSync, syncNow } from "./sync-engine";

const QueuedPending = () => db.sale_queue.filter((r) => r.status !== "synced").count();
const QueuedSyncing = () => db.sale_queue.filter((r) => r.status === "syncing").count();

/**
 * Hook status koneksi & sinkronisasi — dipakai header/badge/tombol sinkron.
 * - `online` dari navigator.onLine + event
 * - `pending` dihitung live dari IndexedDB (dexie-react-hooks)
 * - `SyncBoot` harus dipasang sekali di layout untuk auto-retry.
 */
export function useSyncStatus() {
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [, force] = useState(0);

  const pendingCount = useLiveQuery(QueuedPending);
  const syncingNow = useLiveQuery(QueuedSyncing);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    const off = onSyncStateChange((s) => {
      setSyncing(s.syncing);
      force((v) => v + 1);
    });
    return () => {
      off();
    };
  }, []);

  return {
    online,
    syncing: syncing || (syncingNow ?? 0) > 0,
    pending: pendingCount ?? 0,    syncNow: () => syncNow("ui"),
    retryFailed,
  };
}

/** Registrasi auto-sync (dipanggil di layout dashboard, sekali). */
export function SyncBoot() {
  useEffect(() => {
    setupAutoSync({});
  }, []);
  return null;
}
