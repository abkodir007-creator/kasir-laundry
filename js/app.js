/* Router sederhana berbasis hash + inisialisasi aplikasi. */
(function () {
  const view = document.getElementById('view');
  const navList = document.getElementById('navList');
  const app = document.querySelector('.app');

  const halaman = {
    beranda: Views.beranda,
    kasir: Views.kasir,
    pesanan: Views.pesanan,
    pelanggan: Views.pelanggan,
    laporan: Views.laporan,
    pengeluaran: Views.pengeluaran,
    layanan: Views.layanan,
    penggunaAkun: Views.penggunaAkun,
    pengaturan: Views.pengaturan,
  };

  function buka(nama) {
    // Menu yang tidak boleh diakses peran ini dialihkan ke Beranda.
    const diminta = halaman[nama] ? nama : 'beranda';
    const aktif = Auth.boleh(diminta) ? diminta : 'beranda';
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

  /** Logo di menu samping. Logo unggahan owner menang atas logo bawaan. */
  function segarkanMerek() {
    const t = DB.toko();
    const logo = t.logo || Merek.LOGO_TERANG;
    document.getElementById('brand').innerHTML = logo
      ? `<img class="brand-logo" src="${logo}" alt="${U.esc(t.nama)}">`
      : `<span class="brand-mark">🧺</span><span class="brand-text">${U.esc(t.nama)}</span>`;
  }

  /** Layar penuh: dipakai untuk login akun toko maupun layar PIN. */
  function layarPenuh() {
    app.hidden = true;
    let layar = document.getElementById('layarMasuk');
    if (!layar) {
      layar = document.createElement('div');
      layar.id = 'layarMasuk';
      layar.tabIndex = -1;
      document.body.appendChild(layar);
    }
    layar.hidden = false;
    return layar;
  }

  /** Layar PIN menggantikan seluruh aplikasi sampai berhasil masuk. */
  function mintaMasuk() {
    const layar = layarPenuh();
    Auth.layarMasuk(layar, mulai);
    layar.focus();
  }

  /** Minta akun toko. Hanya muncul kalau tablet belum pernah masuk. */
  function mintaAkunToko() {
    const layar = layarPenuh();
    Auth.layarToko(layar, () => {
      /* Perpindahan berikutnya diurus pantauAkun. */
    });
    layar.focus();
  }

  function mulai() {
    const layar = document.getElementById('layarMasuk');
    if (layar) layar.hidden = true;
    app.hidden = false;
    segarkanMerek();
    segarkanMenu();
    buka(location.hash.slice(1) || 'beranda');
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
    /* Kalau akun toko belum aktif, layar yang benar adalah login toko — bukan
       layar PIN. Tanpa penjagaan ini, tombol Kunci menjadi jalan pintas ke
       layar PIN bagi siapa pun yang memegang tablet. */
    if (adaAwan && !Awan.akun()) {
      mintaAkunToko();
      return;
    }
    mintaMasuk();
  });

  /* Status sinkronisasi. Yang penting bagi kasir cuma satu: apakah ada
     transaksi yang belum sampai ke server. */
  const status = document.getElementById('netStatus');
  let tertunda = 0;
  let galatServer = null;

  /* Bilah peringatan yang menutup bagian atas layar.

     Status sambungan selama ini duduk di kaki menu samping — dan di layar
     HP menu samping berubah jadi baris menu di bawah, dengan .nav-foot
     disembunyikan sama sekali. Artinya justru di perangkat yang dipakai
     melayani, status sambungan TIDAK PERNAH terlihat. Server bisa menolak
     seluruh tulisan seharian tanpa satu pun tanda di layar kasir.

     Bilah ini hanya muncul kalau server benar-benar menolak. Offline biasa
     tidak memunculkannya, karena offline memang keadaan yang normal di
     sini dan datanya toh tetap tersimpan. */
  const bilah = document.createElement('button');
  bilah.id = 'bilahGalat';
  bilah.type = 'button';
  bilah.hidden = true;
  bilah.addEventListener('click', () => buka('pengaturan'));
  document.body.appendChild(bilah);

  /* Tinggi bilah diukur, bukan ditebak. Kalimatnya membungkus jadi dua baris
     di layar HP dan tiga baris di layar sempit, jadi angka tetap apa pun akan
     salah di salah satu ukuran — dan yang tertutup adalah judul halaman. */
  function ukurBilah() {
    document.documentElement.style.setProperty(
      '--tinggi-bilah',
      (bilah.hidden ? 0 : bilah.offsetHeight) + 'px'
    );
  }

  function perbaruiBilah(bermasalah) {
    if (bermasalah) {
      bilah.innerHTML =
        '<b>⚠️ Server menolak menyimpan.</b> Nota tetap aman di perangkat ini, ' +
        'tapi belum sampai ke perangkat lain. Ketuk untuk memeriksa.';
    }
    bilah.hidden = !bermasalah;
    document.body.classList.toggle('ada-galat', !!bermasalah);
    ukurBilah();
  }

  window.addEventListener('resize', ukurBilah);

  function perbaruiStatus() {
    const online = navigator.onLine;
    perbaruiBilah(DB.pakaiAwanAktif() && galatServer);
    if (DB.pakaiAwanAktif() && galatServer) {
      // Kegagalan server tidak boleh diam-diam. Kalau aturan Firestore
      // menolak akun ini, datanya tetap tampil dari simpanan tablet dan
      // semuanya terlihat normal — padahal tidak ada yang terkirim.
      status.textContent = 'Server menolak';
      status.className = 'pill pill-danger';
      return;
    }
    if (!DB.pakaiAwanAktif()) {
      /* Sengaja tidak pernah hijau. Sebelumnya di sini tertulis "Tersambung"
         yang cuma berarti ada internet, sehingga perangkat yang belum masuk
         akun toko tampak sehat padahal datanya tidak pernah sampai ke
         server. */
      status.textContent = online ? 'Tanpa server' : 'Mode offline';
      status.className = 'pill pill-warn';
      return;
    }
    if (tertunda > 0) {
      status.textContent = `${tertunda} menunggu kirim`;
      status.className = 'pill pill-warn';
    } else if (!Awan.sudahSiap()) {
      status.textContent = 'Menyambungkan…';
      status.className = 'pill pill-muted';
    } else if (!online) {
      status.textContent = 'Offline, tersimpan';
      status.className = 'pill pill-warn';
    } else {
      status.textContent = 'Tersinkron';
      status.className = 'pill pill-ok';
    }
  }
  window.addEventListener('online', perbaruiStatus);
  window.addEventListener('offline', perbaruiStatus);

  /* Service worker: agar aplikasi bisa dibuka tanpa internet setelah kunjungan pertama.

     updateViaCache 'none' penting: tanpa itu berkas sw.js sendiri bisa diambil
     dari simpanan browser, sehingga tablet bertahan di versi lama walau situs
     sudah diperbarui. Begitu pekerja baru mengambil alih, halaman dimuat ulang
     sekali supaya tablet langsung memakai versi terbaru. */
  if (!window.BERKAS_TUNGGAL && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
    let pendaftaran = null;
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('sw.js', { updateViaCache: 'none' })
        .then((reg) => {
          pendaftaran = reg;
          return reg.update().catch(() => {});
        })
        .catch((e) => console.warn('Service worker gagal:', e));
    });

    /* Periksa pembaruan lagi tiap kali aplikasi kembali ke depan layar.

       Sebelumnya pemeriksaan hanya terjadi pada peristiwa 'load'. Aplikasi
       yang sudah dipasang di layar utama HP jarang benar-benar dimuat ulang:
       menekan ikonnya biasanya cuma memanggil kembali proses yang masih
       hidup di latar, jadi 'load' tidak pernah terjadi lagi dan HP bisa
       bertahan di versi lama berhari-hari padahal situsnya sudah diperbarui.
       Di komputer hal ini tidak terlihat karena tabnya memang dibuka ulang.

       Dijeda setengah jam supaya membuka-tutup aplikasi sepanjang hari tidak
       berubah jadi rentetan permintaan. Sekali periksa hanya menanyakan satu
       berkas kecil, dan kalau tidak berubah server menjawab "belum berubah". */
    let periksaTerakhir = Date.now();
    const JEDA_PERIKSA = 30 * 60 * 1000;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden || !pendaftaran) return;
      if (Date.now() - periksaTerakhir < JEDA_PERIKSA) return;
      periksaTerakhir = Date.now();
      pendaftaran.update().catch(() => {});
    });
    // Pemasangan pertama kali tidak perlu dimuat ulang: yang tampil sudah baru.
    const adaPekerjaLama = !!navigator.serviceWorker.controller;
    let sudahMuatUlang = false;

    /* Memuat ulang di tengah pelayanan berarti keranjang yang sudah diisi
       kasir hilang begitu saja, di depan pelanggan. Versi barunya toh sudah
       aktif — berkasnya terpakai sendiri saat aplikasi dibuka berikutnya. */
    const sedangMelayani = () =>
      !!document.querySelector('.cart-item') || !!document.querySelector('#modalSukses[open]');

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!adaPekerjaLama || sudahMuatUlang) return;
      sudahMuatUlang = true;
      if (sedangMelayani()) return U.toast('Versi baru siap, dipakai saat aplikasi dibuka lagi');
      location.reload();
    });
  }

  /* Gambar ulang halaman saat data dari server berubah. Halaman Kasir
     sengaja dilewati supaya isian yang sedang diketik tidak hilang. */
  let jadwal = null;
  function segarkanIsi() {
    clearTimeout(jadwal);
    jadwal = setTimeout(() => {
      if (app.hidden || !Auth.aktif()) return;
      const kini = navList.querySelector('.nav-item.is-active')?.dataset.view;
      if (kini && kini !== 'kasir') buka(kini);
      else segarkanMerek();
    }, 250);
  }

  perbaruiStatus();

  /* Mode lokal darurat: buka alamat dengan ?lokal=1 untuk melewati server
     sepenuhnya dan bekerja dari data di tablet saja. Berguna kalau layanan
     Firebase sedang bermasalah dan toko tetap harus melayani. */
  const modeLokal = new URLSearchParams(location.search).has('lokal');
  const adaAwan = typeof Awan !== 'undefined' && Awan.tersedia() && !modeLokal;
  if (adaAwan) {
    Awan.mulai();
    Awan.pantauAkun((pengguna) => {
      if (!pengguna) {
        DB.pakaiAwan(false);
        Awan.hentikan();
        Auth.kunci();
        galatServer = null;
        tertunda = 0;
        perbaruiStatus();
        mintaAkunToko();
        return;
      }
      DB.pakaiAwan(true);
      galatServer = null;
      /* Wajib digambar ulang di sini. Sebelumnya status hanya ikut berubah
         saat jumlah kiriman tertunda berubah — dan kalau tidak ada yang
         tertunda, angkanya tetap nol, jadi tulisannya tidak pernah diperbarui.
         Akibatnya tablet yang sudah tersambung tetap menampilkan "Tanpa
         server" seolah datanya tidak ke mana-mana. */
      perbaruiStatus();

      /* Cari tahu dulu apakah server sudah pernah diisi. Selama belum, data
         kosong dari server tidak boleh menimpa isi tablet — lihat catatan di
         js/db.js. Kalau pemeriksaan gagal, jawabannya tetap "belum", karena
         arah itu yang aman. */
      Awan.serverBerisi()
        .then((berisi) => {
          DB.tandaiServerSiap(berisi);
          if (!berisi) {
            U.toast('Server masih kosong — buka Pengaturan lalu tekan "Pindahkan data ke server"');
          } else {
            /* Nota yang dibuat selagi perangkat belum masuk akun toko belum
               pernah sampai ke server. Disusulkan sekali di sini, supaya
               tidak bertahan di satu perangkat saja tanpa ada yang tahu. */
            const tertinggal = DB.kirimYangTertinggal();
            if (tertinggal) U.toast(`${tertinggal} catatan tertinggal dikirim ke server`);
          }
          segarkanIsi();
        })
        .catch(() => DB.tandaiServerSiap(false));

      Awan.sinkronkan(
        (nama, isi, meta) => {
          DB.terapkanDariAwan(nama, isi, meta);
          segarkanIsi();
        },
        () => {
          segarkanIsi();
          perbaruiStatus();
        },
        (s) => {
          tertunda = s.tertunda;
          galatServer = s.galat || null;
          perbaruiStatus();
        }
      );
      if (Auth.aktif()) mulai();
      else mintaMasuk();
    });
  } else if (Auth.aktif()) {
    mulai();
  } else {
    mintaMasuk();
  }

  // Dipakai halaman Pengguna dan Pengaturan saat data yang ditampilkan berubah.
  window.SegarkanMenu = segarkanMenu;
  window.SegarkanMerek = segarkanMerek;
  window.MintaMasuk = mintaMasuk;
})();
