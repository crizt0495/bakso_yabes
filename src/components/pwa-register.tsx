"use client";

import { useEffect } from "react";

/** Registrasi Service Worker (PWA) di client. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (window.location.hostname !== "localhost" && window.location.protocol !== "https:") {
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* SW tidak wajib untuk menjalankan app */
    });
  }, []);
  return null;
}
