/* Service worker: membuat aplikasi tetap terbuka tanpa internet.

   Strateginya sengaja dibedakan per jenis berkas:

   - Berkas aplikasi (HTML, JS, CSS) memakai JARINGAN DULU, simpanan sebagai
     cadangan. Dengan begitu tablet selalu mendapat versi terbaru begitu ada
     sinyal, dan pembaruan tidak pernah tertahan berhari-hari di simpanan.
     Versi sebelumnya memakai simpanan-dulu, dan akibatnya tablet sempat
     tertinggal di versi lama walau situsnya sudah diperbarui.

   - Sisanya (gambar dan berkas statis lain) tetap simpanan dulu karena
     jarang berubah.

   Saat offline, semuanya jatuh ke simpanan seperti biasa. */
const VERSI = 'kasir-laundry-v8';

const BERKAS = [
  './',
  './index.html',
  './manifest.json',
  './assets/styles.css',
  './assets/icon.svg',
  './vendor/firebase-app-compat.js',
  './vendor/firebase-auth-compat.js',
  './vendor/firebase-firestore-compat.js',
  './js/merek.js',
  './js/awan.js',
  './js/utils.js',
  './js/auth.js',
  './js/db.js',
  './js/receipt.js',
  './js/views.js',
  './js/app.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSI).then(async (c) => {
      // Ditambahkan satu per satu, bukan addAll: kalau ada satu berkas yang
      // gagal diambil, pemasangan tidak ikut batal dan aplikasi tidak
      // terjebak di versi lama.
      await Promise.all(
        BERKAS.map((b) => c.add(b).catch((err) => console.warn('Lewati simpanan', b, err)))
      );
      await self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((kunci) => Promise.all(kunci.filter((k) => k !== VERSI).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/** Berkas aplikasi yang harus selalu mengikuti versi terbaru. */
const berkasAplikasi = (req, url) =>
  req.mode === 'navigate' || /\.(?:html|js|css|json)$/.test(url.pathname);

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // Firestore dan lainnya lewat begitu saja.

  if (berkasAplikasi(e.request, url)) {
    e.respondWith(
      /* 'no-cache' bukan sekadar hiasan: tanpa itu permintaan ini masih boleh
         dilayani simpanan HTTP browser, jadi "jaringan dulu" tetap bisa
         mengembalikan berkas lama. Diuji langsung — dengan pengaturan bawaan
         berkas yang sudah berubah tetap terbaca versi lama. Dengan 'no-cache'
         server selalu ditanya, dan kalau berkasnya sama server cukup menjawab
         "belum berubah" sehingga tidak boros kuota. */
      fetch(e.request, { cache: 'no-cache' })
        .then((res) => {
          const salinan = res.clone();
          caches.open(VERSI).then((c) => c.put(e.request, salinan)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(e.request).then((c) => c || caches.match('./index.html')))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(
      (cache) =>
        cache ||
        fetch(e.request).then((res) => {
          const salinan = res.clone();
          caches.open(VERSI).then((c) => c.put(e.request, salinan)).catch(() => {});
          return res;
        })
    )
  );
});
