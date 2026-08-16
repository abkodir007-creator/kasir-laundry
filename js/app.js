/* Router sederhana berbasis hash + inisialisasi aplikasi. */
(function () {
  const view = document.getElementById('view');
  const navList = document.getElementById('navList');
  const app = document.querySelector('.app');

  const halaman = {
    kasir: Views.kasir,
    pesanan: Views.pesanan,
    pelanggan: Views.pelanggan,
    laporan: Views.laporan,
    layanan: Views.layanan,
    penggunaAkun: Views.penggunaAkun,
    pengaturan: Views.pengaturan,
  };

  function buka(nama) {
    // Menu yang tidak boleh diakses peran ini dialihkan ke Kasir.
    const diminta = halaman[nama] ? nama : 'kasir';
    const aktif = Auth.boleh(diminta) ? diminta : 'kasir';
    if (aktif !== diminta) U.toast('Menu itu khusus owner');

    navList.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('is-active', b.dataset.view === aktif));
    view.scrollTop = 0;
    halaman[aktif](view);
  }

  /** Sembunyikan menu yang tidak boleh dibuka oleh pengguna yang sedang masuk. */
  function segarkanMenu() {
    const u = Auth.aktif();
    navList.querySelectorAll('.nav-item[data-view]').forEach((b) => {
      b.hidden = !Auth.boleh(b.dataset.view);
    });
    document.getElementById('navUser').innerHTML = u
      ? `<div class="nav-user-nama">${U.esc(u.nama)}</div>
         <div class="nav-user-peran">${u.peran === 'owner' ? 'Owner' : 'Pegawai'}</div>`
      : '';
  }

  /** Layar PIN menggantikan seluruh aplikasi sampai berhasil masuk. */
  function mintaMasuk() {
    app.hidden = true;
    let layar = document.getElementById('layarMasuk');
    if (!layar) {
      layar = document.createElement('div');
      layar.id = 'layarMasuk';
      layar.tabIndex = -1;
      document.body.appendChild(layar);
    }
    layar.hidden = false;
    Auth.layarMasuk(layar, mulai);
    layar.focus();
  }

  function mulai() {
    const layar = document.getElementById('layarMasuk');
    if (layar) layar.hidden = true;
    app.hidden = false;
    document.getElementById('brandName').textContent = DB.toko().nama;
    segarkanMenu();
    buka(location.hash.slice(1) || 'kasir');
    Views.ingatkanPinBawaan();
  }

  navList.addEventListener('click', (e) => {
    const b = e.target.closest('.nav-item[data-view]');
    if (b) location.hash = b.dataset.view;
  });

  window.addEventListener('hashchange', () => {
    if (Auth.aktif()) buka(location.hash.slice(1));
  });

  document.getElementById('btnKunci').addEventListener('click', () => {
    Auth.kunci();
    mintaMasuk();
  });

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

  perbaruiStatus();
  if (Auth.aktif()) mulai();
  else mintaMasuk();

  // Dipakai halaman Pengguna saat akun yang sedang masuk berubah.
  window.SegarkanMenu = segarkanMenu;
  window.MintaMasuk = mintaMasuk;
})();
