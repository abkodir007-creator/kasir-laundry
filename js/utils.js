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

  const toast = (pesan) => {
    const el = document.getElementById('toast');
    el.textContent = pesan;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 2200);
  };

  /** Modal konfirmasi berbasis <dialog>, mengembalikan Promise<boolean>. */
  const konfirmasi = (judul, pesan, labelYa = 'Ya, lanjutkan') =>
    new Promise((resolve) => {
      const modal = document.getElementById('modal');
      const inner = document.getElementById('modalInner');
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

  return { rupiah, angka, tanggal, jam, tanggalJam, hariKunci, hariIni, tambahHari, idBaru, esc, waNomor, toast, konfirmasi };
})();
