/* Menggabungkan seluruh aplikasi menjadi satu berkas HTML.
   Berguna untuk: dibuka langsung dari tablet, dikirim lewat WhatsApp/Drive,
   atau diunggah ke layanan hosting mana pun.

   Jalankan:  node tools/build-single.js
   Hasil:     dist/kasir-laundry.html  (berkas mandiri, bisa dibuka langsung)
              dist/artifact.html       (potongan untuk Claude Artifact — tanpa tag html/head/body)
*/
const fs = require('fs');
const path = require('path');

const AKAR = path.join(__dirname, '..');
const baca = (p) => fs.readFileSync(path.join(AKAR, p), 'utf8');

const css = baca('assets/styles.css');
const js = ['js/merek.js', 'js/utils.js', 'js/auth.js', 'js/db.js', 'js/receipt.js', 'js/views.js', 'js/app.js'].map(baca).join('\n');
const ikon = baca('assets/icon.svg');
const ikonData = 'data:image/svg+xml;base64,' + Buffer.from(ikon).toString('base64');

const html = baca('index.html');
const badan = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>')).replace(/\s*<script src="[^"]*"><\/script>/g, '');

const kepala = `<title>Kasir StarWash Laundry</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no">
<meta name="theme-color" content="#0D1B3D">
<link rel="icon" href="${ikonData}" type="image/svg+xml">
<link rel="apple-touch-icon" href="${ikonData}">
<meta name="apple-mobile-web-app-capable" content="yes">
<style>
${css}
</style>`;

const skrip = `<script>
// Versi satu berkas: tidak ada sw.js terpisah, jadi pendaftaran service worker dilewati.
window.BERKAS_TUNGGAL = true;
${js}
</script>`;

// Artifact dibungkus otomatis oleh Claude, jadi cukup kirim isinya saja.
const isi = `${kepala}\n${badan}\n${skrip}`;

const mandiri = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
${kepala}
</head>
<body>
${badan}
${skrip}
</body>
</html>
`;

fs.mkdirSync(path.join(AKAR, 'dist'), { recursive: true });
fs.writeFileSync(path.join(AKAR, 'dist/kasir-laundry.html'), mandiri);
fs.writeFileSync(path.join(AKAR, 'dist/artifact.html'), isi + '\n');

const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(1) + ' KB';
console.log('dist/kasir-laundry.html', kb(mandiri));
console.log('dist/artifact.html     ', kb(isi));
