/* Satu nota, beberapa waktu pengerjaan.

   Sebelumnya satu nota hanya boleh satu kecepatan, dan pelanggan yang
   menitipkan selimut reguler sekaligus seragam kilat harus dibuatkan dua
   nota terpisah — dua nomor, dua struk, dua kali antre. */
const { buka, buatLayanan, keKasir, tambahKeKeranjang, lapor } = require('./bantu');

(async () => {
  const { browser, page, salah } = await buka();

  await buatLayanan(page, 'Cuci Setrika', 7000);
  await buatLayanan(page, 'Bed Cover', 25000);
  await keKasir(page);

  // Pilihan di bawah keranjang menentukan semua baris sekaligus.
  await page.click('#segEstimasi [data-jam="72"]');
  await page.waitForTimeout(200);
  await tambahKeKeranjang(page, 'Cuci Setrika', 3);
  await tambahKeKeranjang(page, 'Bed Cover', 1);
  await page.fill('#inpNama', 'Bu Rina');
  await page.dispatchEvent('#inpNama', 'input');
  await page.waitForTimeout(250);

  const estPerBaris = () => page.$$eval('[data-est]', (s) => s.map((x) => x.selectedOptions[0].textContent.trim()));
  console.log('1. seluruh baris mengikuti pilihan bawah:', (await estPerBaris()).join(' | '));
  console.log('   keterangan:', (await page.textContent('#infoEstimasi')).trim());

  // Baris pertama diubah jadi kilat; baris lain tidak ikut berubah.
  const idKilat = await page.evaluate(() => DB.kategori().find((k) => k.jam === 6).id);
  await page.selectOption('[data-est="0"]', idKilat);
  await page.waitForTimeout(300);
  console.log('2. baris pertama diubah jadi kilat:', (await estPerBaris()).join(' | '));
  console.log('   keterangan:', (await page.textContent('#infoEstimasi')).trim());
  console.log('   total tetap terhitung:', (await page.textContent('#sumTotal')).trim());

  await page.click('#btnSimpan');
  await page.waitForTimeout(600);
  const nota = await page.evaluate(() => {
    const p = DB.pesanan()[0];
    const jam = (iso) => new Date(iso).toISOString().slice(0, 16);
    return {
      baris: p.item.map((i) => `${i.nama}: ${i.jam} jam, selesai ${jam(i.estimasiSelesai)}`),
      notaJam: p.jamPengerjaan,
      notaSelesai: jam(p.estimasiSelesai),
      nama: p.estimasiNama,
      campuran: p.estimasiCampuran,
      sesuaiPalingLama: jam(p.estimasiSelesai) === jam(p.item.map((i) => i.estimasiSelesai).sort().at(-1)),
    };
  });
  console.log('3. tersimpan per baris:', nota.baris.join(' || '));
  console.log('   nota: ' + nota.notaJam + ' jam, siap ' + nota.notaSelesai + ', nama "' + nota.nama + '", campuran ' + nota.campuran);
  console.log('   janji nota = baris paling lama:', nota.sesuaiPalingLama);
  console.log('4. panel berhasil:', (await page.textContent('.sukses-rincian')).replace(/\s+/g, ' ').trim());

  const cetak = await page.evaluate(() => {
    const p = DB.pesanan()[0];
    const pel = Receipt.html(p, 'pelanggan').replace(/\s+/g, ' ');
    const tok = Receipt.html(p, 'toko').replace(/\s+/g, ' ');
    return {
      jadwalPerBaris: (pel.match(/selesai [^<]+/g) || []).length,
      kepalaStruk: (pel.match(/<td>(Semua siap|Estimasi)<\/td>\s*<td class="r">([^<]*)/) || []).slice(1).join(' '),
      labelJudul: (tok.match(/class="label">(TENGGAT TERDEKAT|SELESAI[^<]*)</) || [])[1],
      labelTenggat: (tok.match(/class="sedang">([^<]*)/) || [])[1],
      labelCatatan: (tok.match(/Semua siap [^<]*/) || [])[0],
      labelPerBarang: (tok.match(/⏱ [^<]+/g) || []).length,
      wa: Receipt.teks(p).split('\n').filter((b) => /selesai|Semua siap/i.test(b)),
    };
  });
  console.log('5. struk pelanggan: ' + cetak.jadwalPerBaris + ' baris berjadwal, kepala "' + cetak.kepalaStruk + '"');
  console.log('6. label toko: judul "' + cetak.labelJudul + '", tenggat ' + cetak.labelTenggat);
  console.log('   catatan: ' + cetak.labelCatatan + ' | jadwal per barang: ' + cetak.labelPerBarang);
  console.log('7. WhatsApp:', cetak.wa.map((b) => b.trim()).join(' || '));

  await page.click('#modalSukses button[value="tutup"]');
  await page.waitForTimeout(300);
  await page.click('.nav-item[data-view="pesanan"]');
  await page.waitForSelector('#barisPesanan tr');
  await page.click('#barisPesanan [data-detail]');
  await page.waitForSelector('#modalInner');
  const detail = (await page.textContent('#modalInner')).replace(/\s+/g, ' ');
  console.log('8. rincian pesanan:', (detail.match(/• selesai [^×]*/g) || ['(tidak ada)']).map((x) => x.trim()).join(' || '));

  const ok = lapor(salah);
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
