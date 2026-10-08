/* Jalankan seluruh rangkaian uji berurutan. Keluar dengan kode bukan nol
   begitu ada satu yang gagal, supaya tidak ada kegagalan yang terlewat di
   tengah keluaran yang panjang. */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const lewati = new Set(['bantu.js', 'jalankan.js']);
const berkas = fs.readdirSync(dir).filter((f) => f.endsWith('.js') && !lewati.has(f)).sort();

let gagal = 0;
for (const f of berkas) {
  console.log(`\n===== ${f} =====`);
  try {
    execFileSync(process.execPath, [path.join(dir, f)], { stdio: 'inherit', timeout: 180000 });
  } catch (e) {
    gagal += 1;
    console.log(`----- ${f} GAGAL -----`);
  }
}
console.log(`\n${berkas.length - gagal}/${berkas.length} rangkaian lolos`);
process.exit(gagal ? 1 : 0);
