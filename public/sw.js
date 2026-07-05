/*
 * Lightweight PWA service worker.
 * Scope: cache the static app shell for poor-signal areas. Mutations are NOT
 * replayed here — offline photo/note capture is queued in IndexedDB by the
 * client (see src/lib/offline-queue.ts) and flushed when connectivity returns,
 * so the queue survives page reloads without a background-sync dependency.
 */
const CACHE = "huateng-shell-v1";
const SHELL = ["/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Never cache API/auth/storage traffic — only same-origin static assets.
  const cacheable =
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/_next/static/") ||
      url.pathname === "/manifest.webmanifest" ||
      url.pathname.match(/\.(png|ico|svg|woff2?)$/));
  if (!cacheable) return;

  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
    )
  );
});
