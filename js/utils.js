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

  /** Urai daftar kontak jadi [{nama, hp}].

      Sengaja longgar karena daftar pelanggan bisa datang dari mana saja:
      ekspor kontak HP (CSV berjudul), salinan dari Excel (dipisah tab),
      titik koma ala Excel Indonesia, sampai ketikan bebas "Ibu Sari 08123...".
      Baris yang tidak mengandung nama maupun nomor dilewati, bukan bikin gagal. */
  const uraiKontak = (teks) => {
    const barisan = String(teks || '').split(/\r?\n/).map((b) => b.trim()).filter(Boolean);
    if (!barisan.length) return { data: [], dilewati: 0 };

    const pisah = (b) => {
      const sep = b.includes('\t') ? '\t' : b.includes(';') ? ';' : b.includes(',') ? ',' : null;
      if (!sep) return [b];
      return b.split(sep).map((x) => x.trim().replace(/^"(.*)"$/, '$1').trim());
    };

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

  return { rupiah, angka, tanggal, jam, tanggalJam, hariKunci, hariIni, tambahHari, idBaru, esc, waNomor, uraiKontak, bacaGambarKecil, toast, konfirmasi };
})();
