/* Semua tampilan halaman. Setiap fungsi mengisi elemen utama lalu memasang listener-nya sendiri. */
window.Views = (function () {
  const esc = U.esc;

  /* ============ Helper modal form ============ */
  function formModal(judul, isiHTML, onSimpan, labelSimpan = 'Simpan') {
    const modal = document.getElementById('modal');
    const inner = document.getElementById('modalInner');
    inner.innerHTML = `
      <h3>${esc(judul)}</h3>
      ${isiHTML}
      <div class="modal-actions">
        <button type="submit" class="btn" value="batal">Batal</button>
        <button type="submit" class="btn btn-primary" value="simpan">${esc(labelSimpan)}</button>
      </div>`;
    modal.returnValue = 'batal';
    modal.showModal();
    modal.addEventListener(
      'close',
      () => {
        if (modal.returnValue !== 'simpan') return;
        const nilai = {};
        inner.querySelectorAll('[name]').forEach((el) => {
          nilai[el.name] = el.type === 'checkbox' ? el.checked : el.value;
        });
        onSimpan(nilai);
      },
      { once: true }
    );
  }

  function badgeStatus(status) {
    const kelas = { antrian: 'pill-warn', proses: 'pill-info', siap: 'pill-ok', diambil: 'pill-muted' };
    return `<span class="pill ${kelas[status] || 'pill-muted'}">${esc(DB.LABEL_STATUS[status] || status)}</span>`;
  }

  /* ============ Grafik batang sederhana (satu seri, tanpa pustaka) ============
     Satu seri saja, jadi tidak perlu legenda — judul kartu yang menamainya.
     Batang memakai warna merek; label nilai hanya pada batang tertinggi dan
     hari ini, sisanya muncul saat batang disentuh. */
  function grafikBatang(el, data, format) {
    const maks = Math.max(1, ...data.map((d) => d.nilai));
    const iMaks = data.findIndex((d) => d.nilai === maks);

    el.innerHTML = `
      <div class="grafik">
        <div class="grafik-batangan" role="img" aria-label="Grafik batang, ${data.length} hari terakhir">
          ${data
            .map((d, i) => {
              // Batang nol tetap disisakan garis tipis supaya harinya terlihat ada.
              const persen = d.nilai === 0 ? 0 : Math.max(4, (100 * d.nilai) / maks);
              const berlabel = i === iMaks || d.hariIni;
              return `
            <div class="gb-kolom" data-i="${i}">
              <div class="gb-nilai">${berlabel ? esc(format(d.nilai)) : ''}</div>
              <div class="gb-jalur">
                <div class="gb-isi ${d.hariIni ? 'kini' : ''}" style="height:${persen}%"></div>
              </div>
              <div class="gb-label ${d.hariIni ? 'kini' : ''}">${esc(d.label)}</div>
            </div>`;
            })
            .join('')}
        </div>
        <p class="grafik-tip muted" id="grafikTip">Sentuh batang untuk melihat angkanya.</p>
        <details class="grafik-tabel">
          <summary>Lihat sebagai tabel</summary>
          <div class="table-wrap"><table>
            <thead><tr><th>Hari</th><th class="right">Jumlah</th></tr></thead>
            <tbody>${data.map((d) => `<tr><td>${esc(d.judul)}</td><td class="right">${format(d.nilai)}</td></tr>`).join('')}</tbody>
          </table></div>
        </details>
      </div>`;

    const tip = el.querySelector('#grafikTip');
    const tunjuk = (i) => {
      const d = data[i];
      tip.textContent = `${d.judul}: ${format(d.nilai)}`;
    };
    el.querySelectorAll('.gb-kolom').forEach((b) => {
      b.addEventListener('pointerenter', () => tunjuk(+b.dataset.i));
      b.addEventListener('pointerdown', () => tunjuk(+b.dataset.i));
    });
  }

  /* ================= BERANDA ================= */
  function beranda(el) {
    const owner = Auth.isOwner();
    const semua = DB.pesanan();
    const hariIni = U.hariIni();
    const sekarang = new Date();

    const pesananHariIni = semua.filter((p) => U.hariKunci(p.dibuat) === hariIni);
    const omzetHariIni = pesananHariIni.reduce((a, p) => a + p.total, 0);
    const belumAmbil = semua.filter((p) => p.status !== 'diambil');
    const siapDiambil = semua.filter((p) => p.status === 'siap');
    const sedangDicuci = semua.filter((p) => p.status === 'proses');
    const terlambat = belumAmbil.filter((p) => new Date(p.estimasiSelesai) < sekarang);
    const belumLunas = semua.filter((p) => !p.lunas);
    const piutang = belumLunas.reduce((a, p) => a + (p.total - p.dibayar), 0);

    // Laba bulan berjalan, memakai perhitungan yang sama persis dengan Laporan.
    const bulan = rentangWaktu('bulan');
    const dalamBulan = (iso) => {
      const t = new Date(iso);
      return t >= bulan.dari && t <= bulan.sampai;
    };
    const omzetBulan = semua.filter((p) => dalamBulan(p.dibuat)).reduce((a, p) => a + p.total, 0);
    const keluarBulan = DB.pengeluaran().filter((x) => dalamBulan(x.tanggal + 'T12:00:00')).reduce((a, x) => a + x.jumlah, 0);
    const labaBulan = omzetBulan - keluarBulan;

    // Tujuh hari terakhir, hari ini paling kanan.
    const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const tren = [];
    for (let i = 6; i >= 0; i--) {
      const t = new Date();
      t.setHours(0, 0, 0, 0);
      t.setDate(t.getDate() - i);
      const kunci = U.hariKunci(t);
      const punya = semua.filter((p) => U.hariKunci(p.dibuat) === kunci);
      tren.push({
        label: HARI[t.getDay()],
        judul: U.tanggal(t),
        nilai: owner ? punya.reduce((a, p) => a + p.total, 0) : punya.length,
        hariIni: kunci === hariIni,
      });
    }

    const tile = (label, nilai, keterangan, kelas = '') =>
      `<div class="stat ${kelas}">
         <div class="stat-label">${esc(label)}</div>
         <div class="stat-value">${nilai}</div>
         ${keterangan ? `<div class="stat-note">${keterangan}</div>` : ''}
       </div>`;

    const daftarRingkas = (judul, daftar, kelasPill, kosong) => `
      <div class="perhatian-blok">
        <div class="perhatian-judul">
          <span>${esc(judul)}</span>
          <span class="pill ${kelasPill}">${daftar.length}</span>
        </div>
        ${
          daftar.length
            ? `<ul class="perhatian-daftar">${daftar
                .slice(0, 5)
                .map(
                  (p) => `<li><button type="button" data-buka="${p.id}">
                      <span>${esc(p.pelanggan.nama)}</span>
                      <span class="muted">${esc(p.kode)}</span>
                    </button></li>`
                )
                .join('')}
               ${daftar.length > 5 ? `<li class="muted" style="padding:6px 2px">+${daftar.length - 5} lainnya</li>` : ''}
              </ul>`
            : `<p class="muted" style="margin:6px 0 0">${esc(kosong)}</p>`
        }
      </div>`;

    el.innerHTML = `
      <div class="page-head">
        <div>
          <h1 class="page-title">Beranda</h1>
          <p class="page-sub">${esc(DB.toko().nama)} • ${U.tanggal(sekarang)}</p>
        </div>
        <button class="btn btn-primary" id="btnPesananBaru" type="button">+ Pesanan Baru</button>
      </div>

      <div class="stats">
        ${
          owner
            ? tile('Omzet hari ini', U.rupiah(omzetHariIni), `${pesananHariIni.length} pesanan masuk`, 'stat-hero') +
              tile(
                labaBulan < 0 ? 'Rugi bulan ini' : 'Laba bulan ini',
                U.rupiah(Math.abs(labaBulan)),
                `omzet ${U.rupiah(omzetBulan)} \u2212 keluar ${U.rupiah(keluarBulan)}`,
                labaBulan < 0 ? 'stat-rugi' : ''
              ) +
              tile('Belum dibayar', U.rupiah(piutang), `${belumLunas.length} nota`) +
              tile('Cucian belum diambil', belumAmbil.length, `${siapDiambil.length} sudah siap`) +
              tile('Lewat estimasi', terlambat.length, terlambat.length ? 'perlu ditindaklanjuti' : 'semua tepat waktu')
            : tile('Pesanan hari ini', pesananHariIni.length, 'diterima sejak pagi', 'stat-hero') +
              tile('Sedang dicuci', sedangDicuci.length, '') +
              tile('Siap diambil', siapDiambil.length, 'tunggu pelanggan') +
              tile('Lewat estimasi', terlambat.length, terlambat.length ? 'perlu ditindaklanjuti' : 'semua tepat waktu')
        }
      </div>

      <div class="beranda-bawah">
        <div class="card">
          <div class="card-head">${owner ? 'Omzet 7 hari terakhir' : 'Pesanan masuk 7 hari terakhir'}</div>
          <div class="card-pad" id="kotakGrafik"></div>
        </div>

        <div class="card card-pad" id="perhatian">
          <h3 style="margin:0 0 12px">Perlu perhatian</h3>
          ${daftarRingkas('Siap diambil', siapDiambil, 'pill-ok', 'Belum ada yang menunggu diambil.')}
          ${daftarRingkas('Lewat estimasi', terlambat, 'pill-danger', 'Tidak ada yang terlambat.')}
          ${owner ? daftarRingkas('Belum lunas', belumLunas, 'pill-warn', 'Semua nota sudah lunas.') : ''}
        </div>
      </div>`;

    grafikBatang(el.querySelector('#kotakGrafik'), tren, owner ? U.rupiah : (n) => `${n} pesanan`);

    el.querySelector('#btnPesananBaru').addEventListener('click', () => {
      location.hash = 'kasir';
    });

    el.querySelector('#perhatian').addEventListener('click', (e) => {
      const b = e.target.closest('[data-buka]');
      if (b) detailPesanan(b.dataset.buka, () => beranda(el));
    });
  }

  /* ================= KASIR ================= */
  const pos = { keranjang: [], cari: '' };

  function kasir(el) {
    el.innerHTML = `
      <div class="page-head">
        <div>
          <h1 class="page-title">Kasir</h1>
          <p class="page-sub">Pilih layanan, isi berat atau jumlah, lalu simpan pesanan.</p>
        </div>
      </div>
      <div class="pos">
        <div>
          <div class="filters">
            <input class="input" id="cariLayanan" type="search" placeholder="Cari layanan…" value="${esc(pos.cari)}">
          </div>
          <div class="svc-grid" id="svcGrid"></div>
        </div>

        <div class="card cart">
          <div class="card-head">
            <span>Pesanan Baru</span>
            <button class="btn btn-sm btn-ghost" id="btnKosong" type="button">Kosongkan</button>
          </div>
          <div class="card-pad" style="border-bottom:1px solid var(--border)">
            <div class="field">
              <label for="inpNama">Nama pelanggan</label>
              <input class="input" id="inpNama" list="dlNama" autocomplete="off" placeholder="Ketik nama, pelanggan lama muncul sendiri">
              <datalist id="dlNama"></datalist>
            </div>
            <div class="field" style="margin-bottom:0">
              <label for="inpHp">No. WhatsApp (opsional)</label>
              <input class="input" id="inpHp" type="tel" inputmode="numeric" list="dlHp" autocomplete="off" placeholder="08xxxxxxxxxx">
              <datalist id="dlHp"></datalist>
            </div>
          </div>
          <div class="cart-items" id="cartItems"></div>
          <div class="cart-foot">
            <div class="sum-line"><span>Subtotal</span><b id="sumSubtotal">Rp 0</b></div>
            <div class="field mt">
              <label for="inpDiskon">Diskon (Rp)</label>
              <input class="input" id="inpDiskon" type="number" inputmode="numeric" min="0" step="500" value="0">
            </div>
            <div class="sum-total"><span>Total</span><span id="sumTotal">Rp 0</span></div>
            <div class="field">
              <label>Metode bayar</label>
              <div class="seg" id="segMetode">
                <button type="button" class="is-active" data-metode="tunai">Tunai</button>
                <button type="button" data-metode="transfer">Transfer</button>
                <button type="button" data-metode="qris">QRIS</button>
              </div>
            </div>
            <div class="field">
              <label for="inpBayar">Uang diterima (Rp)</label>
              <input class="input" id="inpBayar" type="number" inputmode="numeric" min="0" step="1000" value="0">
              <small class="muted" id="infoKembali">Kosongkan / isi 0 jika bayar nanti saat ambil.</small>
            </div>
            <div class="field">
              <label for="inpCatatan">Catatan</label>
              <input class="input" id="inpCatatan" placeholder="Contoh: pisahkan pakaian putih">
            </div>
            <button class="btn btn-primary btn-block" id="btnSimpan" type="button" disabled>Simpan &amp; Cetak Struk</button>
          </div>
        </div>
      </div>`;

    const grid = el.querySelector('#svcGrid');

    /* Pelanggan lama bisa dipanggil tanpa mengetik ulang: nama dan nomor saling
       melengkapi. Inilah yang membuat impor daftar pelanggan terasa gunanya. */
    (function siapkanPelanggan() {
      const buku = DB.pelanggan().slice(0, 500);
      const inpNama = el.querySelector('#inpNama');
      const inpHp = el.querySelector('#inpHp');

      el.querySelector('#dlNama').innerHTML = buku
        .filter((c) => c.nama)
        .map((c) => `<option value="${esc(c.nama)}">${esc(c.hp || '')}</option>`)
        .join('');
      el.querySelector('#dlHp').innerHTML = buku
        .filter((c) => c.hp)
        .map((c) => `<option value="${esc(c.hp)}">${esc(c.nama)}</option>`)
        .join('');

      const cocokNama = (v) => buku.find((c) => c.nama.toLowerCase() === v.trim().toLowerCase());
      const cocokHp = (v) => buku.find((c) => c.hp && U.waNomor(c.hp) === U.waNomor(v));

      inpNama.addEventListener('change', () => {
        const c = cocokNama(inpNama.value);
        if (c?.hp && !inpHp.value.trim()) inpHp.value = c.hp;
      });
      inpHp.addEventListener('change', () => {
        const c = cocokHp(inpHp.value);
        if (c?.nama && !inpNama.value.trim()) inpNama.value = c.nama;
      });
    })();

    function gambarLayanan() {
      const q = pos.cari.toLowerCase();
      const daftar = DB.layananAktif().filter((l) => l.nama.toLowerCase().includes(q));
      grid.innerHTML = daftar.length
        ? daftar
            .map(
              (l) => `
          <button class="svc" type="button" data-id="${l.id}">
            <span class="svc-name">${esc(l.nama)}</span>
            <span>
              <span class="svc-price">${U.rupiah(l.harga)}</span>
              <span class="svc-unit">/ ${esc(l.satuan)}</span>
            </span>
          </button>`
            )
            .join('')
        : `<p class="empty">Layanan tidak ditemukan.</p>`;
    }

    function gambarKeranjang() {
      const box = el.querySelector('#cartItems');
      box.innerHTML = pos.keranjang.length
        ? pos.keranjang
            .map(
              (i, idx) => `
        <div class="cart-item">
          <div class="cart-item-top">
            <span>${esc(i.nama)}</span>
            <span>${U.rupiah(i.qty * i.harga)}</span>
          </div>
          <div class="muted" style="font-size:13px">${U.rupiah(i.harga)} / ${esc(i.satuan)}</div>
          <div class="qty">
            <button type="button" data-kurang="${idx}">−</button>
            <input type="number" inputmode="decimal" min="0" step="${i.satuan === 'kg' ? '0.1' : '1'}" value="${i.qty}" data-qty="${idx}">
            <span class="muted">${esc(i.satuan)}</span>
            <button type="button" data-tambah="${idx}">+</button>
            <button type="button" class="btn btn-sm btn-danger" style="margin-left:auto" data-hapus="${idx}">Hapus</button>
          </div>
        </div>`
            )
            .join('')
        : `<p class="empty">Belum ada layanan dipilih.<br>Ketuk kartu layanan untuk menambah.</p>`;
      hitung();
    }

    function hitung() {
      const subtotal = pos.keranjang.reduce((a, i) => a + i.qty * i.harga, 0);
      const diskon = Math.min(Number(el.querySelector('#inpDiskon').value) || 0, subtotal);
      const total = subtotal - diskon;
      const bayar = Number(el.querySelector('#inpBayar').value) || 0;
      el.querySelector('#sumSubtotal').textContent = U.rupiah(subtotal);
      el.querySelector('#sumTotal').textContent = U.rupiah(total);
      el.querySelector('#btnSimpan').disabled = pos.keranjang.length === 0;
      const info = el.querySelector('#infoKembali');
      if (bayar === 0) info.textContent = 'Belum dibayar — pesanan ditandai "belum lunas".';
      else if (bayar < total) info.textContent = `Kurang ${U.rupiah(total - bayar)} (bayar sebagian).`;
      else info.textContent = `Kembalian ${U.rupiah(bayar - total)}.`;
      return { subtotal, diskon, total, bayar };
    }

    grid.addEventListener('click', (e) => {
      const tombol = e.target.closest('[data-id]');
      if (!tombol) return;
      const l = DB.cariLayanan(tombol.dataset.id);
      const ada = pos.keranjang.find((i) => i.layananId === l.id);
      if (ada) ada.qty = Math.round((ada.qty + 1) * 100) / 100;
      else pos.keranjang.push({ layananId: l.id, nama: l.nama, satuan: l.satuan, harga: l.harga, durasi: l.durasi, qty: 1 });
      gambarKeranjang();
    });

    el.querySelector('#cariLayanan').addEventListener('input', (e) => {
      pos.cari = e.target.value;
      gambarLayanan();
    });

    el.querySelector('#cartItems').addEventListener('click', (e) => {
      const t = e.target;
      const step = (idx) => (pos.keranjang[idx].satuan === 'kg' ? 0.5 : 1);
      if (t.dataset.tambah !== undefined) {
        const i = +t.dataset.tambah;
        pos.keranjang[i].qty = Math.round((pos.keranjang[i].qty + step(i)) * 100) / 100;
      } else if (t.dataset.kurang !== undefined) {
        const i = +t.dataset.kurang;
        pos.keranjang[i].qty = Math.max(0, Math.round((pos.keranjang[i].qty - step(i)) * 100) / 100);
      } else if (t.dataset.hapus !== undefined) {
        pos.keranjang.splice(+t.dataset.hapus, 1);
      } else return;
      gambarKeranjang();
    });

    el.querySelector('#cartItems').addEventListener('change', (e) => {
      if (e.target.dataset.qty === undefined) return;
      const i = +e.target.dataset.qty;
      pos.keranjang[i].qty = Math.max(0, Number(e.target.value) || 0);
      gambarKeranjang();
    });

    el.querySelector('#inpDiskon').addEventListener('input', hitung);
    el.querySelector('#inpBayar').addEventListener('input', hitung);

    el.querySelector('#segMetode').addEventListener('click', (e) => {
      const b = e.target.closest('[data-metode]');
      if (!b) return;
      el.querySelectorAll('#segMetode button').forEach((x) => x.classList.remove('is-active'));
      b.classList.add('is-active');
    });

    el.querySelector('#btnKosong').addEventListener('click', () => {
      pos.keranjang = [];
      gambarKeranjang();
    });

    el.querySelector('#btnSimpan').addEventListener('click', () => {
      const item = pos.keranjang.filter((i) => i.qty > 0).map((i) => ({ ...i, subtotal: i.qty * i.harga }));
      if (!item.length) return U.toast('Isi jumlah kg atau pcs dulu');
      const { subtotal, diskon, total, bayar } = hitung();
      const p = DB.buatPesanan({
        nama: el.querySelector('#inpNama').value,
        hp: el.querySelector('#inpHp').value,
        item,
        subtotal,
        diskon,
        total,
        dibayar: Math.min(bayar, total),
        diterima: bayar,
        kasir: Auth.aktif()?.nama,
        metode: el.querySelector('#segMetode .is-active').dataset.metode,
        catatan: el.querySelector('#inpCatatan').value,
      });
      pos.keranjang = [];
      kasir(el); // reset form
      U.toast(`Pesanan ${p.kode} tersimpan`);
      Receipt.cetak(p);
    });

    gambarLayanan();
    gambarKeranjang();
  }

  /* ================= PESANAN ================= */
  const filter = { status: 'semua', cari: '' };

  function pesanan(el) {
    el.innerHTML = `
      <div class="page-head">
        <div>
          <h1 class="page-title">Pesanan</h1>
          <p class="page-sub">Pantau cucian dari diterima sampai diambil pelanggan.</p>
        </div>
      </div>
      <div class="filters">
        <div class="seg" id="segStatus" style="flex:1">
          <button type="button" data-status="semua" class="is-active">Semua</button>
          <button type="button" data-status="antrian">Diterima</button>
          <button type="button" data-status="proses">Dicuci</button>
          <button type="button" data-status="siap">Siap</button>
          <button type="button" data-status="diambil">Selesai</button>
        </div>
        <input class="input" id="cariPesanan" type="search" placeholder="Cari nota / nama / HP…">
      </div>
      <div class="card"><div class="table-wrap"><table>
        <thead><tr>
          <th>Nota</th><th>Pelanggan</th><th>Total</th><th>Bayar</th><th>Status</th><th class="right">Aksi</th>
        </tr></thead>
        <tbody id="barisPesanan"></tbody>
      </table></div></div>`;

    const tbody = el.querySelector('#barisPesanan');

    function gambar() {
      const q = filter.cari.toLowerCase();
      const daftar = DB.pesanan().filter((p) => {
        const cocokStatus = filter.status === 'semua' || p.status === filter.status;
        const cocokCari =
          !q ||
          p.kode.toLowerCase().includes(q) ||
          p.pelanggan.nama.toLowerCase().includes(q) ||
          (p.pelanggan.hp || '').includes(q);
        return cocokStatus && cocokCari;
      });

      tbody.innerHTML = daftar.length
        ? daftar
            .map((p) => {
              const berikut = DB.STATUS[DB.STATUS.indexOf(p.status) + 1];
              return `
        <tr>
          <td>
            <b>${esc(p.kode)}</b>
            <div class="muted" style="font-size:12px">${U.tanggalJam(p.dibuat)}</div>
          </td>
          <td>
            ${esc(p.pelanggan.nama)}
            <div class="muted" style="font-size:12px">${esc(p.pelanggan.hp || '-')}</div>
          </td>
          <td>${U.rupiah(p.total)}</td>
          <td>${p.lunas ? '<span class="pill pill-ok">Lunas</span>' : `<span class="pill pill-danger">Sisa ${U.rupiah(p.total - p.dibayar)}</span>`}</td>
          <td>${badgeStatus(p.status)}</td>
          <td class="right" style="white-space:nowrap">
            ${berikut ? `<button class="btn btn-sm btn-primary" data-maju="${p.id}">→ ${esc(DB.LABEL_STATUS[berikut])}</button>` : ''}
            <button class="btn btn-sm" data-detail="${p.id}">Detail</button>
          </td>
        </tr>`;
            })
            .join('')
        : `<tr><td colspan="6"><p class="empty">Belum ada pesanan pada filter ini.</p></td></tr>`;
    }

    el.querySelector('#segStatus').addEventListener('click', (e) => {
      const b = e.target.closest('[data-status]');
      if (!b) return;
      filter.status = b.dataset.status;
      el.querySelectorAll('#segStatus button').forEach((x) => x.classList.remove('is-active'));
      b.classList.add('is-active');
      gambar();
    });

    el.querySelector('#cariPesanan').addEventListener('input', (e) => {
      filter.cari = e.target.value;
      gambar();
    });

    tbody.addEventListener('click', (e) => {
      const maju = e.target.closest('[data-maju]');
      const detail = e.target.closest('[data-detail]');
      if (maju) {
        const p = DB.cariPesanan(maju.dataset.maju);
        const berikut = DB.STATUS[DB.STATUS.indexOf(p.status) + 1];
        if (berikut === 'diambil' && !p.lunas) {
          U.toast('Lunasi pembayaran dulu di menu Detail');
          return;
        }
        DB.ubahStatus(p.id, berikut);
        U.toast(`${p.kode} → ${DB.LABEL_STATUS[berikut]}`);
        gambar();
      } else if (detail) {
        detailPesanan(detail.dataset.detail, gambar);
      }
    });

    gambar();
  }

  function detailPesanan(id, setelahUbah) {
    const p = DB.cariPesanan(id);
    if (!p) return;
    const sisa = Math.max(0, p.total - p.dibayar);
    const modal = document.getElementById('modal');
    const inner = document.getElementById('modalInner');
    inner.innerHTML = `
      <h3>${esc(p.kode)} ${badgeStatus(p.status)}</h3>
      <p class="muted" style="margin-top:-6px">
        ${esc(p.pelanggan.nama)} • ${esc(p.pelanggan.hp || 'tanpa HP')}<br>
        Masuk ${U.tanggalJam(p.dibuat)} • Estimasi ${U.tanggal(p.estimasiSelesai)}
        ${p.kasir && p.kasir !== '-' ? `<br>Diterima oleh ${esc(p.kasir)}` : ''}
      </p>
      <div class="table-wrap"><table>
        ${p.item
          .map(
            (i) => `<tr><td>${esc(i.nama)}<div class="muted" style="font-size:12px">${U.angka(i.qty)} ${esc(i.satuan)} × ${U.rupiah(i.harga)}</div></td>
                    <td class="right">${U.rupiah(i.subtotal)}</td></tr>`
          )
          .join('')}
        ${p.diskon ? `<tr><td>Diskon</td><td class="right">-${U.rupiah(p.diskon)}</td></tr>` : ''}
        <tr><td><b>Total</b></td><td class="right"><b>${U.rupiah(p.total)}</b></td></tr>
        <tr><td>Dibayar (${esc(p.metode)})</td><td class="right">${U.rupiah(p.dibayar)}</td></tr>
        ${sisa ? `<tr><td><b>Sisa</b></td><td class="right"><b>${U.rupiah(sisa)}</b></td></tr>` : ''}
      </table></div>
      ${p.catatan ? `<p class="muted">Catatan: ${esc(p.catatan)}</p>` : ''}
      <div class="grid-2 mt">
        <button type="button" class="btn" data-aksi="cetak">🖨️ Cetak Struk</button>
        <button type="button" class="btn" data-aksi="wa" ${p.pelanggan.hp ? '' : 'disabled'}>💬 Kirim WA</button>
        ${sisa ? `<button type="button" class="btn btn-primary" data-aksi="lunas">✅ Tandai Lunas</button>` : ''}
        ${Auth.isOwner() ? `<button type="button" class="btn btn-danger" data-aksi="hapus">🗑️ Hapus</button>` : ''}
      </div>
      <div class="modal-actions">
        <button type="submit" class="btn btn-block" value="tutup">Tutup</button>
      </div>`;

    inner.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-aksi]');
      if (!b) return;
      const aksi = b.dataset.aksi;
      if (aksi === 'cetak') Receipt.cetak(p);
      if (aksi === 'wa') Receipt.kirimWA(p);
      if (aksi === 'lunas') {
        DB.lunasi(p.id, p.total, p.metode);
        modal.close();
        U.toast('Pembayaran dilunasi');
        setelahUbah && setelahUbah();
      }
      if (aksi === 'hapus') {
        modal.close();
        const ya = await U.konfirmasi('Hapus pesanan?', `${p.kode} akan dihapus permanen.`, 'Hapus');
        if (ya) {
          DB.hapusPesanan(p.id);
          U.toast('Pesanan dihapus');
          setelahUbah && setelahUbah();
        }
      }
    });

    modal.showModal();
  }

  /* ================= PELANGGAN ================= */
  function pelanggan(el) {
    let cari = '';

    el.innerHTML = `
      <div class="page-head">
        <div>
          <h1 class="page-title">Pelanggan</h1>
          <p class="page-sub">Gabungan buku pelanggan dan nama yang muncul dari riwayat pesanan.</p>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap">
          ${Auth.isOwner() ? '<button class="btn" id="btnImpor" type="button">⬆️ Impor Daftar</button>' : ''}
          <button class="btn btn-primary" id="btnTambahPel" type="button">+ Tambah</button>
        </div>
      </div>
      <div class="filters">
        <input class="input" id="cariPelanggan" type="search" placeholder="Cari nama atau nomor…">
      </div>
      <div class="stats" id="ringkasPel"></div>
      <div class="card"><div class="table-wrap"><table>
        <thead><tr><th>Nama</th><th>WhatsApp</th><th>Pesanan</th><th>Total Belanja</th><th>Terakhir</th><th class="right">Aksi</th></tr></thead>
        <tbody id="barisPelanggan"></tbody>
      </table></div></div>`;

    const tbody = el.querySelector('#barisPelanggan');

    function gambar() {
      const semua = DB.pelanggan();
      const q = cari.toLowerCase().trim();
      const daftar = !q
        ? semua
        : semua.filter((c) => c.nama.toLowerCase().includes(q) || U.waNomor(c.hp).includes(U.waNomor(q) || q));

      const pernahPesan = semua.filter((c) => c.jumlah > 0).length;
      el.querySelector('#ringkasPel').innerHTML = `
        <div class="stat"><div class="stat-label">Total pelanggan</div><div class="stat-value">${semua.length}</div>
          <div class="stat-note">${pernahPesan} pernah bertransaksi</div></div>
        <div class="stat"><div class="stat-label">Punya nomor WhatsApp</div><div class="stat-value">${semua.filter((c) => c.hp).length}</div>
          <div class="stat-note">bisa dikirimi struk</div></div>`;

      tbody.innerHTML = daftar.length
        ? daftar
            .map(
              (c) => `<tr>
                <td><b>${esc(c.nama)}</b>
                  ${c.jumlah === 0 ? '<span class="pill pill-muted" style="margin-left:6px">Belum pernah</span>' : ''}</td>
                <td>${c.hp ? `<a href="https://wa.me/${U.waNomor(c.hp)}" target="_blank" rel="noopener">${esc(c.hp)}</a>` : '-'}</td>
                <td>${c.jumlah}×</td>
                <td>${U.rupiah(c.belanja)}</td>
                <td>${c.terakhir ? U.tanggal(c.terakhir) : '-'}</td>
                <td class="right" style="white-space:nowrap">
                  ${
                    c.id
                      ? `<button class="btn btn-sm" data-ubah="${c.id}">Ubah</button>
                         <button class="btn btn-sm btn-danger" data-hapus="${c.id}">Hapus</button>`
                      : '<span class="muted" style="font-size:12px">dari riwayat</span>'
                  }
                </td>
              </tr>`
            )
            .join('')
        : `<tr><td colspan="6"><p class="empty">${q ? 'Tidak ada yang cocok.' : 'Belum ada pelanggan.'}</p></td></tr>`;
    }

    function formPelanggan(c) {
      formModal(
        c ? 'Ubah Pelanggan' : 'Tambah Pelanggan',
        `<div class="field"><label>Nama</label>
           <input class="input" name="nama" value="${esc(c?.nama || '')}" placeholder="Contoh: Ibu Sari"></div>
         <div class="field"><label>No. WhatsApp</label>
           <input class="input" name="hp" type="tel" inputmode="numeric" value="${esc(c?.hp || '')}" placeholder="08xxxxxxxxxx"></div>
         <div class="field"><label>Catatan (opsional)</label>
           <input class="input" name="catatan" value="${esc(c?.catatan || '')}" placeholder="Contoh: langganan antar-jemput"></div>`,
        (v) => {
          if (!v.nama.trim() && !v.hp.trim()) return U.toast('Isi minimal nama atau nomor');
          DB.simpanPelanggan({ id: c?.id, nama: v.nama.trim() || 'Tanpa Nama', hp: v.hp, catatan: v.catatan });
          gambar();
          U.toast('Pelanggan tersimpan');
        }
      );
    }

    /* ---- Impor daftar pelanggan ---- */
    function formImpor() {
      const modal = document.getElementById('modal');
      const inner = document.getElementById('modalInner');
      inner.innerHTML = `
        <h3>Impor Daftar Pelanggan</h3>
        <p class="muted" style="margin-top:-6px">
          Tempel dari Excel/WhatsApp, atau pilih berkas CSV hasil ekspor kontak.
          Satu baris satu pelanggan. Nomor yang sudah ada otomatis dilewati.
        </p>
        <div class="field">
          <label class="btn btn-sm btn-block" for="fileKontak">📄 Pilih berkas CSV / TXT</label>
          <input type="file" id="fileKontak" accept=".csv,.txt,text/csv,text/plain" hidden>
        </div>
        <div class="field">
          <label for="teksKontak">Atau tempel di sini</label>
          <textarea class="input" id="teksKontak" style="min-height:150px; font-family:ui-monospace, monospace; font-size:13px"
            placeholder="Nama,No HP&#10;Ibu Sari,081234567890&#10;Pak Budi,0813-1111-2222&#10;Mbak Ani 085700001111"></textarea>
        </div>
        <div id="pratinjauImpor"></div>
        <div class="modal-actions">
          <button type="submit" class="btn" value="batal">Batal</button>
          <button type="button" class="btn btn-primary" id="btnJalankanImpor" disabled>Impor</button>
        </div>`;

      const area = inner.querySelector('#teksKontak');
      const pratinjau = inner.querySelector('#pratinjauImpor');
      const tombol = inner.querySelector('#btnJalankanImpor');
      let hasil = [];

      function periksa() {
        const { data, dilewati } = U.uraiKontak(area.value);
        hasil = data;
        tombol.disabled = data.length === 0;
        if (!area.value.trim()) {
          pratinjau.innerHTML = '';
          return;
        }
        const contoh = data
          .slice(0, 4)
          .map((c) => `<tr><td>${esc(c.nama)}</td><td class="right">${esc(c.hp || '—')}</td></tr>`)
          .join('');
        pratinjau.innerHTML = `
          <div class="card card-pad" style="background:var(--surface-2)">
            <b>${data.length} pelanggan terbaca</b>${dilewati ? ` <span class="muted">(${dilewati} baris dilewati)</span>` : ''}
            ${
              data.length
                ? `<div class="table-wrap mt"><table><tbody>${contoh}</tbody></table></div>
                   ${data.length > 4 ? `<p class="muted" style="margin:6px 0 0">…dan ${data.length - 4} lainnya</p>` : ''}
                   <p class="muted" style="margin:6px 0 0">Periksa dulu: kalau nama dan nomor tertukar, perbaiki teksnya lalu tempel ulang.</p>`
                : '<p class="muted" style="margin:6px 0 0">Belum ada baris yang bisa dibaca.</p>'
            }
          </div>`;
      }

      area.addEventListener('input', periksa);

      inner.querySelector('#fileKontak').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        area.value = await file.text();
        periksa();
      });

      tombol.addEventListener('click', () => {
        const { masuk, dilewati } = DB.imporPelanggan(hasil);
        modal.close();
        gambar();
        U.toast(`${masuk} pelanggan masuk${dilewati ? `, ${dilewati} dilewati karena sudah ada` : ''}`);
      });

      modal.returnValue = 'batal';
      modal.showModal();
    }

    el.querySelector('#btnTambahPel').addEventListener('click', () => formPelanggan(null));
    el.querySelector('#btnImpor')?.addEventListener('click', formImpor);

    el.querySelector('#cariPelanggan').addEventListener('input', (e) => {
      cari = e.target.value;
      gambar();
    });

    tbody.addEventListener('click', async (e) => {
      const ubah = e.target.closest('[data-ubah]');
      const hapus = e.target.closest('[data-hapus]');
      if (ubah) {
        const c = DB.bukuPelanggan().find((x) => x.id === ubah.dataset.ubah);
        formPelanggan(c);
      }
      if (hapus) {
        const c = DB.bukuPelanggan().find((x) => x.id === hapus.dataset.hapus);
        const ya = await U.konfirmasi(
          'Hapus pelanggan?',
          `${c.nama} dihapus dari buku pelanggan. Riwayat pesanannya tidak ikut terhapus.`,
          'Hapus'
        );
        if (ya) {
          DB.hapusPelanggan(c.id);
          gambar();
          U.toast('Pelanggan dihapus');
        }
      }
    });

    gambar();
  }

  /* ============ Rentang waktu untuk laporan ============
     Minggu dihitung Senin–Minggu, sesuai kebiasaan tutup buku mingguan. */
  function rentangWaktu(jenis) {
    const dari = new Date();
    dari.setHours(0, 0, 0, 0);
    const sampai = new Date();
    sampai.setHours(23, 59, 59, 999);

    if (jenis === 'minggu') {
      const geser = (dari.getDay() + 6) % 7; // Senin = 0
      dari.setDate(dari.getDate() - geser);
    } else if (jenis === 'bulan') {
      dari.setDate(1);
    } else if (jenis === 'bulanLalu') {
      dari.setDate(1);
      dari.setMonth(dari.getMonth() - 1);
      sampai.setDate(0); // hari terakhir bulan lalu
      sampai.setHours(23, 59, 59, 999);
    }
    return { dari, sampai };
  }

  const LABEL_RENTANG = {
    hari: 'Hari ini',
    minggu: 'Minggu ini',
    bulan: 'Bulan ini',
    bulanLalu: 'Bulan lalu',
  };

  /* ================= LAPORAN ================= */
  function laporan(el) {
    let jenis = 'bulan';

    el.innerHTML = `
      <div class="page-head">
        <div>
          <h1 class="page-title">Laporan</h1>
          <p class="page-sub">Omzet dikurangi pengeluaran, jadi laba periode berjalan.</p>
        </div>
        <div class="seg" id="segRentang">
          ${Object.entries(LABEL_RENTANG)
            .map(([k, v]) => `<button type="button" data-jenis="${k}" class="${k === jenis ? 'is-active' : ''}">${v}</button>`)
            .join('')}
        </div>
      </div>
      <div id="isiLaporan"></div>`;

    function gambar() {
      const { dari, sampai } = rentangWaktu(jenis);
      const dalamRentang = (iso) => {
        const t = new Date(iso);
        return t >= dari && t <= sampai;
      };

      const daftar = DB.pesanan().filter((p) => dalamRentang(p.dibuat));
      const keluar = DB.pengeluaran().filter((x) => dalamRentang(x.tanggal + 'T12:00:00'));

      const omzet = daftar.reduce((a, p) => a + p.total, 0);
      const terbayar = daftar.reduce((a, p) => a + p.dibayar, 0);
      const piutang = omzet - terbayar;
      const totalKeluar = keluar.reduce((a, x) => a + x.jumlah, 0);
      const laba = omzet - totalKeluar;                 // laba bersih: semua pesanan dihitung
      const labaKotor = terbayar - totalKeluar;         // laba kotor: piutang dikeluarkan dulu
      const belumAmbil = DB.pesanan().filter((p) => p.status !== 'diambil').length;

      const perKategori = new Map();
      for (const x of keluar) perKategori.set(x.kategori, (perKategori.get(x.kategori) || 0) + x.jumlah);
      const kategoriUrut = [...perKategori.entries()].sort((a, b) => b[1] - a[1]);

      const perLayanan = new Map();
      for (const p of daftar) {
        for (const i of p.item) {
          const a = perLayanan.get(i.nama) || { qty: 0, satuan: i.satuan, omzet: 0 };
          a.qty += i.qty;
          a.omzet += i.subtotal;
          perLayanan.set(i.nama, a);
        }
      }
      const topLayanan = [...perLayanan.entries()].sort((a, b) => b[1].omzet - a[1].omzet).slice(0, 8);

      const perHari = new Map();
      for (const p of daftar) {
        const k = U.hariKunci(p.dibuat);
        const a = perHari.get(k) || { jumlah: 0, omzet: 0 };
        a.jumlah += 1;
        a.omzet += p.total;
        perHari.set(k, a);
      }
      const hari = [...perHari.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));

      el.querySelector('#isiLaporan').innerHTML = `
        <p class="muted" style="margin:-6px 0 12px">
          ${esc(LABEL_RENTANG[jenis])}: ${U.tanggal(dari)} – ${U.tanggal(sampai)}
        </p>
        <div class="stats">
          <div class="stat ${laba < 0 ? 'stat-rugi' : 'stat-hero'}">
            <div class="stat-label">${laba < 0 ? 'Rugi bersih' : 'Laba bersih'}</div>
            <div class="stat-value">${U.rupiah(Math.abs(laba))}</div>
            <div class="stat-note">omzet − pengeluaran</div>
          </div>
          <div class="stat ${labaKotor < 0 ? 'stat-rugi' : ''}">
            <div class="stat-label">${labaKotor < 0 ? 'Rugi kotor' : 'Laba kotor'}</div>
            <div class="stat-value">${U.rupiah(Math.abs(labaKotor))}</div>
            <div class="stat-note">setelah dikurangi piutang</div>
          </div>
          <div class="stat"><div class="stat-label">Omzet</div><div class="stat-value">${U.rupiah(omzet)}</div>
            <div class="stat-note">${daftar.length} pesanan</div></div>
          <div class="stat"><div class="stat-label">Pengeluaran</div><div class="stat-value">${U.rupiah(totalKeluar)}</div>
            <div class="stat-note">${keluar.length} catatan</div></div>
          <div class="stat"><div class="stat-label">Belum dibayar</div><div class="stat-value">${U.rupiah(piutang)}</div>
            <div class="stat-note">piutang periode ini</div></div>
          <div class="stat"><div class="stat-label">Cucian belum diambil</div><div class="stat-value">${belumAmbil}</div>
            <div class="stat-note">seluruh periode</div></div>
        </div>

        <div class="card card-pad" style="margin-bottom:16px">
          <b>Bedanya laba bersih dan laba kotor di sini</b>
          <div class="table-wrap mt"><table>
            <tbody>
              <tr><td><b>Laba bersih</b><div class="muted" style="font-size:12px">seluruh pesanan dihitung, termasuk yang belum dibayar</div></td>
                  <td class="right">${U.rupiah(omzet)} − ${U.rupiah(totalKeluar)} = <b>${U.rupiah(laba)}</b></td></tr>
              <tr><td><b>Laba kotor</b><div class="muted" style="font-size:12px">hanya uang yang sudah benar-benar diterima</div></td>
                  <td class="right">${U.rupiah(terbayar)} − ${U.rupiah(totalKeluar)} = <b>${U.rupiah(labaKotor)}</b></td></tr>
              <tr><td>Selisihnya</td>
                  <td class="right">piutang ${U.rupiah(piutang)}</td></tr>
            </tbody>
          </table></div>
          <p class="muted" style="margin-bottom:0">
            Laba bersih memakai nilai semua pesanan yang masuk periode ini, jadi angkanya
            belum tentu ada di laci. Laba kotor memakai uang yang sudah diterima, jadi
            paling dekat dengan kas nyata. Selisih keduanya adalah piutang yang masih
            ditagih. Kalau semua pelanggan sudah bayar, kedua angka ini sama.
          </p>
        </div>

        <div class="row" style="flex-wrap:wrap; align-items:flex-start">
          <div class="card" style="min-width:280px">
            <div class="card-head">Per hari</div>
            <div class="table-wrap"><table>
              <thead><tr><th>Tanggal</th><th>Pesanan</th><th class="right">Omzet</th></tr></thead>
              <tbody>${
                hari.length
                  ? hari.map(([k, v]) => `<tr><td>${U.tanggal(k)}</td><td>${v.jumlah}</td><td class="right">${U.rupiah(v.omzet)}</td></tr>`).join('')
                  : `<tr><td colspan="3"><p class="empty">Belum ada data.</p></td></tr>`
              }</tbody>
            </table></div>
          </div>
          <div class="card" style="min-width:280px">
            <div class="card-head">Layanan terlaris</div>
            <div class="table-wrap"><table>
              <thead><tr><th>Layanan</th><th>Jumlah</th><th class="right">Omzet</th></tr></thead>
              <tbody>${
                topLayanan.length
                  ? topLayanan.map(([nama, v]) => `<tr><td>${esc(nama)}</td><td>${U.angka(v.qty)} ${esc(v.satuan)}</td><td class="right">${U.rupiah(v.omzet)}</td></tr>`).join('')
                  : `<tr><td colspan="3"><p class="empty">Belum ada data.</p></td></tr>`
              }</tbody>
            </table></div>
          </div>

          <div class="card" style="min-width:280px">
            <div class="card-head">
              <span>Pengeluaran per kategori</span>
              <button class="btn btn-sm" id="btnKeLuar" type="button">Catat</button>
            </div>
            <div class="table-wrap"><table>
              <thead><tr><th>Kategori</th><th class="right">Jumlah</th><th class="right">%</th></tr></thead>
              <tbody>${
                kategoriUrut.length
                  ? kategoriUrut
                      .map(
                        ([nama, jml]) => `<tr><td>${esc(nama)}</td><td class="right">${U.rupiah(jml)}</td>
                          <td class="right">${Math.round((jml / totalKeluar) * 100)}%</td></tr>`
                      )
                      .join('')
                  : `<tr><td colspan="3"><p class="empty">Belum ada pengeluaran pada periode ini.</p></td></tr>`
              }</tbody>
            </table></div>
          </div>
        </div>`;

      el.querySelector('#btnKeLuar').addEventListener('click', () => {
        location.hash = 'pengeluaran';
      });
    }

    el.querySelector('#segRentang').addEventListener('click', (e) => {
      const b = e.target.closest('[data-jenis]');
      if (!b) return;
      jenis = b.dataset.jenis;
      el.querySelectorAll('#segRentang button').forEach((x) => x.classList.remove('is-active'));
      b.classList.add('is-active');
      gambar();
    });

    gambar();
  }

  /* ================= PENGELUARAN (khusus owner) ================= */
  function pengeluaran(el) {
    let jenis = 'bulan';

    el.innerHTML = `
      <div class="page-head">
        <div>
          <h1 class="page-title">Pengeluaran</h1>
          <p class="page-sub">Semua uang keluar toko. Langsung terhitung sebagai pengurang laba di Laporan.</p>
        </div>
        <button class="btn btn-primary" id="btnTambahKeluar" type="button">+ Catat Pengeluaran</button>
      </div>
      <div class="filters">
        <div class="seg" id="segPeriode" style="flex:1">
          ${Object.entries(LABEL_RENTANG)
            .map(([k, v]) => `<button type="button" data-jenis="${k}" class="${k === jenis ? 'is-active' : ''}">${v}</button>`)
            .join('')}
          <button type="button" data-jenis="semua">Semua</button>
        </div>
      </div>
      <div class="stats" id="ringkasKeluar"></div>
      <div class="card"><div class="table-wrap"><table>
        <thead><tr><th>Tanggal</th><th>Kategori</th><th>Keterangan</th><th class="right">Jumlah</th><th class="right">Aksi</th></tr></thead>
        <tbody id="barisKeluar"></tbody>
      </table></div></div>`;

    const tbody = el.querySelector('#barisKeluar');

    function terpilih() {
      if (jenis === 'semua') return DB.pengeluaran();
      const { dari, sampai } = rentangWaktu(jenis);
      return DB.pengeluaran().filter((x) => {
        const t = new Date(x.tanggal + 'T12:00:00');
        return t >= dari && t <= sampai;
      });
    }

    function gambar() {
      const daftar = terpilih();
      const total = daftar.reduce((a, x) => a + x.jumlah, 0);

      el.querySelector('#ringkasKeluar').innerHTML = `
        <div class="stat">
          <div class="stat-label">Total ${esc(jenis === 'semua' ? 'seluruhnya' : LABEL_RENTANG[jenis].toLowerCase())}</div>
          <div class="stat-value">${U.rupiah(total)}</div>
          <div class="stat-note">${daftar.length} catatan</div>
        </div>`;

      tbody.innerHTML = daftar.length
        ? daftar
            .map(
              (x) => `<tr>
                <td>${U.tanggal(x.tanggal + 'T12:00:00')}</td>
                <td>${esc(x.kategori)}</td>
                <td>${esc(x.keterangan || '-')}
                  ${x.oleh && x.oleh !== '-' ? `<div class="muted" style="font-size:12px">dicatat ${esc(x.oleh)}</div>` : ''}</td>
                <td class="right">${U.rupiah(x.jumlah)}</td>
                <td class="right" style="white-space:nowrap">
                  <button class="btn btn-sm" data-ubah="${x.id}">Ubah</button>
                  <button class="btn btn-sm btn-danger" data-hapus="${x.id}">Hapus</button>
                </td>
              </tr>`
            )
            .join('')
        : `<tr><td colspan="5"><p class="empty">Belum ada pengeluaran pada periode ini.</p></td></tr>`;
    }

    function formKeluar(x) {
      formModal(
        x ? 'Ubah Pengeluaran' : 'Catat Pengeluaran',
        `<div class="field"><label>Tanggal</label>
           <input class="input" name="tanggal" type="date" value="${esc(x?.tanggal || U.hariIni())}"></div>
         <div class="field"><label>Kategori</label>
           <select class="input" name="kategori">
             ${DB.KATEGORI.map((k) => `<option value="${esc(k)}" ${x?.kategori === k ? 'selected' : ''}>${esc(k)}</option>`).join('')}
           </select></div>
         <div class="field"><label>Keterangan</label>
           <input class="input" name="keterangan" value="${esc(x?.keterangan || '')}" placeholder="Contoh: beli deterjen 5 liter"></div>
         <div class="field"><label>Jumlah (Rp)</label>
           <input class="input" name="jumlah" type="number" inputmode="numeric" min="0" step="500" value="${x?.jumlah ?? ''}"></div>`,
        (v) => {
          const jumlah = Number(v.jumlah) || 0;
          if (!v.tanggal) return U.toast('Tanggal wajib diisi');
          if (jumlah <= 0) return U.toast('Jumlah harus lebih dari nol');
          DB.simpanPengeluaran({
            id: x?.id,
            tanggal: v.tanggal,
            kategori: v.kategori,
            keterangan: v.keterangan,
            jumlah,
            oleh: Auth.aktif()?.nama,
          });
          gambar();
          U.toast('Pengeluaran tersimpan');
        }
      );
    }

    el.querySelector('#btnTambahKeluar').addEventListener('click', () => formKeluar(null));

    el.querySelector('#segPeriode').addEventListener('click', (e) => {
      const b = e.target.closest('[data-jenis]');
      if (!b) return;
      jenis = b.dataset.jenis;
      el.querySelectorAll('#segPeriode button').forEach((y) => y.classList.remove('is-active'));
      b.classList.add('is-active');
      gambar();
    });

    tbody.addEventListener('click', async (e) => {
      const ubah = e.target.closest('[data-ubah]');
      const hapus = e.target.closest('[data-hapus]');
      if (ubah) formKeluar(DB.cariPengeluaran(ubah.dataset.ubah));
      if (hapus) {
        const x = DB.cariPengeluaran(hapus.dataset.hapus);
        const ya = await U.konfirmasi(
          'Hapus pengeluaran?',
          `${x.kategori} ${U.rupiah(x.jumlah)} tanggal ${U.tanggal(x.tanggal + 'T12:00:00')} akan dihapus, dan laba ikut berubah.`,
          'Hapus'
        );
        if (ya) {
          DB.hapusPengeluaran(x.id);
          gambar();
          U.toast('Pengeluaran dihapus');
        }
      }
    });

    gambar();
  }

  /* ================= LAYANAN ================= */
  function layanan(el) {
    el.innerHTML = `
      <div class="page-head">
        <div>
          <h1 class="page-title">Layanan &amp; Harga</h1>
          <p class="page-sub">Ubah harga sesuai tarif laundry Anda.</p>
        </div>
        <button class="btn btn-primary" id="btnTambah" type="button">+ Tambah Layanan</button>
      </div>
      <div class="card"><div class="table-wrap"><table>
        <thead><tr><th>Nama</th><th>Satuan</th><th>Harga</th><th>Estimasi</th><th>Status</th><th class="right">Aksi</th></tr></thead>
        <tbody id="barisLayanan"></tbody>
      </table></div></div>`;

    const tbody = el.querySelector('#barisLayanan');

    function gambar() {
      tbody.innerHTML = DB.layanan()
        .map(
          (l) => `<tr>
            <td><b>${esc(l.nama)}</b></td>
            <td>${esc(l.satuan)}</td>
            <td>${U.rupiah(l.harga)}</td>
            <td>${l.durasi} hari</td>
            <td>${l.aktif === false ? '<span class="pill pill-muted">Nonaktif</span>' : '<span class="pill pill-ok">Aktif</span>'}</td>
            <td class="right" style="white-space:nowrap">
              <button class="btn btn-sm" data-ubah="${l.id}">Ubah</button>
              <button class="btn btn-sm btn-danger" data-hapus="${l.id}">Hapus</button>
            </td>
          </tr>`
        )
        .join('');
    }

    function formLayanan(l) {
      formModal(
        l ? 'Ubah Layanan' : 'Tambah Layanan',
        `<div class="field"><label>Nama layanan</label>
           <input class="input" name="nama" value="${esc(l?.nama || '')}" placeholder="Cuci Setrika"></div>
         <div class="field"><label>Satuan</label>
           <select class="input" name="satuan">
             <option value="kg" ${l?.satuan === 'kg' ? 'selected' : ''}>kg (berat)</option>
             <option value="pcs" ${l?.satuan === 'pcs' ? 'selected' : ''}>pcs (satuan)</option>
           </select></div>
         <div class="field"><label>Harga per satuan (Rp)</label>
           <input class="input" name="harga" type="number" inputmode="numeric" min="0" step="500" value="${l?.harga ?? 0}"></div>
         <div class="field"><label>Estimasi selesai (hari)</label>
           <input class="input" name="durasi" type="number" inputmode="numeric" min="1" value="${l?.durasi ?? 2}"></div>
         <div class="field"><label><input type="checkbox" name="aktif" ${l?.aktif === false ? '' : 'checked'}> Tampilkan di halaman kasir</label></div>`,
        (v) => {
          if (!v.nama.trim()) return U.toast('Nama layanan wajib diisi');
          DB.simpanLayanan({
            id: l?.id,
            nama: v.nama.trim(),
            satuan: v.satuan,
            harga: Number(v.harga) || 0,
            durasi: Math.max(1, Number(v.durasi) || 1),
            aktif: !!v.aktif,
          });
          gambar();
          U.toast('Layanan tersimpan');
        }
      );
    }

    el.querySelector('#btnTambah').addEventListener('click', () => formLayanan(null));

    tbody.addEventListener('click', async (e) => {
      const ubah = e.target.closest('[data-ubah]');
      const hapus = e.target.closest('[data-hapus]');
      if (ubah) formLayanan(DB.cariLayanan(ubah.dataset.ubah));
      if (hapus) {
        const l = DB.cariLayanan(hapus.dataset.hapus);
        const ya = await U.konfirmasi('Hapus layanan?', `"${l.nama}" akan dihapus. Pesanan lama tidak terpengaruh.`, 'Hapus');
        if (ya) {
          DB.hapusLayanan(l.id);
          gambar();
          U.toast('Layanan dihapus');
        }
      }
    });

    gambar();
  }

  /* ================= PENGGUNA (khusus owner) ================= */
  function penggunaAkun(el) {
    el.innerHTML = `
      <div class="page-head">
        <div>
          <h1 class="page-title">Pengguna</h1>
          <p class="page-sub">Akun owner dan pegawai beserta PIN masuknya.</p>
        </div>
        <button class="btn btn-primary" id="btnTambahUser" type="button">+ Tambah Pengguna</button>
      </div>

      <div class="card card-pad" style="margin-bottom:16px; border-left:4px solid var(--warn)">
        <b>Yang perlu diketahui soal PIN ini</b>
        <p class="muted" style="margin-bottom:0">
          PIN mencegah pegawai membuka laporan omzet, mengubah harga, dan menghapus pesanan —
          cukup untuk pemakaian sehari-hari. Namun selama data masih tersimpan di dalam tablet,
          PIN ini <b>bukan keamanan sungguhan</b>: orang yang paham peralatan developer browser
          tetap bisa menembusnya. Keamanan penuh menyusul saat data dipindahkan ke server.
        </p>
      </div>

      <div class="card"><div class="table-wrap"><table>
        <thead><tr><th>Nama</th><th>Peran</th><th>Status</th><th>PIN</th><th class="right">Aksi</th></tr></thead>
        <tbody id="barisUser"></tbody>
      </table></div></div>`;

    const tbody = el.querySelector('#barisUser');

    function gambar() {
      const sedangMasuk = Auth.aktif();
      tbody.innerHTML = DB.pengguna()
        .map(
          (u) => `<tr>
            <td>
              <b>${esc(u.nama)}</b>
              ${u.id === sedangMasuk?.id ? '<span class="pill pill-info" style="margin-left:6px">Anda</span>' : ''}
            </td>
            <td>${u.peran === 'owner' ? 'Owner' : 'Pegawai'}</td>
            <td>${u.aktif === false ? '<span class="pill pill-muted">Nonaktif</span>' : '<span class="pill pill-ok">Aktif</span>'}</td>
            <td>${u.pinBawaan ? '<span class="pill pill-danger">Masih PIN bawaan</span>' : '••••'}</td>
            <td class="right" style="white-space:nowrap">
              <button class="btn btn-sm" data-ubah="${u.id}">Ubah</button>
              <button class="btn btn-sm btn-danger" data-hapus="${u.id}">Hapus</button>
            </td>
          </tr>`
        )
        .join('');
    }

    function formUser(u) {
      formModal(
        u ? `Ubah ${u.nama}` : 'Tambah Pengguna',
        `<div class="field"><label>Nama</label>
           <input class="input" name="nama" value="${esc(u?.nama || '')}" placeholder="Contoh: Rina"></div>
         <div class="field"><label>Peran</label>
           <select class="input" name="peran">
             <option value="pegawai" ${u?.peran === 'owner' ? '' : 'selected'}>Pegawai — Beranda, Kasir, Pesanan, Pelanggan</option>
             <option value="owner" ${u?.peran === 'owner' ? 'selected' : ''}>Owner — semua menu</option>
           </select></div>
         <div class="field"><label>PIN 4–6 angka${u ? ' (kosongkan jika tidak diganti)' : ''}</label>
           <input class="input" name="pin" type="password" inputmode="numeric" autocomplete="new-password"
                  minlength="4" maxlength="6" placeholder="${u ? 'Tidak diubah' : 'Contoh: 4821'}"></div>
         <div class="field"><label><input type="checkbox" name="aktif" ${u?.aktif === false ? '' : 'checked'}> Akun aktif (boleh masuk)</label></div>`,
        (v) => {
          const pin = (v.pin || '').trim();
          if (!v.nama.trim()) return U.toast('Nama wajib diisi');
          if (pin && !/^\d{4,6}$/.test(pin)) return U.toast('PIN harus 4–6 angka');
          if (!u && !pin) return U.toast('PIN wajib diisi untuk pengguna baru');
          try {
            DB.simpanPengguna({ id: u?.id, nama: v.nama.trim(), peran: v.peran, pin: pin || undefined, aktif: !!v.aktif });
            gambar();
            window.SegarkanMenu();
            U.toast('Pengguna tersimpan');
            // Kalau owner menurunkan perannya sendiri, menu ikut menyesuaikan.
            if (u && u.id === Auth.aktif()?.id && v.peran !== 'owner') location.hash = 'beranda';
          } catch (err) {
            U.toast(err.message);
          }
        }
      );
    }

    el.querySelector('#btnTambahUser').addEventListener('click', () => formUser(null));

    tbody.addEventListener('click', async (e) => {
      const ubah = e.target.closest('[data-ubah]');
      const hapus = e.target.closest('[data-hapus]');
      if (ubah) formUser(DB.cariPengguna(ubah.dataset.ubah));
      if (hapus) {
        const u = DB.cariPengguna(hapus.dataset.hapus);
        const diriSendiri = u.id === Auth.aktif()?.id;
        const ya = await U.konfirmasi(
          'Hapus pengguna?',
          `${u.nama} tidak bisa masuk lagi.${diriSendiri ? ' Ini akun Anda sendiri — Anda akan langsung dikeluarkan.' : ''}`,
          'Hapus'
        );
        if (!ya) return;
        try {
          DB.hapusPengguna(u.id);
          if (diriSendiri) {
            Auth.kunci();
            window.MintaMasuk();
            return;
          }
          gambar();
          U.toast('Pengguna dihapus');
        } catch (err) {
          U.toast(err.message);
        }
      }
    });

    gambar();
  }

  /** Kartu status server di halaman Pengaturan: sambungan, kode perangkat,
      dan tombol memindahkan data lama ke server. */
  function gambarKartuServer(el) {
    const kotak = el.querySelector('#kartuServer');
    if (!kotak) return;
    const adaAwan = typeof Awan !== 'undefined' && Awan.tersedia();
    const masuk = adaAwan && Awan.akun();

    kotak.innerHTML = `
      <h3 style="margin-top:0">Server &amp; Perangkat</h3>
      ${
        !adaAwan
          ? '<p class="muted">Versi ini berjalan tanpa server. Data hanya ada di tablet ini.</p>'
          : masuk
            ? `<p class="muted">Tersambung sebagai <b>${esc(masuk.email)}</b>.
                 Data tersimpan di server dan muncul di semua perangkat yang memakai akun ini.</p>
               ${
                 DB.serverSudahSiap()
                   ? ''
                   : `<p class="pill pill-warn" style="display:block">Server masih kosong. Data tablet ini aman dan
                      tidak akan terhapus, tapi belum ikut tersimpan di server. Tekan tombol di bawah untuk
                      memindahkannya sekali.</p>`
               }`
            : '<p class="muted">Belum tersambung ke server.</p>'
      }

      <div class="field">
        <label for="kodeAlat">Kode perangkat</label>
        <div class="row">
          <input class="input" id="kodeAlat" maxlength="2" value="${esc(DB.kodePerangkat())}" style="max-width:90px">
          <button class="btn" id="btnKodeAlat" type="button">Simpan kode</button>
        </div>
        <small class="muted">Masuk ke nomor nota, contoh <b>INV-260816-${esc(DB.kodePerangkat())}001</b>.
        Beri huruf berbeda tiap tablet supaya nomor nota tidak pernah kembar, bahkan saat dua-duanya offline.</small>
      </div>

      ${
        masuk
          ? `<button class="btn btn-block" id="btnPindah" type="button">⬆️ Pindahkan data tablet ini ke server</button>
             <small class="muted">Dipakai sekali saat pertama pindah. Kalau server sudah berisi, aplikasi akan menolak dan meminta konfirmasi.</small>
             <div class="mt"></div>
             <button class="btn btn-danger btn-block" id="btnKeluarToko" type="button">Keluar dari akun toko</button>`
          : ''
      }`;

    kotak.querySelector('#btnKodeAlat').addEventListener('click', () => {
      const nilai = kotak.querySelector('#kodeAlat').value.trim();
      if (!/^[A-Za-z0-9]{1,2}$/.test(nilai)) return U.toast('Kode perangkat 1–2 huruf atau angka');
      DB.kodePerangkat(nilai);
      pengaturan(el);
      U.toast('Kode perangkat disimpan');
    });

    kotak.querySelector('#btnPindah')?.addEventListener('click', async () => {
      const state = DB.seluruhState();
      const jumlah = state.pesanan.length + state.pengeluaran.length + state.pelanggan.length + state.layanan.length;
      let berisi = false;
      try {
        berisi = await Awan.serverBerisi();
      } catch (e) {
        return U.toast('Tidak bisa memeriksa server: ' + e.message);
      }
      const ya = await U.konfirmasi(
        berisi ? 'Server sudah berisi data' : 'Pindahkan data ke server?',
        berisi
          ? `Server sudah punya data. Melanjutkan akan menimpa data server dengan isi tablet ini (${jumlah} catatan). Pastikan ini tablet yang datanya paling lengkap.`
          : `${jumlah} catatan dari tablet ini akan diunggah ke server. Data di tablet tidak dihapus.`,
        berisi ? 'Ya, timpa server' : 'Ya, pindahkan'
      );
      if (!ya) return;
      U.toast('Mengunggah…');
      try {
        const masukJumlah = await Awan.unggahSemua(state);
        // Mulai sekarang server dianggap sudah disiapkan, jadi penghapusan
        // yang sah boleh ikut turun ke tablet lain.
        DB.tandaiServerSiap(true);
        gambarKartuServer(el);
        U.toast(`${masukJumlah} catatan berhasil diunggah`);
      } catch (e) {
        U.toast('Gagal mengunggah: ' + e.message);
      }
    });

    kotak.querySelector('#btnKeluarToko')?.addEventListener('click', async () => {
      const ya = await U.konfirmasi(
        'Keluar dari akun toko?',
        'Tablet ini berhenti tersambung ke server sampai dimasukkan lagi. Data yang sudah terkirim tetap aman di server.',
        'Keluar'
      );
      if (ya) await Awan.keluarToko();
    });
  }

  /** Ingatkan sekali setiap masuk kalau PIN bawaan 1234 belum diganti. */
  function ingatkanPinBawaan() {
    if (DB.layananDipulihkan()) {
      U.toast('Daftar layanan sempat kosong — contoh layanan dipasang kembali, sesuaikan di menu Layanan');
      return;
    }
    const u = Auth.aktif();
    if (u?.pinBawaan) {
      U.toast('PIN Anda masih 1234 — ganti di menu Pengguna');
    }
  }

  /* ================= PENGATURAN ================= */
  function pengaturan(el) {
    const t = DB.toko();
    el.innerHTML = `
      <div class="page-head">
        <div>
          <h1 class="page-title">Pengaturan</h1>
          <p class="page-sub">Identitas toko untuk struk, serta cadangan data.</p>
        </div>
      </div>
      <div class="row" style="flex-wrap:wrap; align-items:flex-start">
        <div class="card card-pad" style="min-width:300px">
          <h3 style="margin-top:0">Data Toko</h3>
          <div class="field"><label>Nama toko</label><input class="input" id="tNama" value="${esc(t.nama)}"></div>
          <div class="field"><label>Alamat</label><input class="input" id="tAlamat" value="${esc(t.alamat)}"></div>
          <div class="field"><label>Telepon</label><input class="input" id="tTelp" value="${esc(t.telp)}"></div>
          <div class="field"><label>Catatan bawah struk</label><textarea class="input" id="tCatatan">${esc(t.catatanStruk)}</textarea></div>
          <div class="field">
            <label for="tLebar">Lebar kertas printer</label>
            <select class="input" id="tLebar">
              <option value="58"${String(t.lebarStruk) !== '80' ? ' selected' : ''}>58 mm (printer kecil)</option>
              <option value="80"${String(t.lebarStruk) === '80' ? ' selected' : ''}>80 mm (printer besar)</option>
            </select>
            <small class="muted">Salah pilih membuat kolom harga terpotong atau tulisan mengecil.
            Ukurannya tertulis di kertas atau kotak printer.</small>
          </div>
          <div class="field">
            <button class="btn btn-block" id="btnTesCetak" type="button">🖨️ Tes cetak struk contoh</button>
            <small class="muted">Mencetak satu struk contoh tanpa membuat pesanan.</small>
          </div>
          <div class="field">
            <label>Logo toko</label>
            <div class="row" style="align-items:center">
              <div style="flex:0 0 auto">
                ${t.logo || Merek.LOGO ? `<img src="${t.logo || Merek.LOGO}" alt="Logo toko" style="width:120px;max-height:64px;object-fit:contain;border:1px solid var(--border);border-radius:10px;padding:4px;background:#fff">` : '<span style="font-size:34px">🧺</span>'}
              </div>
              <div>
                <label class="btn btn-sm btn-block" for="fileLogo">Pilih gambar</label>
                <input type="file" id="fileLogo" accept="image/*" hidden>
                ${t.logo ? '<button class="btn btn-sm btn-danger btn-block mt" id="btnHapusLogo" type="button">Hapus logo</button>' : ''}
              </div>
            </div>
            <small class="muted">Tampil di menu samping, layar masuk, dan struk. Gambar otomatis diperkecil agar hemat penyimpanan.</small>
          </div>
          <button class="btn btn-primary btn-block" id="btnSimpanToko" type="button">Simpan</button>
        </div>

        <div class="card card-pad" style="min-width:300px" id="kartuServer"></div>

        <div class="card card-pad" style="min-width:300px">
          <h3 style="margin-top:0">Cadangan Data</h3>
          <p class="muted">Data tersimpan di dalam tablet ini saja. Rutin buat cadangan agar aman jika tablet rusak atau aplikasi dihapus.</p>
          <button class="btn btn-block" id="btnEkspor" type="button">⬇️ Unduh Cadangan (.json)</button>
          <div class="mt"></div>
          <label class="btn btn-block" for="fileImpor">⬆️ Pulihkan dari Cadangan</label>
          <input type="file" id="fileImpor" accept="application/json,.json" hidden>
          ${(() => {
            const c = DB.infoCadanganOtomatis();
            return c
              ? `<div class="mt"></div>
                 <button class="btn btn-block" id="btnCadanganOtomatis" type="button">↩️ Pulihkan Cadangan Otomatis</button>
                 <small class="muted">Salinan otomatis di tablet ini: <b>${esc(U.tanggalJam(c.waktu))}</b> —
                 ${c.pesanan} pesanan, ${c.pelanggan} pelanggan, ${c.pengeluaran} pengeluaran.</small>`
              : '<small class="muted">Cadangan otomatis dibuat sendiri setiap jam begitu ada transaksi.</small>';
          })()}
          <div class="mt"></div>
          <button class="btn btn-danger btn-block" id="btnReset" type="button">Hapus Semua Data</button>
          <hr style="border:0;border-top:1px solid var(--border);margin:16px 0">
          <h3>Pasang di Layar Utama</h3>
          <p class="muted">Android/Chrome: menu ⋮ → <b>Tambahkan ke layar utama</b>.<br>
          iPad/Safari: tombol Bagikan → <b>Add to Home Screen</b>.<br>
          Setelah dipasang, aplikasi bisa dibuka tanpa internet.</p>
        </div>
      </div>`;

    gambarKartuServer(el);

    el.querySelector('#btnSimpanToko').addEventListener('click', () => {
      DB.simpanToko({
        nama: el.querySelector('#tNama').value.trim() || 'Laundry',
        alamat: el.querySelector('#tAlamat').value.trim(),
        telp: el.querySelector('#tTelp').value.trim(),
        catatanStruk: el.querySelector('#tCatatan').value.trim(),
        lebarStruk: el.querySelector('#tLebar').value,
      });
      window.SegarkanMerek();
      U.toast('Data toko tersimpan');
    });

    el.querySelector('#fileLogo').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        DB.simpanToko({ logo: await U.bacaGambarKecil(file, 320) });
        window.SegarkanMerek();
        pengaturan(el);
        U.toast('Logo tersimpan');
      } catch (err) {
        U.toast('Gagal memuat logo: ' + err.message);
      }
    });

    el.querySelector('#btnHapusLogo')?.addEventListener('click', () => {
      DB.simpanToko({ logo: '' });
      window.SegarkanMerek();
      pengaturan(el);
      U.toast('Logo dihapus');
    });

    el.querySelector('#btnEkspor').addEventListener('click', () => {
      const blob = new Blob([DB.ekspor()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `cadangan-laundry-${U.hariIni()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    });

    el.querySelector('#fileImpor').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        DB.impor(await file.text());
        U.toast('Data berhasil dipulihkan');
        pengaturan(el);
        window.SegarkanMerek();
      } catch (err) {
        U.toast('Gagal memulihkan: ' + err.message);
      }
    });

    /* Tes cetak memakai pilihan yang sedang tampil di layar, bukan yang sudah
       tersimpan — supaya pemilik bisa mencoba 58 dan 80 bergantian sampai pas
       tanpa menyimpan dulu. */
    el.querySelector('#btnTesCetak').addEventListener('click', () => {
      const semula = DB.toko().lebarStruk;
      const dipilih = el.querySelector('#tLebar').value;
      if (dipilih !== semula) DB.simpanToko({ lebarStruk: dipilih });
      Receipt.cetak(Receipt.contoh());
      U.toast(`Mencetak struk contoh ${dipilih} mm`);
    });

    el.querySelector('#btnCadanganOtomatis')?.addEventListener('click', async () => {
      const c = DB.infoCadanganOtomatis();
      const ya = await U.konfirmasi(
        'Pulihkan cadangan otomatis?',
        `Data tablet sekarang akan diganti dengan salinan ${U.tanggalJam(c.waktu)}
         (${c.pesanan} pesanan, ${c.pelanggan} pelanggan, ${c.pengeluaran} pengeluaran).
         Transaksi setelah waktu itu tidak ikut kembali.`,
        'Ya, pulihkan'
      );
      if (!ya) return;
      try {
        DB.pulihkanCadanganOtomatis();
        pengaturan(el);
        window.SegarkanMerek();
        U.toast('Cadangan otomatis dipulihkan');
      } catch (err) {
        U.toast('Gagal memulihkan: ' + err.message);
      }
    });

    el.querySelector('#btnReset').addEventListener('click', async () => {
      const ya = await U.konfirmasi('Hapus semua data?', 'Semua pesanan dan pengaturan akan hilang permanen.', 'Hapus semua');
      if (ya) {
        DB.resetSemua();
        pengaturan(el);
        window.SegarkanMerek();
        U.toast('Data direset');
      }
    });
  }

  return { beranda, kasir, pesanan, pelanggan, laporan, pengeluaran, layanan, penggunaAkun, pengaturan, ingatkanPinBawaan };
})();
