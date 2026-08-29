/* Penyimpanan data. Semua data disimpan lokal di tablet (localStorage),
   jadi aplikasi tetap jalan tanpa internet dan tanpa server. */
window.DB = (function () {
  const KEY = 'kasir-laundry-v1';

  /* Pilihan lama pengerjaan, disimpan dalam JAM.

     Dulu ini melekat pada layanan, satu layanan satu kategori. Cara itu
     memaksa pemilik mendaftarkan layanan yang sama berkali-kali — "Cuci
     Setrika Kilat", "Cuci Setrika Reguler", dan seterusnya. Sekarang
     pilihannya ada di keranjang: layanannya satu, lama pengerjaannya yang
     dipilih saat melayani.

     Tetap dalam jam, bukan hari, karena 6 jam tidak bisa diwakili satuan
     hari — dan ketepatan janji itulah gunanya daftar ini ada. */
  const KATEGORI_AWAL = [
    { id: 'k1', nama: 'Kilat',   jam: 6,   aktif: true },
    { id: 'k2', nama: 'Ekspres', jam: 24,  aktif: true },
    { id: 'k3', nama: 'Reguler', jam: 72,  aktif: true },
    { id: 'k4', nama: '7 Hari',  jam: 168, aktif: true },
    { id: 'k5', nama: '14 Hari', jam: 336, aktif: true },
  ];

  const LAYANAN_AWAL = [
    { id: 'l1', nama: 'Cuci Kering',        satuan: 'kg',  harga: 6000,  durasi: 2, aktif: true },
    { id: 'l2', nama: 'Cuci Setrika',       satuan: 'kg',  harga: 8000,  durasi: 3, aktif: true },
    { id: 'l3', nama: 'Setrika Saja',       satuan: 'kg',  harga: 5000,  durasi: 2, aktif: true },
    { id: 'l4', nama: 'Express 1 Hari',     satuan: 'kg',  harga: 12000, durasi: 1, aktif: true },
    { id: 'l5', nama: 'Bed Cover',          satuan: 'pcs', harga: 25000, durasi: 3, aktif: true },
    { id: 'l6', nama: 'Selimut',            satuan: 'pcs', harga: 20000, durasi: 3, aktif: true },
    { id: 'l7', nama: 'Jas / Blazer',       satuan: 'pcs', harga: 30000, durasi: 3, aktif: true },
    { id: 'l8', nama: 'Sepatu',             satuan: 'pcs', harga: 35000, durasi: 3, aktif: true },
    { id: 'l9', nama: 'Gorden',             satuan: 'kg',  harga: 10000, durasi: 4, aktif: true },
    { id: 'l10', nama: 'Boneka Besar',      satuan: 'pcs', harga: 28000, durasi: 3, aktif: true },
  ];

  /* Akun bawaan: satu owner dengan PIN 1234 yang wajib diganti.
     Garam diacak per pemasangan agar hash tidak seragam antar toko. */
  function penggunaAwal() {
    const garam = Auth.garamBaru();
    return [
      { id: 'u1', nama: 'Pemilik', peran: 'owner', garam, hash: Auth.hashPin('1234', garam), pinBawaan: true, aktif: true },
    ];
  }

  const AWAL = {
    toko: {
      nama: 'StarWash Laundry',
      alamat: 'Jl. Kenari Ruko No.03, Tajurhalang, Kec. Tajur Halang, Kabupaten Bogor',
      telp: '',
      logo: '',                 // data URI, diisi lewat menu Pengaturan
      catatanStruk: 'Bersih - Wangi - Cepat - Terpercaya. Terima kasih! Barang yang tidak diambil dalam 30 hari di luar tanggung jawab kami.',
      lebarStruk: '58',         // '58' atau '80', mengikuti lebar kertas printer
      cetakSaatSimpan: 'pelanggan',  // 'pelanggan' | 'toko' | 'dua'
    },
    kategori: KATEGORI_AWAL,
    layanan: LAYANAN_AWAL,
    pengguna: penggunaAwal(),
    pesanan: [],
    pengeluaran: [],
    pelanggan: [],
    nomorTerakhir: 0,
  };

  /* Saat akun toko aktif, tiap perubahan ikut dikirim ke Firestore.
     Saat tidak, aplikasi berjalan persis seperti versi lokal sebelumnya. */
  let awanAktif = false;
  const catat = (koleksi, doc) => { if (awanAktif) Awan.tulis(koleksi, doc); };
  const buang = (koleksi, id) => { if (awanAktif) Awan.hapus(koleksi, id); };

  /* Nomor nota sengaja disimpan per tablet, bukan di server.

     Kalau nomor diambil dari server, dua tablet yang sama-sama offline akan
     menghasilkan nomor kembar dan pembukuan jadi kacau. Dengan kode perangkat
     satu huruf, INV-260816-A-001 dan INV-260816-B-001 tidak mungkin bentrok
     walau dua-duanya seharian tanpa sinyal. */
  const K_PERANGKAT = 'kasir-laundry-perangkat';
  const K_NOMOR = 'kasir-laundry-nomor';

  function kodePerangkat(baru) {
    if (baru !== undefined) {
      localStorage.setItem(K_PERANGKAT, String(baru).toUpperCase().slice(0, 2) || 'A');
    }
    let k = localStorage.getItem(K_PERANGKAT);
    if (!k) {
      k = String.fromCharCode(65 + Math.floor(Math.random() * 26));
      localStorage.setItem(K_PERANGKAT, k);
    }
    return k;
  }

  let state;

  /* Tablet tidak boleh pernah terkunci tanpa satu pun akun. Kalau daftar
     pengguna kosong — misalnya karena data server sempat masuk dalam keadaan
     kosong — owner bawaan dipasang kembali supaya masih bisa dibuka. */
  function pastikanAdaOwner() {
    if (!state.pengguna || !state.pengguna.length) {
      state.pengguna = penggunaAwal();
      simpan();
    }
  }

  /* Lima pilihan baku harus selalu ada, tapi yang dibuat pemilik tidak boleh
     ikut terhapus. Maka yang dicocokkan lamanya, bukan namanya: kalau sudah
     ada pilihan 24 jam dengan nama apa pun, tidak ditambah lagi. */
  function pastikanAdaKategori() {
    if (!state.kategori) state.kategori = [];
    const adaJam = new Set(state.kategori.map((k) => Number(k.jam)));
    let berubah = false;

    for (const baku of KATEGORI_AWAL) {
      if (adaJam.has(baku.jam)) continue;
      state.kategori.push({ ...baku, id: state.kategori.length ? U.idBaru() : baku.id });
      adaJam.add(baku.jam);
      berubah = true;
    }
    if (berubah) simpan();
  }

  /* Begitu juga daftar layanan: tanpa satu pun layanan, halaman Kasir kosong
     dan tidak ada nota yang bisa dibuat. Kalau sampai habis, daftar contoh
     dipasang kembali dan pemilik diberi tahu supaya menyesuaikannya. Hanya
     dijalankan saat aplikasi dibuka, bukan saat pemilik sedang menyunting. */
  let layananDipulihkan = false;
  function pastikanAdaLayanan() {
    if (state.layanan && state.layanan.length) return;
    state.layanan = structuredClone(LAYANAN_AWAL);
    layananDipulihkan = true;
    simpan();
  }


  function muat() {
    try {
      const mentah = localStorage.getItem(KEY);
      if (!mentah) return structuredClone(AWAL);
      const data = JSON.parse(mentah);
      // Gabungkan dengan struktur awal supaya versi lama tetap terbaca.
      return { ...structuredClone(AWAL), ...data, toko: { ...AWAL.toko, ...(data.toko || {}) } };
    } catch (e) {
      console.error('Gagal membaca data lokal:', e);
      return structuredClone(AWAL);
    }
  }

  function simpan() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Gagal menyimpan data:', e);
      U.toast('Penyimpanan penuh — coba ekspor lalu hapus data lama');
    }
    cadanganOtomatis();
  }

  /* ---------- Cadangan otomatis ----------

     Jaring pengaman terakhir. Data toko pernah hilang karena satu kesalahan
     sinkronisasi menimpa seluruh isi tablet, dan waktu itu tidak ada apa pun
     yang bisa dipakai memulihkan. Sekarang salinan utuh disimpan terpisah dan
     bisa dipulihkan dari halaman Pengaturan.

     Tiga aturan menjaga salinan ini tetap berguna:

     1. Hanya disalin dari perubahan yang dibuat di tablet ini. Data yang baru
        turun dari server tidak pernah menimpa salinan — justru dari sanalah
        bencana kemarin datang.
     2. Salinan yang lebih lengkap tidak diganti oleh keadaan yang menyusut,
        kecuali salinannya sudah sangat tua. Jadi kalau data mendadak hilang,
        salinan lengkapnya tetap ada walau kasir sempat membuat nota baru.
     3. Dijeda beberapa menit supaya penyimpanan tidak bekerja tiap ketukan. */
  const K_CADANGAN = 'kasir-laundry-cadangan';
  const JEDA_CADANGAN = 2 * 60 * 1000;
  const UMUR_CADANGAN = 7 * 24 * 60 * 60 * 1000;
  let waktuCadangan = 0;
  let jumlahCadangan = 0;
  let sedangDariAwan = false;

  const jumlahCatatan = (d) =>
    (d.pesanan || []).length + (d.pelanggan || []).length + (d.pengeluaran || []).length;

  function cadanganOtomatis() {
    if (sedangDariAwan) return;
    if (Date.now() - waktuCadangan < JEDA_CADANGAN) return;

    const jumlah = jumlahCatatan(state);
    if (!jumlah) return;
    const tua = Date.now() - waktuCadangan > UMUR_CADANGAN;
    if (jumlah < jumlahCadangan && !tua) return;

    try {
      localStorage.setItem(K_CADANGAN, JSON.stringify({ waktu: new Date().toISOString(), data: state }));
      waktuCadangan = Date.now();
      jumlahCadangan = jumlah;
    } catch (e) {
      // Kuota penuh: cadangan otomatis dilewat, kasir tidak boleh terganggu.
      console.warn('Cadangan otomatis dilewat:', e);
    }
  }

  function bacaCadanganOtomatis() {
    try {
      const d = JSON.parse(localStorage.getItem(K_CADANGAN) || 'null');
      return d && d.data && Array.isArray(d.data.pesanan) ? d : null;
    } catch (e) {
      return null;
    }
  }

  /** Ringkasan untuk halaman Pengaturan; null kalau belum ada cadangan. */
  function infoCadanganOtomatis() {
    const d = bacaCadanganOtomatis();
    if (!d) return null;
    return {
      waktu: d.waktu,
      pesanan: d.data.pesanan.length,
      pelanggan: (d.data.pelanggan || []).length,
      pengeluaran: (d.data.pengeluaran || []).length,
    };
  }

  function pulihkanCadanganOtomatis() {
    const d = bacaCadanganOtomatis();
    if (!d) throw new Error('Belum ada cadangan otomatis di tablet ini');
    impor(JSON.stringify(d.data));
    return infoCadanganOtomatis();
  }

  /* ---------- Penyalaan ----------
     Dijalankan di sini, bukan di atas berkas, karena pastikanAdaOwner() bisa
     langsung menyimpan — dan penyimpanan sudah membuat cadangan otomatis,
     jadi seluruh keterangan cadangan di atas harus sudah siap lebih dulu. */
  state = muat();

  // Umur cadangan dihitung dari salinan yang tersimpan, bukan dari waktu
  // aplikasi dibuka. Kalau tidak, tiap kali tablet dinyalakan salinan lama
  // langsung tertimpa — padahal justru itu yang mungkin dibutuhkan.
  (function umurCadangan() {
    const d = bacaCadanganOtomatis();
    if (!d) return;
    waktuCadangan = new Date(d.waktu).getTime() || 0;
    jumlahCadangan = jumlahCatatan(d.data);
  })();

  pastikanAdaOwner();
  pastikanAdaKategori();
  pastikanAdaLayanan();

  // Pemasangan lama menyimpan nomor di dalam state; pindahkan sekali ke lokal.
  if (localStorage.getItem(K_NOMOR) === null) {
    localStorage.setItem(K_NOMOR, String(state.nomorTerakhir || 0));
  }

  /* ---------- Kategori layanan ---------- */
  const kategori = () => state.kategori || [];
  const kategoriAktif = () => kategori().filter((k) => k.aktif !== false);
  const cariKategori = (id) => kategori().find((k) => k.id === id);

  /** Jalan mundur untuk nota yang dibuat sebelum estimasi dipilih di
      keranjang: lama pengerjaan diambil dari durasi lama layanan. */
  function jamLayanan(l) {
    return Math.max(1, Number(l?.durasi) || 1) * 24;
  }

  function simpanKategori(data) {
    const lama = data.id ? cariKategori(data.id) : null;
    const baru = {
      ...(lama || { id: U.idBaru() }),
      nama: String(data.nama || '').trim(),
      jam: Math.max(1, Math.round(Number(data.jam) || 1)),
      aktif: data.aktif !== false,
    };
    if (!baru.nama) throw new Error('Nama kategori wajib diisi');
    if (lama) state.kategori[state.kategori.indexOf(lama)] = baru;
    else state.kategori.push(baru);
    simpan();
    catat('kategori', baru);
    return baru;
  }

  /** Daftar pilihan tidak boleh sampai kosong — kasir tetap harus punya
      sesuatu untuk dipilih saat membuat nota. */
  function hapusKategori(id) {
    if (kategoriAktif().length <= 1) {
      throw new Error('Sisakan minimal satu pilihan estimasi');
    }
    state.kategori = kategori().filter((k) => k.id !== id);
    simpan();
    buang('kategori', id);
  }

  /* ---------- Layanan ---------- */
  const layanan = () => state.layanan;
  const layananAktif = () => state.layanan.filter((l) => l.aktif !== false);
  const cariLayanan = (id) => state.layanan.find((l) => l.id === id);

  function simpanLayanan(data) {
    if (data.id) {
      const i = state.layanan.findIndex((l) => l.id === data.id);
      if (i >= 0) state.layanan[i] = { ...state.layanan[i], ...data };
    } else {
      state.layanan.push({ ...data, id: U.idBaru(), aktif: true });
    }
    simpan();
    catat('layanan', data.id ? cariLayanan(data.id) : state.layanan[state.layanan.length - 1]);
  }

  /** Masukkan banyak layanan sekaligus. Nama yang sudah ada dilewati, bukan
      ditimpa: daftar impor sering memuat ulang nama yang sama, dan harga yang
      sudah disesuaikan pemilik tidak boleh mundur diam-diam. */
  function imporLayanan(daftar) {
    const adaNama = new Set(state.layanan.map((l) => l.nama.trim().toLowerCase()));
    let masuk = 0;
    let dilewati = 0;

    for (const l of daftar || []) {
      const kunci = String(l.nama || '').trim().toLowerCase();
      if (!kunci || adaNama.has(kunci)) {
        dilewati += 1;
        continue;
      }
      adaNama.add(kunci);
      const baru = {
        id: U.idBaru(),
        nama: l.nama.trim(),
        satuan: ['pcs', 'm'].includes(l.satuan) ? l.satuan : 'kg',
        harga: Math.max(0, Math.round(Number(l.harga) || 0)),
        durasi: Math.max(1, Number(l.durasi) || 2),
        aktif: l.aktif !== false,
      };
      state.layanan.push(baru);
      catat('layanan', baru);
      masuk += 1;
    }

    if (masuk) simpan();
    return { masuk, dilewati };
  }

  function hapusLayanan(id) {
    state.layanan = state.layanan.filter((l) => l.id !== id);
    simpan();
    buang('layanan', id);
  }

  /* ---------- Pengguna (owner & pegawai) ---------- */
  const pengguna = () => state.pengguna;
  const cariPengguna = (id) => state.pengguna.find((u) => u.id === id);
  const ownerAktif = () => state.pengguna.filter((u) => u.peran === 'owner' && u.aktif !== false);

  function simpanPengguna(data) {
    const lama = data.id ? cariPengguna(data.id) : null;

    // Toko harus selalu punya minimal satu owner yang bisa masuk.
    if (lama && lama.peran === 'owner' && ownerAktif().length === 1) {
      if (data.peran === 'pegawai' || data.aktif === false) {
        throw new Error('Owner terakhir tidak bisa dinonaktifkan atau diturunkan jadi pegawai');
      }
    }

    const baru = { ...(lama || { id: U.idBaru(), aktif: true }), nama: data.nama, peran: data.peran };
    if (data.aktif !== undefined) baru.aktif = data.aktif;

    if (data.pin) {
      baru.garam = Auth.garamBaru();
      baru.hash = Auth.hashPin(data.pin, baru.garam);
      baru.pinBawaan = false;
    } else if (!lama) {
      throw new Error('PIN wajib diisi untuk pengguna baru');
    }

    if (lama) state.pengguna[state.pengguna.indexOf(lama)] = baru;
    else state.pengguna.push(baru);
    simpan();
    catat('pengguna', baru);
    return baru;
  }

  function hapusPengguna(id) {
    const u = cariPengguna(id);
    if (!u) return;
    if (u.peran === 'owner' && ownerAktif().length === 1) {
      throw new Error('Owner terakhir tidak bisa dihapus');
    }
    state.pengguna = state.pengguna.filter((x) => x.id !== id);
    simpan();
    buang('pengguna', id);
  }

  /* ---------- Pesanan ---------- */
  const STATUS = ['antrian', 'proses', 'siap', 'diambil'];
  const LABEL_STATUS = { antrian: 'Diterima', proses: 'Dicuci', siap: 'Siap Diambil', diambil: 'Selesai' };

  const pesanan = () => state.pesanan;
  const cariPesanan = (id) => state.pesanan.find((p) => p.id === id);

  function kodeBaru() {
    const urut = (Number(localStorage.getItem(K_NOMOR)) || 0) + 1;
    localStorage.setItem(K_NOMOR, String(urut));
    state.nomorTerakhir = urut;
    const t = new Date();
    const ymd = `${String(t.getFullYear()).slice(2)}${String(t.getMonth() + 1).padStart(2, '0')}${String(t.getDate()).padStart(2, '0')}`;
    return `INV-${ymd}-${kodePerangkat()}${String(urut).padStart(3, '0')}`;
  }

  function buatPesanan(input) {
    const sekarang = new Date().toISOString();
    /* Lama pengerjaan dipilih kasir di keranjang dan berlaku untuk seluruh
       nota. Nota lama serta data hasil impor belum punya angka itu, jadi
       masih ada jalan mundur ke lama per layanan. */
    const maksJam = Number(input.jam) > 0
      ? Number(input.jam)
      : Math.max(1, ...input.item.map((i) => Number(i.jam) || (Number(i.durasi) || 1) * 24));
    const p = {
      id: U.idBaru(),
      kode: kodeBaru(),
      pelanggan: { nama: input.nama.trim() || 'Tanpa Nama', hp: (input.hp || '').trim() },
      item: input.item,
      subtotal: input.subtotal,
      diskon: input.diskon || 0,
      total: input.total,
      dibayar: input.dibayar || 0,          // yang diakui masuk kas (maksimal sebesar total)
      diterima: input.diterima || 0,        // uang fisik yang diserahkan pelanggan, untuk hitung kembalian
      metode: input.metode || 'tunai',
      lunas: (input.dibayar || 0) >= input.total,
      status: 'antrian',
      kasir: input.kasir || '-',            // siapa yang menerima pesanan ini
      catatan: (input.catatan || '').trim(),
      dibuat: sekarang,
      estimasiSelesai: U.tambahJam(sekarang, maksJam),
      jamPengerjaan: maksJam,
      estimasiNama: input.estimasiNama || '',
      riwayat: [{ status: 'antrian', waktu: sekarang }],
    };
    state.pesanan.unshift(p);
    simpan();
    catat('pesanan', p);
    return p;
  }

  function ubahStatus(id, status) {
    const p = cariPesanan(id);
    if (!p) return;
    p.status = status;
    p.riwayat.push({ status, waktu: new Date().toISOString() });
    simpan();
    catat('pesanan', p);
  }

  function lunasi(id, jumlah, metode) {
    const p = cariPesanan(id);
    if (!p) return;
    p.dibayar = Number(jumlah);
    p.diterima = Math.max(p.diterima || 0, p.dibayar);
    p.metode = metode || p.metode;
    p.lunas = p.dibayar >= p.total;
    simpan();
    catat('pesanan', p);
  }

  function hapusPesanan(id) {
    state.pesanan = state.pesanan.filter((p) => p.id !== id);
    simpan();
    buang('pesanan', id);
  }

  /* ---------- Pengeluaran ---------- */
  const KATEGORI = [
    'Deterjen & Pewangi',
    'Listrik & Air',
    'Gaji & Upah',
    'Sewa Tempat',
    'Perawatan Mesin',
    'Antar-Jemput & Bensin',
    'Perlengkapan',
    'Lain-lain',
  ];

  const pengeluaran = () => state.pengeluaran;
  const cariPengeluaran = (id) => state.pengeluaran.find((x) => x.id === id);

  function simpanPengeluaran(data) {
    const lama = data.id ? cariPengeluaran(data.id) : null;
    const baru = {
      ...(lama || { id: U.idBaru(), dicatat: new Date().toISOString() }),
      tanggal: data.tanggal,                 // YYYY-MM-DD, tanggal uang keluar
      kategori: data.kategori,
      keterangan: (data.keterangan || '').trim(),
      jumlah: Math.max(0, Number(data.jumlah) || 0),
      oleh: data.oleh || lama?.oleh || '-',
    };
    if (lama) state.pengeluaran[state.pengeluaran.indexOf(lama)] = baru;
    else state.pengeluaran.unshift(baru);
    // Urut dari yang terbaru supaya daftar enak dibaca.
    state.pengeluaran.sort((a, b) => (a.tanggal < b.tanggal ? 1 : a.tanggal > b.tanggal ? -1 : 0));
    simpan();
    catat('pengeluaran', baru);
    return baru;
  }

  function hapusPengeluaran(id) {
    state.pengeluaran = state.pengeluaran.filter((x) => x.id !== id);
    simpan();
    buang('pengeluaran', id);
  }

  /* ---------- Pelanggan ----------
     Dua sumber digabung: buku pelanggan yang disimpan sendiri (hasil impor
     atau input manual) dan pelanggan yang muncul dari riwayat pesanan.
     Kuncinya nomor HP yang sudah dinormalkan; kalau tidak ada HP, pakai nama. */
  const kunciPelanggan = (nama, hp) => U.waNomor(hp) || `nama:${String(nama || '').trim().toLowerCase()}`;

  const bukuPelanggan = () => state.pelanggan;

  function pelanggan() {
    const peta = new Map();

    for (const c of state.pelanggan) {
      peta.set(kunciPelanggan(c.nama, c.hp), {
        id: c.id, nama: c.nama, hp: c.hp, catatan: c.catatan || '',
        jumlah: 0, belanja: 0, terakhir: null, tersimpan: true,
      });
    }

    for (const p of state.pesanan) {
      const k = kunciPelanggan(p.pelanggan.nama, p.pelanggan.hp);
      const ada = peta.get(k) || {
        nama: p.pelanggan.nama, hp: p.pelanggan.hp, catatan: '',
        jumlah: 0, belanja: 0, terakhir: p.dibuat, tersimpan: false,
      };
      ada.jumlah += 1;
      ada.belanja += p.total;
      if (!ada.terakhir || new Date(p.dibuat) > new Date(ada.terakhir)) {
        ada.terakhir = p.dibuat;
        // Nama pada nota terbaru dianggap paling mutakhir, kecuali sudah ada di buku.
        if (!ada.tersimpan) ada.nama = p.pelanggan.nama;
        if (!ada.hp) ada.hp = p.pelanggan.hp;
      }
      peta.set(k, ada);
    }

    return [...peta.values()].sort((a, b) => b.belanja - a.belanja || a.nama.localeCompare(b.nama));
  }

  function simpanPelanggan(data) {
    const lama = data.id ? state.pelanggan.find((c) => c.id === data.id) : null;
    const baru = {
      ...(lama || { id: U.idBaru(), dibuat: new Date().toISOString() }),
      nama: (data.nama || '').trim(),
      hp: (data.hp || '').trim(),
      catatan: (data.catatan || '').trim(),
    };
    if (lama) state.pelanggan[state.pelanggan.indexOf(lama)] = baru;
    else state.pelanggan.push(baru);
    simpan();
    catat('pelanggan', baru);
    return baru;
  }

  function hapusPelanggan(id) {
    state.pelanggan = state.pelanggan.filter((c) => c.id !== id);
    simpan();
    buang('pelanggan', id);
  }

  /** Masukkan hasil uraian daftar kontak. Nomor yang sudah ada dilewati. */
  function imporPelanggan(daftar) {
    const punya = new Set(state.pelanggan.map((c) => kunciPelanggan(c.nama, c.hp)));
    for (const p of state.pesanan) punya.add(kunciPelanggan(p.pelanggan.nama, p.pelanggan.hp));

    let masuk = 0;
    let dilewati = 0;
    for (const c of daftar) {
      const k = kunciPelanggan(c.nama, c.hp);
      if (punya.has(k)) {
        dilewati += 1;
        continue;
      }
      punya.add(k);
      const rekaman = {
        id: U.idBaru(),
        nama: c.nama,
        hp: c.hp,
        catatan: c.catatan || '',
        dibuat: new Date().toISOString(),
      };
      state.pelanggan.push(rekaman);
      catat('pelanggan', rekaman);
      masuk += 1;
    }
    simpan();
    return { masuk, dilewati };
  }

  /* ---------- Pengaturan & cadangan ---------- */
  const toko = () => state.toko;

  function simpanToko(data) {
    state.toko = { ...state.toko, ...data };
    simpan();
    if (awanAktif) Awan.tulisToko(state.toko);
  }

  const ekspor = () => JSON.stringify(state, null, 2);

  function impor(teks) {
    const data = JSON.parse(teks);
    if (!data || !Array.isArray(data.layanan) || !Array.isArray(data.pesanan)) {
      throw new Error('Format file cadangan tidak dikenali');
    }
    // Cadangan dari versi sebelum fitur pengeluaran tetap bisa dipulihkan.
    if (!Array.isArray(data.pengeluaran)) data.pengeluaran = [];
    if (!Array.isArray(data.pelanggan)) data.pelanggan = [];
    state = { ...structuredClone(AWAL), ...data };
    simpan();
  }

  function resetSemua() {
    state = structuredClone(AWAL);
    simpan();
  }

  /** Dipanggil app.js begitu akun toko aktif atau keluar. */
  function pakaiAwan(nyala) {
    awanAktif = !!nyala;
    if (!awanAktif) serverSiap = false;
  }

  /* Apakah server sudah pernah diisi? Selama jawabannya belum, data dari
     server TIDAK BOLEH mengosongkan data tablet.

     Ini pelajaran mahal: pada versi pertama, tablet yang masuk ke akun toko
     dengan server yang masih kosong langsung menerima "daftar kosong" untuk
     semua koleksi, lalu menyimpannya menimpa data lokal. Akibatnya layanan,
     pesanan, dan bahkan daftar pengguna ikut hilang sehingga aplikasi tidak
     bisa dibuka. Sekarang arah pengosongan dikunci sampai pemilik menekan
     "Pindahkan data ke server". */
  let serverSiap = false;
  const tandaiServerSiap = (v) => { serverSiap = !!v; };

  const kosong = (isi) => !isi || (Array.isArray(isi) ? !isi.length : !Object.keys(isi).length);

  /** Data dari server masuk ke memori. Bentuknya sama dengan state lokal,
      jadi seluruh halaman tetap membaca seperti biasa. */
  function terapkanDariAwan(nama, isi, meta) {
    // Salin dulu keadaan sekarang: inilah titik paling berisiko data tertimpa.
    cadanganOtomatis();

    /* Daftar kosong dari server TIDAK PERNAH menimpa daftar yang berisi di
       tablet — walau server sudah ditandai siap.

       Aturan ini sengaja dibuat tanpa pengecualian setelah kejadian nyata:
       satu tablet yang datanya sudah telanjur hilang menekan "Pindahkan data
       ke server", sehingga keadaan kosong itu menjadi versi resmi di server
       dan ikut mengosongkan perangkat lain. Selama masih ada satu tablet yang
       menyimpan datanya, data itu harus menang.

       Penghapusan satu-dua catatan tetap ikut tersinkron seperti biasa, karena
       daftar yang dikirim server masih berisi.

       Ada satu pengecualian yang sah: pemilik memang sengaja menghapus semua
       catatan dari perangkat lain. Itu baru diterima kalau dua syarat terpenuhi
       sekaligus — server sudah terbukti pernah berisi, dan kabar kosong ini
       benar-benar datang dari server, bukan dari simpanan sementara. Dua-duanya
       tidak akan pernah terpenuhi pada keadaan yang dulu menghapus data toko. */
    const lokalBerisi = nama === 'toko' ? true : !!(state[nama] || []).length;
    const penghapusanSah = serverSiap && meta && meta.dariServer;
    if (kosong(isi) && lokalBerisi && !penghapusanSah) return;

    if (nama === 'toko') state.toko = { ...AWAL.toko, ...isi };
    else state[nama] = isi;

    if (nama === 'pesanan') state.pesanan.sort((a, b) => (a.dibuat < b.dibuat ? 1 : -1));
    if (nama === 'pengeluaran') {
      state.pengeluaran.sort((a, b) => (a.tanggal < b.tanggal ? 1 : a.tanggal > b.tanggal ? -1 : 0));
    }
    pastikanAdaOwner();

    // Penyimpanan ini berasal dari server, jadi tidak boleh jadi cadangan.
    sedangDariAwan = true;
    try {
      simpan();
    } finally {
      sedangDariAwan = false;
    }
  }

  const seluruhState = () => state;

  return {
    STATUS, LABEL_STATUS, KATEGORI,
    pakaiAwan, terapkanDariAwan, seluruhState, kodePerangkat,
    pakaiAwanAktif: () => awanAktif,
    tandaiServerSiap, serverSudahSiap: () => serverSiap,
    layananDipulihkan: () => layananDipulihkan,
    pengeluaran, cariPengeluaran, simpanPengeluaran, hapusPengeluaran,
    layanan, layananAktif, cariLayanan, simpanLayanan, hapusLayanan, imporLayanan,
    kategori, kategoriAktif, cariKategori, simpanKategori, hapusKategori, jamLayanan,
    pengguna, cariPengguna, simpanPengguna, hapusPengguna,
    pesanan, cariPesanan, buatPesanan, ubahStatus, lunasi, hapusPesanan,
    pelanggan, bukuPelanggan, simpanPelanggan, hapusPelanggan, imporPelanggan, toko, simpanToko, ekspor, impor, resetSemua,
    infoCadanganOtomatis, pulihkanCadanganOtomatis,
  };
})();
