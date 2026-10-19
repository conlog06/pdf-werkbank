/* PDF Werkbank – Service Worker
 * Hält App und Bibliotheken im Cache, damit der Editor auch offline startet.
 * Eigene Dateien: erst Netz, dann Cache (Updates kommen sofort an).
 * Bibliotheken und Schriften vom CDN: erst Cache, dann Netz (sie ändern sich nie).
 */
const VERSION = 'pdf-werkbank-v12';
const APP = ['./', 'index.html', 'library.html', 'js/app.js', 'js/content-engine.js', 'js/calc.js', 'js/library.js', 'js/store.js', 'js/sync.js', 'js/gdrive.js', 'js/decrypt.js', 'js/update.js', 'js/palette.js', 'js/search.js', 'js/config.js', 'js/vendor/supabase.js', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'];
const CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js',
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(APP);
    await Promise.all(CDN.map(u => c.add(new Request(u, { mode: 'cors' })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  // Android „Teilen → PDF Werkbank“: Dateien zwischenlagern, Bibliothek importiert sie
  if (req.method === 'POST' && new URL(req.url).pathname.endsWith('/share-target')) {
    e.respondWith((async () => {
      try {
        const fd = await req.formData(), c = await caches.open('pdfwb-share');
        let n = 0;
        for (const f of fd.getAll('pdf')) if (f && f.size) await c.put(new Request(new URL('shared/' + Date.now() + '-' + (n++) + '?name=' + encodeURIComponent(f.name || 'Geteilt.pdf'), self.registration.scope)), new Response(f));
      } catch (err) { /* egal */ }
      return Response.redirect(new URL('library.html?shared=1', self.registration.scope).href, 303);
    })());
    return;
  }
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const cdn = /cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com/.test(url.host);
  if (!sameOrigin && !cdn) return;
  e.respondWith((async () => {
    const c = await caches.open(VERSION);
    if (cdn) {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') c.put(req, res.clone());
      return res;
    }
    try {
      const res = await fetch(req, { cache: 'no-cache' });
      if (res.ok) c.put(req, res.clone());
      return res;
    } catch (err) {
      return (await c.match(req)) || (await c.match('index.html'));
    }
  })());
});
