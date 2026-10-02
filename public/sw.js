// v2: sahifalar — avval tarmoq, kesh faqat oflayn uchun; RSC so'rovlari keshlanmaydi.
// (v1 sahifa va RSC javoblarini avval keshdan berardi — yangi versiyadan keyin eski RSC yangi JS bilan
// mos kelmay, "Cannot read properties of undefined (reading 'call')" xatosi chiqardi)
const CACHE = 'hamyon-v2';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  if (
    request.method !== 'GET' ||
    url.origin !== location.origin ||
    url.pathname.startsWith('/_next/') ||
    url.pathname.includes('/auth/') ||
    url.searchParams.has('_rsc') ||
    request.headers.get('RSC') === '1'
  ) return;

  e.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || Response.error()))
  );
});
