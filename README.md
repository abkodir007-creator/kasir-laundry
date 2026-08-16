# Kasir Laundry 🧺

Aplikasi kasir (POS) untuk usaha laundry. Dibuat sebagai **web app** biasa —
HTML + CSS + JavaScript tanpa proses build, tanpa server, tanpa database.
Cukup dibuka di browser tablet, dan bisa dipakai **tanpa internet**.

**Alamat aplikasi:** https://abkodir007-creator.github.io/kasir-laundry/

---

## Jawaban singkat: bisakah dikerjakan dari tablet, bukan komputer?

**Bisa.** Ada dua hal berbeda yang sering tertukar, dan keduanya bisa lewat tablet:

| | Bisa di tablet? | Caranya |
|---|---|---|
| **Memakai** aplikasi kasir | ✅ Ya, sangat cocok | Buka alamat webnya di Chrome/Safari, lalu "Tambahkan ke layar utama" |
| **Membuat/mengubah** kode aplikasi | ✅ Ya | Lewat browser: Claude Code di web (claude.ai/code) atau github.dev — tidak perlu memasang apa pun |

Yang **tidak** praktis di tablet adalah cara pengembangan tradisional: memasang
Node.js, VS Code desktop, emulator Android, atau Android Studio. Android/iPadOS
mengunci akses semacam itu. Solusinya: kerjakan kode di cloud dan biarkan tablet
hanya jadi **layar** — itulah sebabnya aplikasi ini dibuat sebagai web app, bukan
aplikasi Android native yang harus dikompilasi.

Konsekuensinya (jujur di depan):
- Aplikasi web tidak bisa langsung mencetak ke printer thermal Bluetooth tanpa
  perantara. Cetak dilakukan lewat dialog print sistem (bisa ke printer WiFi,
  atau simpan PDF), atau kirim struk lewat WhatsApp. Untuk printer thermal
  Bluetooth, umumnya dipakai aplikasi jembatan seperti "RawBT" di Android.
- Data disimpan di dalam tablet itu sendiri, bukan di server. Kalau ingin satu
  data dipakai banyak perangkat, perlu tahap lanjutan (lihat "Rencana lanjutan").

---

## Cara memakai di tablet

### 1. Buka alamatnya dan pasang ke layar utama

https://abkodir007-creator.github.io/kasir-laundry/

- **Android / Chrome:** buka alamat di atas → menu ⋮ → **Tambahkan ke layar utama**
- **iPad / Safari:** tombol Bagikan → **Add to Home Screen**

Ikonnya akan muncul seperti aplikasi biasa, tampil layar penuh tanpa address bar.
Setelah dibuka sekali, aplikasi tetap jalan walau tablet sedang tanpa internet.

### 2. Isi data toko dan harga

Buka menu **Pengaturan** → isi nama toko, alamat, telepon (dipakai di struk).
Lalu menu **Layanan** → sesuaikan daftar layanan dan harga dengan tarif Anda.
Harga bawaan hanya contoh.

### Tanpa internet sama sekali: versi satu berkas

Seluruh aplikasi juga tersedia sebagai **satu berkas HTML** (±56 KB) yang bisa
disimpan di tablet, dikirim lewat WhatsApp, atau ditaruh di Google Drive:

https://abkodir007-creator.github.io/kasir-laundry/dist/kasir-laundry.html

Berkas itu tidak disimpan di repositori karena merupakan hasil build. Untuk
membuatnya sendiri:

```bash
node tools/build-single.js
```

---

## Fitur

- **Kasir** — kartu layanan tinggal diketuk, jumlah dalam kg (bisa 0,5 kg) atau
  pcs, diskon, metode bayar (tunai/transfer/QRIS), hitung kembalian, dan
  pesanan "bayar nanti" saat pengambilan.
- **Pesanan** — alur status Diterima → Dicuci → Siap Diambil → Selesai, dengan
  pencarian nota/nama/HP. Pesanan tidak bisa ditandai selesai selama belum lunas.
- **Struk** — cetak (format 80 mm, cocok printer thermal atau simpan PDF) dan
  kirim ke WhatsApp pelanggan dengan sekali ketuk.
- **Pelanggan** — otomatis terkumpul dari riwayat, lengkap dengan total belanja.
- **Laporan** — omzet, jumlah pesanan, piutang, cucian belum diambil, rekap per
  hari dan layanan terlaris (1 / 7 / 30 hari).
- **Cadangan data** — ekspor & impor file `.json`.
- **Offline** — setelah dibuka sekali, aplikasi tetap jalan tanpa internet.

## Struktur berkas

```
index.html            kerangka halaman
manifest.json         identitas PWA (ikon, nama, mode layar penuh)
sw.js                 service worker — membuat aplikasi bisa offline
assets/styles.css     tampilan, dioptimalkan untuk layar sentuh
assets/icon.svg       ikon aplikasi
js/utils.js           format rupiah, tanggal, toast, konfirmasi
js/db.js              penyimpanan data (localStorage) + logika pesanan
js/receipt.js         struk cetak dan teks WhatsApp
js/views.js           tampilan tiap halaman
js/app.js             router antar halaman + pendaftaran service worker
tools/build-single.js penggabung seluruh aplikasi jadi satu berkas HTML
```

Tidak ada dependensi eksternal sama sekali — tidak perlu `npm install`.

## Menyimpan data: yang perlu diketahui

Data tersimpan di `localStorage` **browser tablet tersebut saja**. Artinya:

- Ganti tablet atau hapus data browser → data hilang.
- Tablet kasir A dan tablet kasir B tidak saling berbagi data.
- **Karena itu, rutin tekan "Unduh Cadangan" di menu Pengaturan** (misalnya tiap
  akhir pekan) dan simpan filenya di Google Drive.

## Penerbitan otomatis

`.github/workflows/pages.yml` menyalakan GitHub Pages sendiri dan menerbitkan
ulang situsnya setiap kali ada *push* ke `main`. Perlu diingat: GitHub Pages
hanya gratis untuk repositori **publik** — pada repositori privat, Pages butuh
langganan GitHub Pro.

## Rencana lanjutan (kalau nanti butuh)

1. **Data tersinkron antar perangkat** — ganti `js/db.js` dengan Firebase
   Firestore atau Supabase. Hanya satu berkas itu yang perlu diubah; tampilan
   tidak tersentuh.
2. **Printer thermal Bluetooth** — pasang RawBT di Android, atau bungkus
   aplikasi ini dengan Capacitor agar dapat akses Bluetooth.
3. **Login multi-kasir** — perlu server/autentikasi, ikut paket poin 1.
4. **Notifikasi WhatsApp otomatis** saat cucian siap — perlu layanan WhatsApp
   Business API berbayar; versi sekarang memakai cara manual (tombol Kirim WA)
   yang gratis.

## Mengembangkan lagi dari tablet

Cukup buka [claude.ai/code](https://claude.ai/code) dari browser tablet, pilih
repositori ini, lalu tulis permintaan dengan bahasa biasa, misalnya:
"tambahkan fitur poin loyalitas pelanggan" atau "harga per kg bisa beda untuk
member". Perubahan langsung di-*commit* dan situs Pages ter-update sendiri.
