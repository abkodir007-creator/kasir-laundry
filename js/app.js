/* Router sederhana berbasis hash + inisialisasi aplikasi. */
(function () {
  const view = document.getElementById('view');
  const navList = document.getElementById('navList');

  const halaman = {
    kasir: Views.kasir,
    pesanan: Views.pesanan,
    pelanggan: Views.pelanggan,
    laporan: Views.laporan,
    layanan: Views.layanan,
    pengaturan: Views.pengaturan,
  };

  function buka(nama) {
    const render = halaman[nama] || halaman.kasir;
    const aktif = halaman[nama] ? nama : 'kasir';
    navList.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('is-active', b.dataset.view === aktif));
    view.scrollTop = 0;
    render(view);
  }

  navList.addEventListener('click', (e) => {
    const b = e.target.closest('.nav-item');
    if (b) location.hash = b.dataset.view;
  });

  window.addEventListener('hashchange', () => buka(location.hash.slice(1)));

  /* Status koneksi — aplikasi tetap berfungsi walau offline. */
  const status = document.getElementById('netStatus');
  function perbaruiStatus() {
    const online = navigator.onLine;
    status.textContent = online ? 'Tersambung' : 'Mode offline';
    status.className = 'pill ' + (online ? 'pill-ok' : 'pill-warn');
  }
  window.addEventListener('online', perbaruiStatus);
  window.addEventListener('offline', perbaruiStatus);

  /* Service worker: agar aplikasi bisa dibuka tanpa internet setelah kunjungan pertama. */
  if (!window.BERKAS_TUNGGAL && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service worker gagal:', e));
    });
  }

  document.getElementById('brandName').textContent = DB.toko().nama;
  perbaruiStatus();
  buka(location.hash.slice(1) || 'kasir');
})();
