/* Lapisan awan: Firebase Auth + Firestore.

   Peran berkas ini hanya dua: menjaga sesi akun toko, dan menjadi jembatan
   dua arah antara Firestore dan `state` di js/db.js. Seluruh tampilan tetap
   membaca data dari memori secara langsung, jadi tidak ada satu pun halaman
   yang perlu menunggu jaringan.

   Alur datanya:
     tulis  -> ubah state di memori -> simpan ke localStorage -> kirim ke Firestore
     baca   -> onSnapshot dari Firestore -> perbarui state -> halaman digambar ulang

   Saat internet putus, Firestore menyimpan tulisan di antrean lokal dan
   mengirimkannya sendiri begitu sambungan kembali. Kasir tidak perlu tahu. */
window.Awan = (function () {
  const KONFIG = {
    apiKey: 'AIzaSyBQ1FQT1z9wsQmgJ22YwnW6K_6_8xNCzao',
    authDomain: 'starwash-kasir-661ea.firebaseapp.com',
    projectId: 'starwash-kasir-661ea',
    storageBucket: 'starwash-kasir-661ea.firebasestorage.app',
    messagingSenderId: '994280446577',
    appId: '1:994280446577:web:2f05cb653c114fd04859d0',
  };

  // Satu toko satu dokumen induk. Disiapkan begini supaya kalau nanti buka
  // cabang, tinggal menambah id lain tanpa mengubah struktur.
  const TOKO = 'starwash';

  // Koleksi yang disinkronkan, dipetakan ke nama larik di dalam state.
  const KOLEKSI = ['kategori', 'layanan', 'pengguna', 'pesanan', 'pengeluaran', 'pelanggan'];

  let app = null;
  let auth = null;
  let dbAwan = null;
  let siap = false;
  let pendengar = [];
  let onUbah = () => {};
  let onStatus = () => {};
  let tertunda = 0;
  let tertundaPer = {};   // per koleksi, lihat catatan di hitungTertunda
  let galat = null;       // kegagalan MEMBACA terakhir, mis. akses ditolak
  /* Kegagalan MENULIS disimpan terpisah dari kegagalan membaca.

     Kalau digabung, kabar snapshot berikutnya langsung menghapusnya —
     tiap snapshot menyetel galat = null — sehingga penolakan tulisan cuma
     terlihat sepersekian detik lalu status kembali hijau "Tersinkron".
     Terbukti di pengujian: server menolak semua tulisan, statusnya tetap
     hijau. Yang ini hanya bersih kalau ada tulisan yang benar-benar
     berhasil. */
  let galatTulis = null;

  const tersedia = () => typeof firebase !== 'undefined' && !!firebase.initializeApp;

  function mulai() {
    if (!tersedia() || app) return !!app;
    app = firebase.initializeApp(KONFIG);
    auth = firebase.auth();
    dbAwan = firebase.firestore();

    // Simpanan lokal Firestore: inilah yang membuat aplikasi tetap jalan
    // saat sinyal hilang, sekaligus mengantre tulisan sampai online lagi.
    dbAwan.enablePersistence({ synchronizeTabs: true }).catch((e) => {
      console.warn('Simpanan offline Firestore tidak aktif:', e.code || e);
    });

    // Sesi bertahan walau aplikasi ditutup, jadi tablet cukup sekali login.
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});
    return true;
  }

  const akun = () => (auth ? auth.currentUser : null);

  function pantauAkun(cb) {
    if (!mulai()) return;
    auth.onAuthStateChanged((u) => cb(u));
  }

  async function masukToko(email, sandi) {
    mulai();
    await auth.signInWithEmailAndPassword(String(email).trim(), String(sandi));
  }

  /* Memeriksa kata sandi akun toko tanpa mengganggu sesi yang sedang jalan.

     Dipakai untuk mengatur ulang PIN yang lupa. Sengaja diperiksa ke server,
     bukan ke sesuatu yang tersimpan di tablet: kalau jawabannya ada di tablet,
     siapa pun yang memegang tablet bisa menemukannya. */
  async function periksaSandiToko(email, sandi) {
    mulai();
    if (!auth) throw new Error('Layanan akun tidak tersedia di perangkat ini');
    const bersih = String(email).trim();
    const sekarang = auth.currentUser;

    if (sekarang) {
      if (sekarang.email && sekarang.email.toLowerCase() !== bersih.toLowerCase()) {
        throw new Error('Email itu bukan akun toko yang dipakai perangkat ini');
      }
      const kredensial = firebase.auth.EmailAuthProvider.credential(bersih, String(sandi));
      await sekarang.reauthenticateWithCredential(kredensial);
      return sekarang;
    }

    const hasil = await auth.signInWithEmailAndPassword(bersih, String(sandi));
    return hasil.user;
  }

  async function keluarToko() {
    hentikan();
    if (auth) await auth.signOut();
  }

  const induk = () => dbAwan.collection('toko').doc(TOKO);

  /* ---------- Sinkronisasi ---------- */

  /** Pasang pendengar realtime. `terapkan` dipanggil tiap ada perubahan. */
  function sinkronkan(terapkan, kabari, kabariStatus) {
    onUbah = terapkan;
    kabari = kabari || (() => {});
    onStatus = kabariStatus || (() => {});
    hentikan();
    siap = false;
    galat = null;
    tertundaPer = {};
    tertunda = 0;

    let selesai = 0;
    const total = KOLEKSI.length + 1;
    const tandai = () => {
      selesai += 1;
      if (selesai >= total && !siap) {
        siap = true;
        kabari();
      }
    };

    for (const nama of KOLEKSI) {
      pendengar.push(
        induk()
          .collection(nama)
          .onSnapshot(
            { includeMetadataChanges: true },
            (snap) => {
              const isi = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
              galat = null;
              hitungTertunda(nama, snap);
              // dariServer membedakan kabar sungguhan dari isi simpanan
              // sementara; dipakai db.js sebelum menerima daftar kosong.
              onUbah(nama, isi, { dariServer: !snap.metadata.fromCache });
              tandai();
            },
            (e) => {
              console.error('Gagal memantau', nama, e);
              galat = e.code || 'gagal';
              kabarkanStatus();
              tandai();
            }
          )
      );
    }

    pendengar.push(
      induk().onSnapshot(
        { includeMetadataChanges: true },
        (doc) => {
          const d = doc.data() || {};
          if (d.toko) onUbah('toko', d.toko);
          tandai();
        },
        (e) => {
          console.error('Gagal memantau dokumen toko', e);
          galat = e.code || 'gagal';
          kabarkanStatus();
          tandai();
        }
      )
    );
  }

  /* Selalu mengabari, bukan hanya saat angkanya berubah.

     Versi sebelumnya hanya mengabari kalau jumlah kiriman tertunda berubah.
     Karena angkanya biasanya nol dan tetap nol, tampilan status tidak pernah
     ikut diperbarui — tablet yang sudah tersambung tetap menulis "Tanpa
     server". Memanggil ini tiap kali jauh lebih murah daripada satu jam
     mengira data tidak terkirim. */
  function hitungTertunda(nama, snap) {
    /* Dihitung per koleksi lalu dijumlahkan.

       Sebelumnya satu angka dipakai bersama, jadi tiap kali koleksi lain
       mengabarkan "nol tertunda" angkanya ikut jadi nol — nota yang belum
       terkirim pun tampak sudah aman. Ketahuan lewat Firebase tiruan: satu
       nota tertunda tetap tertulis "Tersinkron". */
    tertundaPer[nama] = snap.docs.filter((d) => d.metadata.hasPendingWrites).length;
    tertunda = Object.values(tertundaPer).reduce((a, b) => a + b, 0);
    kabarkanStatus();
  }

  const kabarkanStatus = () => onStatus({ tertunda, online: navigator.onLine, galat: galat || galatTulis });

  function hentikan() {
    pendengar.forEach((lepas) => {
      try {
        lepas();
      } catch (e) {
        /* pendengar sudah lepas */
      }
    });
    pendengar = [];
    siap = false;
  }

  /* ---------- Tulis ---------- */
  // Sengaja tidak di-await: Firestore sudah menyimpan ke antrean lokal lebih
  // dulu, jadi menunggu jaringan hanya akan membuat kasir menatap layar.

  /* Kegagalan menulis dulu hanya dicetak ke konsol.

     Itu berbahaya, bukan sekadar kurang rapi: kalau server menolak tulisan,
     Firestore MEMBATALKAN kembali perubahan lokalnya, lalu mengirim kabar
     daftar tanpa catatan itu — dan bagi aplikasi hasilnya persis sama
     dengan "catatan ini memang sudah dihapus". Nota yang sebenarnya gagal
     terkirim jadi ikut lenyap, tanpa satu pun tanda di layar. Sekarang
     kegagalannya ikut mewarnai status sambungan. */
  function catatGagal(apa, e) {
    console.error(apa, e);
    galatTulis = e?.code || 'gagal';
    kabarkanStatus();
  }

  function catatBerhasil() {
    if (!galatTulis) return;
    galatTulis = null;
    kabarkanStatus();
  }

  /** Mengembalikan janji yang baru selesai kalau server SUDAH menerimanya.
      Saat offline janji itu menggantung sampai sambungan kembali — memang
      begitu maunya, lihat penanda awanOk di js/db.js. */
  function tulis(koleksi, doc) {
    if (!aktif()) return null;
    const { id, ...isi } = doc;
    return induk()
      .collection(koleksi)
      .doc(String(id))
      .set(isi, { merge: false })
      .then(catatBerhasil)
      .catch((e) => {
        catatGagal('Gagal menulis ' + koleksi + '/' + id, e);
        throw e;
      });
  }

  function hapus(koleksi, id) {
    if (!aktif()) return null;
    return induk()
      .collection(koleksi)
      .doc(String(id))
      .delete()
      .then(catatBerhasil)
      .catch((e) => {
        catatGagal('Gagal menghapus ' + koleksi + '/' + id, e);
        throw e;
      });
  }

  function tulisToko(toko) {
    if (!aktif()) return;
    induk().set({ toko }, { merge: true }).catch((e) => catatGagal('Gagal menulis data toko', e));
  }

  /** Kirim seluruh isi state sekaligus. Dipakai saat memindahkan data lama. */
  async function unggahSemua(state) {
    if (!aktif()) throw new Error('Belum masuk ke akun toko');
    let jumlah = 0;
    for (const nama of KOLEKSI) {
      const daftar = state[nama] || [];
      // Firestore membatasi 500 operasi per batch.
      for (let i = 0; i < daftar.length; i += 400) {
        const batch = dbAwan.batch();
        for (const item of daftar.slice(i, i + 400)) {
          const { id, ...isi } = item;
          batch.set(induk().collection(nama).doc(String(id)), isi);
          jumlah += 1;
        }
        await batch.commit();
      }
    }
    await induk().set({ toko: state.toko }, { merge: true });
    return jumlah;
  }

  /** Apakah server sudah punya data? Dipakai agar pemindahan tidak menimpa. */
  async function serverBerisi() {
    if (!aktif()) return false;
    // Daftar layanan ikut diperiksa: server yang hanya punya keterangan toko
    // tapi tanpa satu pun layanan belum bisa disebut siap dipakai.
    for (const nama of ['pesanan', 'layanan']) {
      const cek = await induk().collection(nama).limit(1).get();
      if (!cek.empty) return true;
    }
    return false;
  }

  /* Berapa catatan yang benar-benar ada DI SERVER.

     Sengaja memaksa source 'server': tanpa itu Firestore boleh menjawab dari
     simpanan lokalnya sendiri, dan angka yang keluar cuma cerminan perangkat
     ini — persis pertanyaan yang sedang ingin dijawab pemilik saat datanya
     hilang di satu perangkat. */
  async function hitungServer() {
    if (!aktif()) throw new Error('Belum tersambung ke akun toko');
    const hasil = {};
    for (const nama of KOLEKSI) {
      const snap = await induk().collection(nama).get({ source: 'server' });
      hasil[nama] = snap.size;
    }
    return hasil;
  }

  /** Baca seluruh isi server sekali, langsung dari server. Untuk pemulihan
      manual saat satu perangkat kehilangan isinya. */
  async function ambilSemua() {
    if (!aktif()) throw new Error('Belum tersambung ke akun toko');
    const hasil = {};
    for (const nama of KOLEKSI) {
      const snap = await induk().collection(nama).get({ source: 'server' });
      hasil[nama] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }
    return hasil;
  }

  const aktif = () => !!(dbAwan && akun());
  const sudahSiap = () => siap;
  const jumlahTertunda = () => tertunda;

  return {
    KONFIG, TOKO, KOLEKSI,
    tersedia, mulai, akun, pantauAkun, masukToko, keluarToko, periksaSandiToko,
    galatTulis: () => galatTulis,
    sinkronkan, hentikan, tulis, hapus, tulisToko, unggahSemua, serverBerisi, hitungServer, ambilSemua,
    aktif, sudahSiap, jumlahTertunda,
  };
})();
