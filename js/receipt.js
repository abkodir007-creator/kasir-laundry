/* Struk: cetak (printer thermal 58/80mm atau simpan PDF) dan kirim via WhatsApp. */
window.Receipt = (function () {
  function html(p) {
    const t = DB.toko();
    const baris = p.item
      .map(
        (i) => `
        <tr>
          <td colspan="2">${U.esc(i.nama)}</td>
        </tr>
        <tr>
          <td>${U.angka(i.qty)} ${U.esc(i.satuan)} x ${U.rupiah(i.harga)}</td>
          <td class="r">${U.rupiah(i.subtotal)}</td>
        </tr>`
      )
      .join('');

    const sisa = Math.max(0, p.total - p.dibayar);
    const diterima = Math.max(p.diterima || 0, p.dibayar);

    return `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8">
<title>Struk ${U.esc(p.kode)}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  body { font-family: "Courier New", monospace; font-size: 12px; color: #000; margin: 0; }
  .wrap { width: 72mm; margin: 0 auto; }
  h1 { font-size: 15px; text-align: center; margin: 0 0 2px; }
  .c { text-align: center; }
  .r { text-align: right; }
  .sep { border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 1px 0; vertical-align: top; }
  .tot { font-size: 14px; font-weight: bold; }
  .kecil { font-size: 10px; }
</style></head><body>
<div class="wrap">
  <h1>${U.esc(t.nama)}</h1>
  <div class="c kecil">${U.esc(t.alamat)}</div>
  <div class="c kecil">${U.esc(t.telp)}</div>
  <div class="sep"></div>
  <table>
    <tr><td>No.</td><td class="r">${U.esc(p.kode)}</td></tr>
    <tr><td>Tanggal</td><td class="r">${U.tanggalJam(p.dibuat)}</td></tr>
    <tr><td>Pelanggan</td><td class="r">${U.esc(p.pelanggan.nama)}</td></tr>
    <tr><td>Estimasi</td><td class="r">${U.tanggal(p.estimasiSelesai)}</td></tr>
  </table>
  <div class="sep"></div>
  <table>${baris}</table>
  <div class="sep"></div>
  <table>
    <tr><td>Subtotal</td><td class="r">${U.rupiah(p.subtotal)}</td></tr>
    ${p.diskon ? `<tr><td>Diskon</td><td class="r">-${U.rupiah(p.diskon)}</td></tr>` : ''}
    <tr class="tot"><td>TOTAL</td><td class="r">${U.rupiah(p.total)}</td></tr>
    <tr><td>Bayar (${U.esc(p.metode)})</td><td class="r">${U.rupiah(diterima)}</td></tr>
    ${
      sisa > 0
        ? `<tr><td>SISA</td><td class="r">${U.rupiah(sisa)}</td></tr>`
        : `<tr><td>Kembali</td><td class="r">${U.rupiah(diterima - p.total)}</td></tr>`
    }
  </table>
  ${p.catatan ? `<div class="sep"></div><div class="kecil">Catatan: ${U.esc(p.catatan)}</div>` : ''}
  <div class="sep"></div>
  <div class="c kecil">${U.esc(t.catatanStruk)}</div>
  <div class="c kecil">Simpan struk ini sebagai bukti pengambilan</div>
</div>
<script>window.onload = function () { window.print(); }<\/script>
</body></html>`;
  }

  /** Cetak lewat iframe tersembunyi supaya halaman kasir tidak ikut tercetak. */
  function cetak(p) {
    const lama = document.getElementById('frameStruk');
    if (lama) lama.remove();
    const frame = document.createElement('iframe');
    frame.id = 'frameStruk';
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(frame);
    frame.srcdoc = html(p);
  }

  function teks(p) {
    const t = DB.toko();
    const item = p.item.map((i) => `• ${i.nama} ${U.angka(i.qty)} ${i.satuan} = ${U.rupiah(i.subtotal)}`).join('\n');
    const sisa = Math.max(0, p.total - p.dibayar);
    return (
      `*${t.nama}*\n` +
      `Nota: ${p.kode}\n` +
      `Tanggal: ${U.tanggalJam(p.dibuat)}\n` +
      `Pelanggan: ${p.pelanggan.nama}\n\n` +
      `${item}\n\n` +
      (p.diskon ? `Diskon: -${U.rupiah(p.diskon)}\n` : '') +
      `*Total: ${U.rupiah(p.total)}*\n` +
      (sisa > 0 ? `Sisa bayar: ${U.rupiah(sisa)}\n` : `Status: LUNAS\n`) +
      `Estimasi selesai: ${U.tanggal(p.estimasiSelesai)}\n\n` +
      `Terima kasih 🙏`
    );
  }

  function kirimWA(p) {
    const nomor = U.waNomor(p.pelanggan.hp);
    const url = `https://wa.me/${nomor}?text=${encodeURIComponent(teks(p))}`;
    window.open(url, '_blank', 'noopener');
  }

  return { cetak, teks, kirimWA, html };
})();
