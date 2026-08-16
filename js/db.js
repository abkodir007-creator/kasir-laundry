/* Penyimpanan data. Semua data disimpan lokal di tablet (localStorage),
   jadi aplikasi tetap jalan tanpa internet dan tanpa server. */
window.DB = (function () {
  const KEY = 'kasir-laundry-v1';

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
    },
    layanan: LAYANAN_AWAL,
    pengguna: penggunaAwal(),
    pesanan: [],
    nomorTerakhir: 0,
  };

  let state = muat();

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
  }

  function hapusLayanan(id) {
    state.layanan = state.layanan.filter((l) => l.id !== id);
    simpan();
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
  }

  /* ---------- Pesanan ---------- */
  const STATUS = ['antrian', 'proses', 'siap', 'diambil'];
  const LABEL_STATUS = { antrian: 'Diterima', proses: 'Dicuci', siap: 'Siap Diambil', diambil: 'Selesai' };

  const pesanan = () => state.pesanan;
  const cariPesanan = (id) => state.pesanan.find((p) => p.id === id);

  function kodeBaru() {
    state.nomorTerakhir += 1;
    const t = new Date();
    const ymd = `${String(t.getFullYear()).slice(2)}${String(t.getMonth() + 1).padStart(2, '0')}${String(t.getDate()).padStart(2, '0')}`;
    return `INV-${ymd}-${String(state.nomorTerakhir).padStart(3, '0')}`;
  }

  function buatPesanan(input) {
    const sekarang = new Date().toISOString();
    const maksDurasi = Math.max(1, ...input.item.map((i) => Number(i.durasi) || 1));
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
      estimasiSelesai: U.tambahHari(sekarang, maksDurasi),
      riwayat: [{ status: 'antrian', waktu: sekarang }],
    };
    state.pesanan.unshift(p);
    simpan();
    return p;
  }

  function ubahStatus(id, status) {
    const p = cariPesanan(id);
    if (!p) return;
    p.status = status;
    p.riwayat.push({ status, waktu: new Date().toISOString() });
    simpan();
  }

  function lunasi(id, jumlah, metode) {
    const p = cariPesanan(id);
    if (!p) return;
    p.dibayar = Number(jumlah);
    p.diterima = Math.max(p.diterima || 0, p.dibayar);
    p.metode = metode || p.metode;
    p.lunas = p.dibayar >= p.total;
    simpan();
  }

  function hapusPesanan(id) {
    state.pesanan = state.pesanan.filter((p) => p.id !== id);
    simpan();
  }

  /* ---------- Pelanggan (diturunkan dari riwayat pesanan) ---------- */
  function pelanggan() {
    const peta = new Map();
    for (const p of state.pesanan) {
      const kunci = (p.pelanggan.hp || p.pelanggan.nama).toLowerCase();
      const ada = peta.get(kunci) || { nama: p.pelanggan.nama, hp: p.pelanggan.hp, jumlah: 0, belanja: 0, terakhir: p.dibuat };
      ada.jumlah += 1;
      ada.belanja += p.total;
      if (new Date(p.dibuat) > new Date(ada.terakhir)) {
        ada.terakhir = p.dibuat;
        ada.nama = p.pelanggan.nama;
      }
      peta.set(kunci, ada);
    }
    return [...peta.values()].sort((a, b) => b.belanja - a.belanja);
  }

  /* ---------- Pengaturan & cadangan ---------- */
  const toko = () => state.toko;

  function simpanToko(data) {
    state.toko = { ...state.toko, ...data };
    simpan();
  }

  const ekspor = () => JSON.stringify(state, null, 2);

  function impor(teks) {
    const data = JSON.parse(teks);
    if (!data || !Array.isArray(data.layanan) || !Array.isArray(data.pesanan)) {
      throw new Error('Format file cadangan tidak dikenali');
    }
    state = { ...structuredClone(AWAL), ...data };
    simpan();
  }

  function resetSemua() {
    state = structuredClone(AWAL);
    simpan();
  }

  return {
    STATUS, LABEL_STATUS,
    layanan, layananAktif, cariLayanan, simpanLayanan, hapusLayanan,
    pengguna, cariPengguna, simpanPengguna, hapusPengguna,
    pesanan, cariPesanan, buatPesanan, ubahStatus, lunasi, hapusPesanan,
    pelanggan, toko, simpanToko, ekspor, impor, resetSemua,
  };
})();
