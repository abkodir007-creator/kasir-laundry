/* Perkakas bersama untuk rangkaian uji. */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const ALAMAT = process.env.UJI_ALAMAT || 'http://127.0.0.1:8099/index.html?lokal=1';

async function buka(opsi = {}) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: opsi.viewport || { width: 1280, height: 1000 } });
  const salah = [];
  page.on('pageerror', (e) => salah.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') salah.push('console: ' + m.text());
  });
  // Dialog cetak dan jendela WhatsApp dicatat, bukan dijalankan.
  await page.addInitScript(() => {
    window.__wa = [];
    window.print = () => {};
    window.open = (u) => (window.__wa.push(u), null);
  });
  await page.goto(ALAMAT);
  await page.waitForSelector('#layarMasuk .masuk');
  for (const d of '1234') await page.click(`[data-angka="${d}"]`);
  await page.click('[data-aksi="masuk"]');
  await page.waitForSelector('.stats');
  return { browser, page, salah };
}

/** Buat layanan dengan satu harga untuk semua kecepatan. */
async function buatLayanan(page, nama, harga) {
  await page.click('.nav-item[data-view="layanan"]');
  await page.waitForSelector('#btnTambah');
  await page.click('#btnTambah');
  await page.fill('input[name="nama"]', nama);
  await page.fill('input[name="harga"]', String(harga));
  await page.click('dialog[open] button[value="simpan"]');
  await page.waitForTimeout(250);
}

async function keKasir(page) {
  await page.click('.nav-item[data-view="kasir"]');
  await page.waitForSelector('#svcGrid .svc');
}

async function tambahKeKeranjang(page, nama, qty) {
  await page.click(`.svc:has-text("${nama}")`);
  await page.waitForTimeout(250);
  const idx = await page.evaluate((n) => {
    const judul = [...document.querySelectorAll('.cart-item-top span:first-child')];
    return judul.findIndex((s) => s.textContent.trim() === n);
  }, nama);
  await page.fill(`[data-qty="${idx}"]`, String(qty));
  await page.dispatchEvent(`[data-qty="${idx}"]`, 'change');
  return idx;
}

function lapor(salah) {
  console.log(salah.length ? 'ERRORS:\n' + salah.join('\n') : 'tidak ada error konsol');
  return salah.length === 0;
}

module.exports = { buka, buatLayanan, keKasir, tambahKeKeranjang, lapor, ALAMAT };
