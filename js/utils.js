/* Utilitas umum: format angka, tanggal, dan helper DOM kecil. */
window.U = (function () {
  const rupiah = (n) => 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID');

  const angka = (n) => (Number(n) || 0).toLocaleString('id-ID', { maximumFractionDigits: 2 });

  const tanggal = (iso) =>
    new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

  const jam = (iso) =>
    new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  const tanggalJam = (iso) => `${tanggal(iso)} ${jam(iso)}`;

  /** Kunci tanggal lokal (YYYY-MM-DD) — dipakai untuk mengelompokkan laporan harian. */
  const hariKunci = (d) => {
    const t = new Date(d);
    const off = t.getTimezoneOffset() * 60000;
    return new Date(t - off).toISOString().slice(0, 10);
  };

  const hariIni = () => hariKunci(new Date());

  const tambahHari = (iso, hari) => {
    const t = new Date(iso);
    t.setDate(t.getDate() + Number(hari || 0));
    return t.toISOString();
  };

  const tambahJam = (iso, jam) => new Date(new Date(iso).getTime() + Number(jam || 0) * 3600000).toISOString();

  /* Tampilan waktu selesai. Untuk layanan ekspres, tanggal saja tidak cukup —
     "selesai hari ini" tidak memberi tahu pelanggan jam berapa harus datang.
     Maka jam ikut ditampilkan kalau targetnya kurang dari dua hari lagi. */
  const estimasi = (iso) => {
    const selisih = new Date(iso) - Date.now();
    return selisih < 48 * 3600000 ? tanggalJam(iso) : tanggal(iso);
  };

  const idBaru = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  /** Escape teks sebelum masuk ke innerHTML. */
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );

  /** Normalkan nomor HP Indonesia ke format wa.me (62xxx). */
  const waNomor = (hp) => {
    const d = String(hp || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.startsWith('62')) return d;
    if (d.startsWith('0')) return '62' + d.slice(1);
    return d;
  };

  /* Pemecah baris CSV yang menghormati tanda kutip.

     Pemecah sederhana dengan split(',') memotong nilai yang memang berisi
     koma — misalnya layanan bernama "Cuci, Setrika" atau harga "12.500,00"
     hasil ekspor Excel. Berkas ekspor aplikasi ini sendiri memberi tanda
     kutip pada nilai semacam itu, jadi tanpa ini hasil ekspor tidak bisa
     dibaca kembali oleh impornya sendiri. */
  const pisahBaris = (baris) => {
    const sep = baris.includes('\t') ? '\t' : baris.includes(';') ? ';' : baris.includes(',') ? ',' : null;
    if (!sep) return [baris.trim()];

    const kolom = [];
    let kini = '';
    let dalamKutip = false;

    for (let i = 0; i < baris.length; i++) {
      const c = baris[i];
      if (c === '"') {
        if (dalamKutip && baris[i + 1] === '"') {   // "" di dalam kutip = satu kutip
          kini += '"';
          i += 1;
        } else {
          dalamKutip = !dalamKutip;
        }
      } else if (c === sep && !dalamKutip) {
        kolom.push(kini.trim());
        kini = '';
      } else {
        kini += c;
      }
    }
    kolom.push(kini.trim());
    return kolom;
  };

  /* Membaca daftar layanan dari tempelan teks: CSV berjudul, salinan dari
     Excel (dipisah tab), titik koma, atau ketikan bebas "Nama, harga".

     Ditulis longgar dengan sengaja. Daftar layanan biasanya datang dari
     aplikasi kasir sebelumnya, dan bentuknya tidak pernah bisa ditebak —
     lebih baik menerima banyak bentuk lalu memperlihatkan pratinjau sebelum
     data benar-benar masuk. */
  const uraiLayanan = (teks) => {
    const barisan = String(teks || '').split(/\r?\n/).map((b) => b.trim()).filter(Boolean);
    if (!barisan.length) return { data: [], dilewati: 0 };

    const pisah = pisahBaris;

    /* Angka harga bisa datang dalam banyak bentuk: "Rp 12.500", "12,500",
       "12.500,00", atau "12500".

       Aturan "pemisah terakhir adalah desimal" TIDAK bisa dipakai sendirian
       di sini. Dengan aturan itu "Rp 15.000" terbaca 15 — ketahuan waktu
       menguji impor dari daftar harga gaya Indonesia. Maka: pemisah yang
       diikuti tepat tiga angka, atau muncul lebih dari sekali, selalu
       dianggap pemisah ribuan. */
    const keAngka = (v) => {
      const bersih = String(v || '').replace(/[^0-9,.-]/g, '');
      if (!bersih) return NaN;

      const punyaKoma = bersih.includes(',');
      const punyaTitik = bersih.includes('.');

      if (punyaKoma && punyaTitik) {
        // Dua-duanya ada: yang terakhir pasti desimal, yang lain ribuan.
        const desimal = bersih.lastIndexOf(',') > bersih.lastIndexOf('.') ? ',' : '.';
        const ribuan = desimal === ',' ? '.' : ',';
        return Number(bersih.split(ribuan).join('').replace(desimal, '.'));
      }

      const tanda = punyaKoma ? ',' : punyaTitik ? '.' : null;
      if (!tanda) return Number(bersih);

      const bagian = bersih.split(tanda);
      const ribuan = bagian.length > 2 || bagian[bagian.length - 1].length === 3;
      return ribuan ? Number(bagian.join('')) : Number(bagian.join('.'));
    };

    let kNama = 0;
    let kHarga = 1;
    let kSatuan = -1;
    let kDurasi = -1;
    let kKategori = -1;
    let kJam = -1;
    let kepalaAsli = null;
    let mulai = 0;

    const kepala = pisah(barisan[0]).map((x) => x.toLowerCase());
    if (kepala.length > 1) {
      const iNama = kepala.findIndex((x) => /nama|layanan|service|item|produk|jenis/.test(x));
      const iHarga = kepala.findIndex((x) => /harga|tarif|price|biaya/.test(x));
      const iSatuan = kepala.findIndex((x) => /satuan|unit|uom/.test(x));
      const iDurasi = kepala.findIndex((x) => /durasi|estimasi|lama|hari|day/.test(x));
      const iKategori = kepala.findIndex((x) => /kategori|categor|paket|tipe|type/.test(x));
      const iJam = kepala.findIndex((x) => /^jam$|jam\b|hour/.test(x));
      // Kolom sisa yang berisi angka dianggap harga per kecepatan, dengan
      // judul kolom sebagai nama pilihan estimasinya.
      kepalaAsli = pisah(barisan[0]);
      if (iNama >= 0 || iHarga >= 0) {
        kNama = iNama >= 0 ? iNama : 0;
        kHarga = iHarga >= 0 ? iHarga : 1;
        kSatuan = iSatuan;
        kDurasi = iJam >= 0 ? -1 : iDurasi;   // kolom jam lebih tepat daripada hari
        kKategori = iKategori;
        kJam = iJam;
        mulai = 1;
      }
    }

    const data = [];
    let dilewati = 0;

    for (let i = mulai; i < barisan.length; i++) {
      const kolom = pisah(barisan[i]);
      const nama = (kolom[kNama] || '').trim();
      let harga = keAngka(kolom[kHarga]);

      // Tanpa judul dan hanya satu kolom: cari angka di ujung baris.
      if (kolom.length === 1) {
        const cocok = nama.match(/^(.*?)[\s:=-]+((?:rp\s*)?[\d.,]+)$/i);
        if (cocok) {
          data.push(rapikanLayanan(cocok[1], keAngka(cocok[2]), '', ''));
          continue;
        }
        dilewati += 1;
        continue;
      }

      if (!nama || !isFinite(harga)) {
        dilewati += 1;
        continue;
      }
      data.push(
        rapikanLayanan(nama, harga, kSatuan >= 0 ? kolom[kSatuan] : '', kDurasi >= 0 ? kolom[kDurasi] : '', {
          kategori: kKategori >= 0 ? kolom[kKategori] : '',
          jam: kJam >= 0 ? kolom[kJam] : '',
          hargaPer: hargaPerKolom(kepalaAsli, kolom, [kNama, kHarga, kSatuan, kDurasi, kKategori, kJam], keAngka),
        })
      );
    }

    return { data: data.filter(Boolean), dilewati: dilewati + (data.length - data.filter(Boolean).length) };
  };

  /* Kolom di luar kolom baku yang berisi angka dibaca sebagai harga per
     kecepatan; judul kolomnya jadi nama pilihan estimasinya. Berkas ekspor
     aplikasi ini sendiri berbentuk begitu, jadi hasil ekspor bisa disunting
     di Excel lalu dimasukkan kembali lengkap dengan tabel harganya. */
  function hargaPerKolom(kepala, kolom, dipakai, keAngka) {
    if (!kepala) return null;
    const hasil = {};
    for (let i = 0; i < kepala.length; i++) {
      if (dipakai.includes(i)) continue;
      const judul = String(kepala[i] || '').trim();
      const nilai = keAngka(kolom[i]);
      if (judul && isFinite(nilai) && nilai > 0) hasil[judul] = Math.round(nilai);
    }
    return Object.keys(hasil).length ? hasil : null;
  }

  function rapikanLayanan(nama, harga, satuan, durasi, tambahan) {
    const bersihNama = String(nama || '').trim().replace(/^["\u2018\u2019]|["\u2018\u2019]$/g, '');
    if (!bersihNama || !isFinite(harga) || harga < 0) return null;
    const s = String(satuan || '').toLowerCase();
    const hari = parseInt(String(durasi || '').replace(/[^0-9]/g, ''), 10);
    const jamKolom = parseInt(String(tambahan?.jam || '').replace(/[^0-9]/g, ''), 10);
    return {
      kategori: String(tambahan?.kategori || '').trim(),
      jam: jamKolom > 0 && jamKolom <= 24 * 60 ? jamKolom : null,
      hargaPerNama: tambahan?.hargaPer || null,
      nama: bersihNama.slice(0, 60),
      harga: Math.round(harga),
      // pcs dipakai kalau memang tertulis begitu; selain itu kg, satuan
      // paling lazim di laundry.
      satuan: /^m$|meter|mtr|m2|persegi/.test(s) ? 'm' : /pcs|pc|buah|potong|item|unit|lembar|set/.test(s) ? 'pcs' : 'kg',
      durasi: hari > 0 && hari < 60 ? hari : 2,
    };
  }

  /** Urai daftar kontak jadi [{nama, hp}].

      Sengaja longgar karena daftar pelanggan bisa datang dari mana saja:
      ekspor kontak HP (CSV berjudul), salinan dari Excel (dipisah tab),
      titik koma ala Excel Indonesia, sampai ketikan bebas "Ibu Sari 08123...".
      Baris yang tidak mengandung nama maupun nomor dilewati, bukan bikin gagal. */
  const uraiKontak = (teks) => {
    const barisan = String(teks || '').split(/\r?\n/).map((b) => b.trim()).filter(Boolean);
    if (!barisan.length) return { data: [], dilewati: 0 };

    const pisah = pisahBaris;

    // Deteksi baris judul supaya kolom tidak tertukar.
    let kNama = 0;
    let kHp = 1;
    let mulai = 0;
    const kepala = pisah(barisan[0]).map((x) => x.toLowerCase());
    if (kepala.length > 1) {
      const iNama = kepala.findIndex((x) => /nama|name|pelanggan|customer|contact/.test(x));
      const iHp = kepala.findIndex((x) => /hp|telp|tlp|phone|wa|whatsapp|nomor|no\b|number/.test(x));
      if (iNama >= 0 || iHp >= 0) {
        kNama = iNama >= 0 ? iNama : iHp === 0 ? 1 : 0;
        kHp = iHp >= 0 ? iHp : kNama === 0 ? 1 : 0;
        mulai = 1;
      }
    }

    const adaAngka = (s) => (String(s).match(/\d/g) || []).length >= 8;
    const data = [];
    let dilewati = 0;

    for (let i = mulai; i < barisan.length; i++) {
      const kolom = pisah(barisan[i]);
      let nama = '';
      let hp = '';

      if (kolom.length > 1) {
        nama = kolom[kNama] || '';
        hp = kolom[kHp] || '';
        // Kalau ternyata terbalik, tukar berdasarkan mana yang berisi angka.
        if (!adaAngka(hp) && adaAngka(nama)) [nama, hp] = [hp, nama];
      } else {
        // Satu kolom: cari nomornya di dalam baris, sisanya jadi nama.
        const cocok = kolom[0].match(/(\+?\d[\d\s().-]{7,}\d)/);
        if (cocok) {
          hp = cocok[1];
          nama = kolom[0].replace(cocok[1], '').replace(/[-–:,|]+\s*$/, '').trim();
        } else {
          nama = kolom[0];
        }
      }

      nama = nama.trim();
      hp = adaAngka(hp) ? hp.trim() : '';
      if (!nama && !hp) {
        dilewati += 1;
        continue;
      }
      data.push({ nama: nama || 'Tanpa Nama', hp });
    }

    return { data, dilewati };
  };

  /** Baca berkas gambar lalu perkecil ke sisi terpanjang `maks` piksel.
      Logo disimpan di dalam localStorage, jadi ukurannya harus ditekan. */
  const bacaGambarKecil = (file, maks = 320) =>
    new Promise((resolve, reject) => {
      const pembaca = new FileReader();
      pembaca.onerror = () => reject(new Error('Berkas gagal dibaca'));
      pembaca.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Berkas itu bukan gambar yang bisa dibaca'));
        img.onload = () => {
          const skala = Math.min(1, maks / Math.max(img.width, img.height));
          const kanvas = document.createElement('canvas');
          kanvas.width = Math.round(img.width * skala);
          kanvas.height = Math.round(img.height * skala);
          kanvas.getContext('2d').drawImage(img, 0, 0, kanvas.width, kanvas.height);
          resolve(kanvas.toDataURL('image/png'));
        };
        img.src = pembaca.result;
      };
      pembaca.readAsDataURL(file);
    });


  /* Versi berkas yang benar-benar sedang berjalan di perangkat ini.

     Dibaca dari penanda ?v= pada alamat berkas gaya, bukan ditulis ulang
     sebagai angka tersendiri — supaya tidak pernah bisa berbohong. Kalau
     perangkat masih menyajikan berkas lama dari simpanan, angka yang
     tampil ikut angka lama, dan itulah gunanya: pemilik bisa membandingkan
     angka di tablet dengan angka di HP tanpa menebak-nebak.

     Sebelum ini, setiap kali ada perangkat yang tertinggal versi, tidak ada
     satu pun cara untuk memastikannya selain mencoba fiturnya satu per satu. */
  const versiApp = () => {
    const tautan = document.querySelector('link[rel="stylesheet"][href*="?v="]');
    const cocok = tautan && tautan.getAttribute('href').match(/[?&]v=([^&"']+)/);
    return cocok ? cocok[1] : '–';
  };

  /* Paksa perangkat mengambil versi terbaru: lepas service worker, buang
     seluruh simpanan berkas, lalu buka alamat baru yang belum pernah ada.
     Data pesanan TIDAK ikut terhapus — yang dibuang hanya salinan berkas
     aplikasi, bukan localStorage. */
  async function perbaruiAplikasi() {
    try {
      if ('serviceWorker' in navigator) {
        const daftar = await navigator.serviceWorker.getRegistrations();
        await Promise.all(daftar.map((r) => r.unregister().catch(() => {})));
      }
      if (window.caches) {
        const kunci = await caches.keys();
        await Promise.all(kunci.map((k) => caches.delete(k).catch(() => {})));
      }
    } catch (e) {
      console.warn('Pembersihan simpanan tidak lengkap', e);
    }
    const alamat = new URL(location.href);
    alamat.searchParams.set('segar', String(Date.now()));
    location.replace(alamat.toString());
  }

  const toast = (pesan) => {
    const el = document.getElementById('toast');
    el.textContent = pesan;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 2200);
  };

  /** Modal konfirmasi berbasis <dialog>, mengembalikan Promise<boolean>.

     Memakai dialog SENDIRI, terpisah dari #modal yang dipakai halaman.

     Dulu keduanya berbagi satu dialog, dan itu diam-diam mematikan tombol
     Hapus pada detail pesanan: penanganannya menutup modal detail lalu
     langsung membuka konfirmasi, sementara peristiwa "close" dari modal
     pertama baru tiba sesudahnya — dan langsung ditangkap oleh penunggu
     konfirmasi yang baru. Jawabannya terbaca "Batal" padahal pemilik belum
     menekan apa pun, jadi pesanan tidak pernah terhapus dan tidak ada pesan
     kesalahan apa pun. */
  const dialogKonfirmasi = () => {
    let modal = document.getElementById('modalKonfirmasi');
    if (!modal) {
      modal = document.createElement('dialog');
      modal.id = 'modalKonfirmasi';
      modal.className = 'modal';
      modal.innerHTML = '<form method="dialog" class="modal-inner"></form>';
      document.body.appendChild(modal);
    }
    return modal;
  };

  const konfirmasi = (judul, pesan, labelYa = 'Ya, lanjutkan') =>
    new Promise((resolve) => {
      const modal = dialogKonfirmasi();
      const inner = modal.querySelector('.modal-inner');
      inner.innerHTML = `
        <h3>${esc(judul)}</h3>
        <p class="muted">${esc(pesan)}</p>
        <div class="modal-actions">
          <button class="btn" value="batal">Batal</button>
          <button class="btn btn-danger" value="ya">${esc(labelYa)}</button>
        </div>`;
      modal.returnValue = 'batal';
      modal.showModal();
      modal.addEventListener('close', () => resolve(modal.returnValue === 'ya'), { once: true });
    });

  return { rupiah, angka, tanggal, jam, tanggalJam, hariKunci, hariIni, tambahHari, tambahJam, estimasi, idBaru, esc, waNomor, uraiKontak, uraiLayanan, bacaGambarKecil, toast, konfirmasi, versiApp, perbaruiAplikasi };
})();
