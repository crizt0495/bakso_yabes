/* Bakso Yabes Service Worker — offline-first PWA
 * Strategi:
 *  - Icons & static assets : cache-first
 *  - Navigasi halaman      : network-first, fallback cache, fallback /offline
 *  - Antrean transaksi     : TIDAK di sini (mekanisme retry ada di aplikasi,
 *    sv: IndexedDB + sync engine — lebih andal lintas browser)
 */
const VERSION = "baksoku-v1";
const ASSET_CACHE = `${VERSION}-assets`;
const PAGE_CACHE = `${VERSION}-pages`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(PAGE_CACHE).then((c) => c.addAll([OFFLINE_URL])).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // API/supabase: jangan cache (data harus segar; offline flow pakai IndexedDB)
  if (url.pathname.startsWith("/api/") || url.hostname.includes("supabase")) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(PAGE_CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(async () => {
          const cache = await caches.open(PAGE_CACHE);
          const cached = await cache.match(req, { ignoreSearch: true });
          if (cached) return cached;
          return (await cache.match(OFFLINE_URL)) || Response.error();
        }),
    );
    return;
  }

  // static assets (hashed) → cache-first
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/sw.js" ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
  }
});
