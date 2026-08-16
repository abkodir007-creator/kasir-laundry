/* Service worker: cache-first agar aplikasi tetap terbuka tanpa internet.
   Naikkan VERSI setiap kali ada perubahan file agar tablet mengambil versi baru. */
const VERSI = 'kasir-laundry-v1';
const BERKAS = [
  './',
  './index.html',
  './manifest.json',
  './assets/styles.css',
  './assets/icon.svg',
  './js/utils.js',
  './js/db.js',
  './js/receipt.js',
  './js/views.js',
  './js/app.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSI).then((c) => c.addAll(BERKAS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((kunci) => Promise.all(kunci.filter((k) => k !== VERSI).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(
      (cache) =>
        cache ||
        fetch(e.request)
          .then((res) => {
            // Simpan salinan agar kunjungan berikutnya bisa offline.
            const salinan = res.clone();
            caches.open(VERSI).then((c) => c.put(e.request, salinan)).catch(() => {});
            return res;
          })
          .catch(() => caches.match('./index.html'))
    )
  );
});
