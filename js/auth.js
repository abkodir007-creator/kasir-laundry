/* Login owner & pegawai.

   PENTING — batas kemampuan versi ini:
   Selama data masih disimpan di dalam tablet (belum ada server), login ini
   adalah PAGAR OPERASIONAL, bukan keamanan sungguhan. PIN disimpan dalam
   bentuk hash bergaram sehingga tidak terbaca sekilas, tetapi orang yang
   paham peralatan developer browser tetap bisa menembusnya. Tujuannya:
   mencegah salah pencet dan rasa penasaran, bukan melawan peretas.
   Keamanan sungguhan menyusul saat data pindah ke server. */
window.Auth = (function () {
  const KUNCI_SESI = 'kasir-laundry-sesi';

  /* ---------- SHA-256 (implementasi ringkas, tanpa pustaka luar) ----------
     crypto.subtle tidak tersedia saat berkas dibuka lewat file://,
     jadi hash dihitung sendiri agar versi satu berkas tetap berfungsi. */
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  const putar = (x, n) => (x >>> n) | (x << (32 - n));

  function sha256(teks) {
    const data = new TextEncoder().encode(teks);
    const panjangBit = data.length * 8;

    // Padding: 1 bit, lalu nol, lalu panjang pesan 64-bit.
    const totalBlok = Math.floor((data.length + 8) / 64) + 1;
    const buf = new Uint8Array(totalBlok * 64);
    buf.set(data);
    buf[data.length] = 0x80;
    const dv = new DataView(buf.buffer);
    dv.setUint32(buf.length - 4, panjangBit >>> 0, false);
    dv.setUint32(buf.length - 8, Math.floor(panjangBit / 0x100000000), false);

    const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const w = new Uint32Array(64);

    for (let blok = 0; blok < totalBlok; blok++) {
      const awal = blok * 64;
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(awal + i * 4, false);
      for (let i = 16; i < 64; i++) {
        const a = w[i - 15];
        const b = w[i - 2];
        const s0 = putar(a, 7) ^ putar(a, 18) ^ (a >>> 3);
        const s1 = putar(b, 17) ^ putar(b, 19) ^ (b >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }

      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const S1 = putar(e, 6) ^ putar(e, 11) ^ putar(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
        const S0 = putar(a, 2) ^ putar(a, 13) ^ putar(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e;
        e = (d + t1) >>> 0;
        d = c; c = b; b = a;
        a = (t1 + t2) >>> 0;
      }

      const tambah = [a, b, c, d, e, f, g, h];
      for (let i = 0; i < 8; i++) H[i] = (H[i] + tambah[i]) >>> 0;
    }

    return H.map((x) => x.toString(16).padStart(8, '0')).join('');
  }

  const garamBaru = () =>
    [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, '0')).join('');

  const hashPin = (pin, garam) => sha256(`${garam}:${String(pin)}`);

  /* ---------- Hak akses ---------- */
  // Pegawai melayani pelanggan; urusan uang dan harga milik owner.
  const AKSES_PEGAWAI = ['beranda', 'kasir', 'pesanan', 'pelanggan'];

  function boleh(menu) {
    const u = aktif();
    if (!u) return false;
    if (u.peran === 'owner') return true;
    return AKSES_PEGAWAI.includes(menu);
  }

  const isOwner = () => aktif()?.peran === 'owner';

  /* ---------- Sesi ---------- */
  // sessionStorage: sesi berakhir saat aplikasi ditutup, tetapi bertahan
  // saat halaman dimuat ulang. Tidak ada penguncian otomatis.
  function aktif() {
    try {
      const id = sessionStorage.getItem(KUNCI_SESI);
      if (!id) return null;
      const u = DB.cariPengguna(id);
      return u && u.aktif !== false ? u : null;
    } catch (e) {
      return null;
    }
  }

  function masuk(id, pin) {
    const u = DB.cariPengguna(id);
    if (!u || u.aktif === false) return false;
    if (hashPin(pin, u.garam) !== u.hash) return false;
    sessionStorage.setItem(KUNCI_SESI, u.id);
    return true;
  }

  function kunci() {
    sessionStorage.removeItem(KUNCI_SESI);
  }

  /* ---------- Layar masuk ---------- */
  function layarMasuk(el, onMasuk) {
    const daftar = DB.pengguna().filter((u) => u.aktif !== false);
    let dipilih = daftar[0]?.id || null;
    let pin = '';

    el.innerHTML = `
      <div class="masuk">
        <div class="masuk-kartu card">
          <div class="masuk-merek">
            ${
              DB.toko().logo || Merek.LOGO
                ? `<img class="masuk-logo" src="${DB.toko().logo || Merek.LOGO}" alt="${U.esc(DB.toko().nama)}">`
                : `<span style="font-size:34px">🧺</span><h1 class="page-title">${U.esc(DB.toko().nama)}</h1>`
            }
            <p class="page-sub">Pilih nama Anda, lalu masukkan PIN.</p>
          </div>

          <div class="masuk-orang" id="masukOrang">
            ${daftar
              .map(
                (u) => `
              <button type="button" class="orang ${u.id === dipilih ? 'is-active' : ''}" data-user="${u.id}">
                <span class="orang-nama">${U.esc(u.nama)}</span>
                <span class="pill ${u.peran === 'owner' ? 'pill-info' : 'pill-muted'}">${u.peran === 'owner' ? 'Owner' : 'Pegawai'}</span>
              </button>`
              )
              .join('')}
          </div>

          <div class="pin-titik" id="pinTitik"></div>
          <p class="masuk-pesan muted" id="masukPesan">&nbsp;</p>

          <div class="tombol-angka" id="tombolAngka">
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button" data-angka="${n}">${n}</button>`).join('')}
            <button type="button" data-aksi="hapus">⌫</button>
            <button type="button" data-angka="0">0</button>
            <button type="button" data-aksi="masuk" class="btn-primary">Masuk</button>
          </div>
        </div>
      </div>`;

    const titik = el.querySelector('#pinTitik');
    const pesan = el.querySelector('#masukPesan');

    function gambarTitik() {
      titik.innerHTML = Array.from({ length: 6 }, (_, i) => `<span class="${i < pin.length ? 'isi' : ''}"></span>`).join('');
    }

    function coba() {
      if (!dipilih) return;
      if (pin.length < 4) {
        pesan.textContent = 'PIN minimal 4 angka.';
        return;
      }
      if (masuk(dipilih, pin)) {
        onMasuk();
      } else {
        pin = '';
        gambarTitik();
        pesan.textContent = 'PIN salah. Coba lagi.';
      }
    }

    el.querySelector('#masukOrang').addEventListener('click', (e) => {
      const b = e.target.closest('[data-user]');
      if (!b) return;
      dipilih = b.dataset.user;
      pin = '';
      gambarTitik();
      pesan.innerHTML = '&nbsp;';
      el.querySelectorAll('#masukOrang .orang').forEach((x) => x.classList.remove('is-active'));
      b.classList.add('is-active');
    });

    el.querySelector('#tombolAngka').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.angka !== undefined) {
        if (pin.length < 6) pin += b.dataset.angka;
        gambarTitik();
        pesan.innerHTML = '&nbsp;';
      } else if (b.dataset.aksi === 'hapus') {
        pin = pin.slice(0, -1);
        gambarTitik();
      } else if (b.dataset.aksi === 'masuk') {
        coba();
      }
    });

    // Papan ketik fisik tetap bisa dipakai kalau tablet punya keyboard.
    el.addEventListener('keydown', (e) => {
      if (e.key >= '0' && e.key <= '9' && pin.length < 6) {
        pin += e.key;
        gambarTitik();
      } else if (e.key === 'Backspace') {
        pin = pin.slice(0, -1);
        gambarTitik();
      } else if (e.key === 'Enter') {
        coba();
      }
    });

    gambarTitik();
  }

  return { sha256, garamBaru, hashPin, boleh, isOwner, aktif, masuk, kunci, layarMasuk, AKSES_PEGAWAI };
})();
