/* Struk: cetak (printer thermal 58 atau 80 mm, atau simpan PDF) dan kirim
   via WhatsApp.

   Ukuran kertas BUKAN hiasan. Sebelumnya struk dipaku ke 80 mm padahal
   keterangan di baris ini sudah menyebut 58 mm juga — jadi di printer 58 mm
   kolom kanan (yang memuat angka rupiah) terpotong atau dikecilkan paksa oleh
   pencetaknya. Sekarang ukurannya mengikuti pengaturan toko.

   Angka 48 mm untuk kertas 58 mm bukan tebakan: printer thermal 58 mm yang
   umum mencetak selebar 384 titik pada 203 dpi, yaitu 48 mm. Sisanya tepi
   yang memang tidak bisa dicetak. */
window.Receipt = (function () {
  const UKURAN = {
    58: { kertas: '58mm', isi: '48mm', tepi: '2mm', teks: 11, judul: 13, total: 13, kecil: 9, logoL: '26mm', logoT: '13mm' },
    80: { kertas: '80mm', isi: '72mm', tepi: '4mm', teks: 12, judul: 15, total: 14, kecil: 10, logoL: '36mm', logoT: '18mm' },
  };

  const ukuran = () => UKURAN[String(DB.toko().lebarStruk) === '80' ? 80 : 58];

  /* Dua bentuk struk untuk dua pembaca yang berbeda:

     - 'pelanggan' : bukti pembayaran. Rincian harga yang menonjol.
     - 'toko'      : label yang menempel di keranjang cucian. Yang dibutuhkan
                     pegawai cuma dua hal dari jarak satu meter — punya siapa
                     dan kapan harus selesai — jadi keduanya dicetak besar dan
                     rincian harga sengaja dikecilkan. */
  function html(p, jenis) {
    return String(jenis) === 'toko' ? htmlToko(p) : htmlPelanggan(p);
  }

  function htmlPelanggan(p) {
    const t = DB.toko();
    const u = ukuran();
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
  @page { size: ${u.kertas} auto; margin: ${u.tepi}; }
  body { font-family: "Courier New", monospace; font-size: ${u.teks}px; color: #000; margin: 0; }
  .wrap { width: ${u.isi}; margin: 0 auto; }
  h1 { font-size: ${u.judul}px; text-align: center; margin: 0 0 2px; }
  .c { text-align: center; }
  .r { text-align: right; }
  .sep { border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 1px 0; vertical-align: top; overflow-wrap: anywhere; }
  td.r { white-space: nowrap; padding-left: 4px; }
  .tot { font-size: ${u.total}px; font-weight: bold; }
  .kecil { font-size: ${u.kecil}px; }
  .logo { display: block; margin: 0 auto 4px; max-width: ${u.logoL}; max-height: ${u.logoT}; }
</style></head><body>
<div class="wrap">
  ${t.logo || Merek.LOGO ? `<img class="logo" src="${t.logo || Merek.LOGO}" alt="">` : ''}
  <h1>${U.esc(t.nama)}</h1>
  <div class="c kecil">${U.esc(t.alamat)}</div>
  <div class="c kecil">${U.esc(t.telp)}</div>
  <div class="sep"></div>
  <table>
    <tr><td>No.</td><td class="r">${U.esc(p.kode)}</td></tr>
    <tr><td>Tanggal</td><td class="r">${U.tanggalJam(p.dibuat)}</td></tr>
    <tr><td>Pelanggan</td><td class="r">${U.esc(p.pelanggan.nama)}</td></tr>
    <tr><td>Estimasi</td><td class="r">${U.estimasi(p.estimasiSelesai)}</td></tr>
    ${p.kasir && p.kasir !== '-' ? `<tr><td>Kasir</td><td class="r">${U.esc(p.kasir)}</td></tr>` : ''}
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

  function htmlToko(p) {
    const t = DB.toko();
    const u = ukuran();
    const baris = p.item
      .map(
        (i) => `<tr><td>${U.esc(i.nama)}</td>
                <td class="r">${U.angka(i.qty)} ${U.esc(i.satuan)}</td></tr>`
      )
      .join('');
    const sisa = Math.max(0, p.total - p.dibayar);

    return `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8">
<title>Label ${U.esc(p.kode)}</title>
<style>
  @page { size: ${u.kertas} auto; margin: ${u.tepi}; }
  body { font-family: "Courier New", monospace; font-size: ${u.teks}px; color: #000; margin: 0; }
  .wrap { width: ${u.isi}; margin: 0 auto; }
  .c { text-align: center; }
  .r { text-align: right; }
  .sep { border-top: 1px dashed #000; margin: 5px 0; }
  .garis-tebal { border-top: 2px solid #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 1px 0; vertical-align: top; overflow-wrap: anywhere; }
  td.r { white-space: nowrap; padding-left: 4px; }
  .label { font-size: ${u.kecil}px; letter-spacing: 1px; }
  .besar { font-size: ${Math.round(u.judul * 1.7)}px; font-weight: bold; line-height: 1.1; overflow-wrap: anywhere; }
  .sedang { font-size: ${Math.round(u.judul * 1.15)}px; font-weight: bold; line-height: 1.2; }
  .kecil { font-size: ${u.kecil}px; }
  .kode { font-size: ${u.total}px; font-weight: bold; }
</style></head><body>
<div class="wrap">
  <div class="c kecil">${U.esc(t.nama)} — LABEL TOKO</div>
  <div class="c kode">${U.esc(p.kode)}</div>
  <div class="garis-tebal"></div>

  <div class="label">PELANGGAN</div>
  <div class="besar">${U.esc(p.pelanggan.nama)}</div>
  ${p.pelanggan.hp ? `<div class="kecil">${U.esc(p.pelanggan.hp)}</div>` : ''}

  <div class="sep"></div>
  <div class="label">SELESAI</div>
  <div class="sedang">${U.esc(U.estimasi(p.estimasiSelesai))}</div>

  <div class="garis-tebal"></div>
  <table>${baris}</table>
  <div class="sep"></div>
  <table>
    <tr><td class="kecil">Masuk</td><td class="r kecil">${U.tanggalJam(p.dibuat)}</td></tr>
    ${p.kasir && p.kasir !== '-' ? `<tr><td class="kecil">Kasir</td><td class="r kecil">${U.esc(p.kasir)}</td></tr>` : ''}
    <tr><td class="kecil">Total</td><td class="r kecil">${U.rupiah(p.total)}</td></tr>
    <tr><td class="kecil"><b>${sisa > 0 ? 'BELUM LUNAS' : 'LUNAS'}</b></td>
        <td class="r kecil"><b>${sisa > 0 ? U.rupiah(sisa) : '—'}</b></td></tr>
  </table>
  ${p.catatan ? `<div class="sep"></div><div class="kecil">Catatan: ${U.esc(p.catatan)}</div>` : ''}
</div>
<script>window.onload = function () { window.print(); }<\/script>
</body></html>`;
  }

  /** Cetak lewat iframe tersembunyi supaya halaman kasir tidak ikut tercetak. */
  function cetak(p, jenis) {
    const lama = document.getElementById('frameStruk');
    if (lama) lama.remove();
    const frame = document.createElement('iframe');
    frame.id = 'frameStruk';
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(frame);
    frame.srcdoc = html(p, jenis);
  }

  /* Mencetak dua struk berurutan. Jeda satu detik disengaja: dialog cetak
     Android hanya memegang satu dokumen pada satu waktu, dan tanpa jeda
     struk kedua menimpa yang pertama sebelum sempat terkirim. */
  function cetakDua(p) {
    cetak(p, 'pelanggan');
    setTimeout(() => cetak(p, 'toko'), 1200);
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
      `Estimasi selesai: ${U.estimasi(p.estimasiSelesai)}\n\n` +
      `Terima kasih 🙏`
    );
  }

  function kirimWA(p) {
    const nomor = U.waNomor(p.pelanggan.hp);
    const url = `https://wa.me/${nomor}?text=${encodeURIComponent(teks(p))}`;
    window.open(url, '_blank', 'noopener');
  }

  /** Pesanan contoh untuk tombol Tes cetak di Pengaturan. Sengaja memakai
      nama dan angka yang panjang, supaya kalau kertasnya kurang lebar
      kelihatan langsung di kertas, bukan nanti saat melayani pelanggan. */
  function contoh() {
    const sekarang = new Date().toISOString();
    return {
      kode: 'CONTOH-' + DB.kodePerangkat() + '001',
      dibuat: sekarang,
      estimasiSelesai: sekarang,
      pelanggan: { nama: 'Contoh Pelanggan', hp: '' },
      item: [
        { nama: 'Cuci Setrika', qty: 3.5, satuan: 'kg', harga: 8000, subtotal: 28000 },
        { nama: 'Bed Cover Ukuran Besar', qty: 2, satuan: 'pcs', harga: 25000, subtotal: 50000 },
      ],
      subtotal: 78000,
      diskon: 3000,
      total: 75000,
      dibayar: 75000,
      diterima: 100000,
      metode: 'tunai',
      kasir: 'Tes Printer',
      catatan: 'Ini struk contoh untuk menguji printer.',
    };
  }

  return { cetak, cetakDua, teks, kirimWA, html, contoh };
})();
