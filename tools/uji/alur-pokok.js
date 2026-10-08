/* Alur pokok kasir, supaya perubahan besar tidak diam-diam merusaknya:
   pilih layanan, estimasi, pembulatan manual, bayar nanti, lalu pelunasan
   dengan cara bayar yang ditentukan saat uangnya diterima. */
const { buka, buatLayanan, keKasir, tambahKeKeranjang, lapor } = require('./bantu');

(async () => {
  const { browser, page, salah } = await buka();

  await buatLayanan(page, 'Cuci Komplit', 7000);
  await keKasir(page);
  await page.click('#segEstimasi [data-jam="24"]');
  await page.waitForTimeout(200);
  await tambahKeKeranjang(page, 'Cuci Komplit', 3.4);
  await page.fill('#inpNama', 'Bu Rina');
  await page.dispatchEvent('#inpNama', 'input');
  await page.waitForTimeout(250);
  console.log('1. subtotal:', (await page.textContent('#sumSubtotal')).trim());

  console.log('2. saran pembulatan:', await page.$$eval('#saranBulat button', (b) => b.map((x) => x.textContent.trim()).join(' | ')));
  await page.fill('#inpBulat', '23500');
  await page.dispatchEvent('#inpBulat', 'input');
  console.log('   dibulatkan kasir:', (await page.textContent('#sumBulat')).trim(), '→', (await page.textContent('#sumTotal')).trim());

  await page.fill('#inpBulat', '2400');
  await page.dispatchEvent('#inpBulat', 'input');
  console.log('3. salah ketik ditolak:', await page.isDisabled('#btnSimpan'), '|', (await page.textContent('#pesanBulat')).trim().slice(0, 48));
  await page.fill('#inpBulat', '23500');
  await page.dispatchEvent('#inpBulat', 'input');

  await page.click('#segMetode [data-metode="nanti"]');
  await page.waitForTimeout(200);
  console.log('4. bayar nanti → kolom uang terkunci:', await page.isDisabled('#inpBayar'));

  await page.click('#btnSimpan');
  await page.waitForTimeout(600);
  console.log('5. tersimpan:', await page.evaluate(() => {
    const p = DB.pesanan()[0];
    return `total ${p.total}, pembulatan ${p.pembulatan}, metode ${p.metode}, lunas ${p.lunas}`;
  }));
  await page.click('#modalSukses button[value="tutup"]');
  await page.waitForTimeout(300);

  await page.click('.nav-item[data-view="pesanan"]');
  await page.waitForSelector('#barisPesanan tr');
  console.log('6. kolom bayar:', (await page.textContent('#barisPesanan tr td:nth-child(4)')).trim());
  await page.click('#barisPesanan [data-bayar]');
  await page.waitForSelector('#modalBayar[open]');
  await page.click('#bayarMetode [data-metode="qris"]');
  await page.click('#modalBayar [data-aksi="terima"]');
  await page.waitForTimeout(500);
  console.log('7. dilunasi QRIS:', await page.evaluate(() => {
    const p = DB.pesanan()[0];
    return `metode ${p.metode}, dibayar ${p.dibayar}, lunas ${p.lunas}`;
  }));

  await page.click('.nav-item[data-view="laporan"]');
  await page.waitForSelector('.stat');
  console.log('8. laporan:', await page.evaluate(() =>
    [...document.querySelectorAll('.stat')]
      .map((s) => `${s.querySelector('.stat-label').textContent.trim()}=${s.querySelector('.stat-value').textContent.trim()}`)
      .filter((t) => /tunai/i.test(t)).join(' | ')));

  const ok = lapor(salah);
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
