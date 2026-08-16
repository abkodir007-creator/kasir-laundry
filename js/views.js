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
              <input class="input" id="inpNama" placeholder="Contoh: Ibu Sari">
            </div>
            <div class="field" style="margin-bottom:0">
              <label for="inpHp">No. WhatsApp (opsional)</label>
              <input class="input" id="inpHp" type="tel" inputmode="numeric" placeholder="08xxxxxxxxxx">
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
    const daftar = DB.pelanggan();
    el.innerHTML = `
      <div class="page-head">
        <div>
          <h1 class="page-title">Pelanggan</h1>
          <p class="page-sub">Otomatis terkumpul dari riwayat pesanan.</p>
        </div>
      </div>
      <div class="card"><div class="table-wrap"><table>
        <thead><tr><th>Nama</th><th>WhatsApp</th><th>Pesanan</th><th>Total Belanja</th><th>Terakhir</th></tr></thead>
        <tbody>
          ${
            daftar.length
              ? daftar
                  .map(
                    (c) => `<tr>
                      <td><b>${esc(c.nama)}</b></td>
                      <td>${c.hp ? `<a href="https://wa.me/${U.waNomor(c.hp)}" target="_blank" rel="noopener">${esc(c.hp)}</a>` : '-'}</td>
                      <td>${c.jumlah}×</td>
                      <td>${U.rupiah(c.belanja)}</td>
                      <td>${U.tanggal(c.terakhir)}</td>
                    </tr>`
                  )
                  .join('')
              : `<tr><td colspan="5"><p class="empty">Belum ada pelanggan.</p></td></tr>`
          }
        </tbody>
      </table></div></div>`;
  }

  /* ================= LAPORAN ================= */
  function laporan(el) {
    let rentang = 7;

    el.innerHTML = `
      <div class="page-head">
        <div>
          <h1 class="page-title">Laporan</h1>
          <p class="page-sub">Ringkasan omzet dan layanan terlaris.</p>
        </div>
        <div class="seg" id="segRentang">
          <button type="button" data-hari="1">Hari ini</button>
          <button type="button" data-hari="7" class="is-active">7 hari</button>
          <button type="button" data-hari="30">30 hari</button>
        </div>
      </div>
      <div id="isiLaporan"></div>`;

    function gambar() {
      const batas = new Date();
      batas.setHours(0, 0, 0, 0);
      batas.setDate(batas.getDate() - (rentang - 1));
      const daftar = DB.pesanan().filter((p) => new Date(p.dibuat) >= batas);

      const omzet = daftar.reduce((a, p) => a + p.total, 0);
      const terbayar = daftar.reduce((a, p) => a + p.dibayar, 0);
      const piutang = omzet - terbayar;
      const belumAmbil = DB.pesanan().filter((p) => p.status !== 'diambil').length;

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
        <div class="stats">
          <div class="stat"><div class="stat-label">Omzet</div><div class="stat-value">${U.rupiah(omzet)}</div></div>
          <div class="stat"><div class="stat-label">Jumlah pesanan</div><div class="stat-value">${daftar.length}</div></div>
          <div class="stat"><div class="stat-label">Belum dibayar</div><div class="stat-value">${U.rupiah(piutang)}</div></div>
          <div class="stat"><div class="stat-label">Cucian belum diambil</div><div class="stat-value">${belumAmbil}</div></div>
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
        </div>`;
    }

    el.querySelector('#segRentang').addEventListener('click', (e) => {
      const b = e.target.closest('[data-hari]');
      if (!b) return;
      rentang = +b.dataset.hari;
      el.querySelectorAll('#segRentang button').forEach((x) => x.classList.remove('is-active'));
      b.classList.add('is-active');
      gambar();
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
             <option value="pegawai" ${u?.peran === 'owner' ? '' : 'selected'}>Pegawai — Kasir, Pesanan, Pelanggan</option>
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
            if (u && u.id === Auth.aktif()?.id && v.peran !== 'owner') location.hash = 'kasir';
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

  /** Ingatkan sekali setiap masuk kalau PIN bawaan 1234 belum diganti. */
  function ingatkanPinBawaan() {
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
          <button class="btn btn-primary btn-block" id="btnSimpanToko" type="button">Simpan</button>
        </div>

        <div class="card card-pad" style="min-width:300px">
          <h3 style="margin-top:0">Cadangan Data</h3>
          <p class="muted">Data tersimpan di dalam tablet ini saja. Rutin buat cadangan agar aman jika tablet rusak atau aplikasi dihapus.</p>
          <button class="btn btn-block" id="btnEkspor" type="button">⬇️ Unduh Cadangan (.json)</button>
          <div class="mt"></div>
          <label class="btn btn-block" for="fileImpor">⬆️ Pulihkan dari Cadangan</label>
          <input type="file" id="fileImpor" accept="application/json,.json" hidden>
          <div class="mt"></div>
          <button class="btn btn-danger btn-block" id="btnReset" type="button">Hapus Semua Data</button>
          <hr style="border:0;border-top:1px solid var(--border);margin:16px 0">
          <h3>Pasang di Layar Utama</h3>
          <p class="muted">Android/Chrome: menu ⋮ → <b>Tambahkan ke layar utama</b>.<br>
          iPad/Safari: tombol Bagikan → <b>Add to Home Screen</b>.<br>
          Setelah dipasang, aplikasi bisa dibuka tanpa internet.</p>
        </div>
      </div>`;

    el.querySelector('#btnSimpanToko').addEventListener('click', () => {
      DB.simpanToko({
        nama: el.querySelector('#tNama').value.trim() || 'Laundry',
        alamat: el.querySelector('#tAlamat').value.trim(),
        telp: el.querySelector('#tTelp').value.trim(),
        catatanStruk: el.querySelector('#tCatatan').value.trim(),
      });
      document.getElementById('brandName').textContent = DB.toko().nama;
      U.toast('Data toko tersimpan');
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
        document.getElementById('brandName').textContent = DB.toko().nama;
      } catch (err) {
        U.toast('Gagal memulihkan: ' + err.message);
      }
    });

    el.querySelector('#btnReset').addEventListener('click', async () => {
      const ya = await U.konfirmasi('Hapus semua data?', 'Semua pesanan dan pengaturan akan hilang permanen.', 'Hapus semua');
      if (ya) {
        DB.resetSemua();
        pengaturan(el);
        document.getElementById('brandName').textContent = DB.toko().nama;
        U.toast('Data direset');
      }
    });
  }

  return { kasir, pesanan, pelanggan, laporan, layanan, penggunaAkun, pengaturan, ingatkanPinBawaan };
})();
