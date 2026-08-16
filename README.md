# Kasir StarWash Laundry

Aplikasi kasir (POS) untuk StarWash Laundry. Dibuat sebagai **web app** biasa —
HTML + CSS + JavaScript tanpa proses build, tanpa server, tanpa database.
Cukup dibuka di browser tablet, dan bisa dipakai **tanpa internet**.

---

## Jawaban singkat: bisakah dikerjakan dari tablet, bukan komputer?

**Bisa.** Ada dua hal berbeda yang sering tertukar, dan keduanya bisa lewat tablet:

| | Bisa di tablet? | Caranya |
|---|---|---|
| **Memakai** aplikasi kasir | ✅ Ya, sangat cocok | Buka alamat webnya di Chrome/Safari, lalu "Tambahkan ke layar utama" |
| **Membuat/mengubah** kode aplikasi | ✅ Ya | Lewat browser: Claude Code di web (claude.ai/code) atau github.dev — tidak perlu memasang apa pun |

Yang **tidak** praktis di tablet adalah cara pengembangan tradisional: memasang
Node.js, VS Code desktop, emulator Android, atau Android Studio. Android/iPadOS
mengunci akses semacam itu. Solusinya: kerjakan kode di cloud (seperti sesi ini)
dan biarkan tablet hanya jadi **layar** — itulah sebabnya aplikasi ini dibuat
sebagai web app, bukan aplikasi Android native yang harus dikompilasi.

Konsekuensinya (jujur di depan):
- Aplikasi web tidak bisa langsung mencetak ke printer thermal Bluetooth tanpa
  perantara. Cetak dilakukan lewat dialog print sistem (bisa ke printer WiFi,
  atau simpan PDF), atau kirim struk lewat WhatsApp. Untuk printer thermal
  Bluetooth, umumnya dipakai aplikasi jembatan seperti "RawBT" di Android.
- Data disimpan di dalam tablet itu sendiri, bukan di server. Kalau ingin satu
  data dipakai banyak perangkat, perlu tahap lanjutan (lihat "Rencana lanjutan").

---

## Cara memakai di tablet

### Cara tercepat: satu berkas HTML

`dist/kasir-laundry.html` adalah **seluruh aplikasi dalam satu berkas** (±56 KB).
Tidak butuh hosting, tidak butuh internet. Unduh berkas itu ke tablet, lalu buka
lewat aplikasi Files/Chrome. Berkas ini juga bisa dikirim lewat WhatsApp atau
disimpan di Google Drive.

Berkas itu tidak disimpan di repositori (hasil build), melainkan dibuat saat
diperlukan:

```bash
node tools/build-single.js
```

Situs GitHub Pages juga membangunnya otomatis, jadi bisa diunduh dari
`https://<username-github>.github.io/<nama-repo>/dist/kasir-laundry.html`.

### Cara permanen: GitHub Pages

#### 1. Hidupkan GitHub Pages (sekali saja)
Dari browser tablet: buka repositori ini → **Settings → Pages** → bagian
*Build and deployment*, pilih **Source: GitHub Actions** → Save.
Workflow `.github/workflows/pages.yml` sudah disiapkan, jadi setiap kali kode
di-*push* ke `main`, situsnya otomatis ter-update.

Setelah selesai, alamat aplikasi Anda:
`https://<username-github>.github.io/<nama-repo>/`

> **Syarat yang sering terlewat:** GitHub Pages hanya gratis untuk repositori
> **publik**. Pada repositori privat, Pages butuh langganan GitHub Pro. Jika
> alamat Pages menampilkan **404 "There isn't a GitHub Pages site here"**,
> periksa tiga hal: (a) repositori sudah publik atau Anda berlangganan Pro,
> (b) Pages sudah dihidupkan di Settings, (c) kode sudah ada di branch `main`
> — branch itu harus benar-benar ada dan menjadi *default branch*.

### 2. Buka di tablet dan pasang ke layar utama
- **Android / Chrome:** buka alamat di atas → menu ⋮ → **Tambahkan ke layar utama**
- **iPad / Safari:** tombol Bagikan → **Add to Home Screen**

Ikonnya akan muncul seperti aplikasi biasa, tampil layar penuh tanpa address bar.

### 3. Isi data toko dan harga
Buka menu **Pengaturan** → isi nama toko, alamat, telepon (dipakai di struk).
Lalu menu **Layanan** → sesuaikan daftar layanan dan harga dengan tarif Anda.
Harga bawaan hanya contoh.

> Ingin mencoba dulu tanpa GitHub Pages? Unduh/salin folder ini ke tablet dan
> buka `index.html` langsung. Semua tetap jalan kecuali mode offline otomatis
> (service worker butuh alamat `https://`).

---

## Login owner & pegawai

Aplikasi dibuka dengan **PIN 4–6 angka**. Akun bawaan: **Pemilik** dengan PIN
`1234` — segera ganti lewat menu **Pengguna**, dan tambahkan akun untuk tiap
pegawai di sana.

| Menu | Owner | Pegawai |
|---|:---:|:---:|
| Beranda, Kasir, Pesanan, Pelanggan | ✅ | ✅ |
| Omzet & piutang di Beranda | ✅ | — |
| Laporan omzet | ✅ | — |
| Layanan & harga | ✅ | — |
| Pengaturan, Pengguna | ✅ | — |
| Hapus pesanan | ✅ | — |

Nama kasir tercatat di setiap nota dan tercetak di struk, jadi terlihat siapa
yang menerima pesanan. Tombol **Kunci** di menu samping dipakai saat ganti
shift; aplikasi tidak mengunci sendiri, dan sesi berakhir saat aplikasi ditutup.

> ⚠️ **Batas kemampuan.** Selama data masih disimpan di dalam tablet, PIN ini
> adalah *pagar operasional*, bukan keamanan sungguhan: efektif mencegah salah
> pencet dan rasa penasaran, tetapi orang yang paham peralatan developer browser
> tetap bisa menembusnya. PIN disimpan sebagai hash SHA-256 bergaram, bukan teks
> polos, sehingga tidak terbaca sekilas. Keamanan penuh — password divalidasi
> server dan tidak bisa dilewati dari sisi tablet — menyusul saat data pindah ke
> server (lihat "Rencana lanjutan" poin 1).

## Fitur

- **Beranda** — ringkasan hari ini, grafik 7 hari terakhir, dan daftar "perlu
  perhatian" (siap diambil, lewat estimasi, belum lunas). Isinya menyesuaikan
  peran: owner melihat omzet dan piutang, pegawai melihat jumlah cucian saja.
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
tools/build-single.js penggabung seluruh aplikasi jadi satu berkas HTML
dist/kasir-laundry.html  hasil gabungan — siap dibuka langsung di tablet
manifest.json         identitas PWA (ikon, nama, mode layar penuh)
sw.js                 service worker — membuat aplikasi bisa offline
assets/styles.css     tampilan, dioptimalkan untuk layar sentuh
assets/icon.svg       ikon aplikasi
js/merek.js           logo StarWash (data URI) yang dipakai di seluruh aplikasi
js/utils.js           format rupiah, tanggal, toast, konfirmasi
js/auth.js            login PIN, hak akses owner/pegawai, SHA-256
js/db.js              penyimpanan data (localStorage) + logika pesanan
js/receipt.js         struk cetak dan teks WhatsApp
js/views.js           tampilan tiap halaman
js/app.js             router antar halaman + pendaftaran service worker
```

Tidak ada dependensi eksternal sama sekali — tidak perlu `npm install`.

## Identitas merek

Warna diambil dari panduan merek StarWash dan disimpan sebagai token CSS di
`assets/styles.css`, sehingga satu tempat mengubah seluruh aplikasi.

| Peran di aplikasi | Warna |
|---|---|
| Rangka: menu samping, judul, teks | Navy `#0D1B3D` |
| Tindakan utama: tombol simpan, menu aktif, batang hari ini | Merah `#E11D2A` |
| Latar halaman | Abu-abu muda `#EDEDED` |
| Kartu dan bidang isian | Putih `#FFFFFF` |
| Teks sekunder | Abu-abu tua `#6B6F76` |
| Sorotan lembut | Biru muda `#CFE8FF` |

Dua aturan yang dijaga:

1. **Merah hanya untuk tindakan.** Tombol utama berisi penuh merah; tombol
   merusak (Hapus) memakai merah muda dengan teks merah gelap. Yang membedakan
   keduanya adalah isian penuh vs muda, bukan warnanya.
2. **Warna status berdiri sendiri di luar warna merek** — hijau lunas, kuning
   menunggu, merah gelap terlambat — dan selalu disertai tulisan, tidak pernah
   mengandalkan warna saja. Ini supaya kasir bisa membaca status sekilas, juga
   bagi yang kesulitan membedakan warna.

Logo tampil di menu samping (versi terang untuk latar navy), layar masuk, dan
bagian atas struk. Owner tetap bisa menggantinya sendiri lewat **Pengaturan →
Logo toko** tanpa mengubah kode.

## Menyimpan data: yang perlu diketahui

Data tersimpan di `localStorage` **browser tablet tersebut saja**. Artinya:

- Ganti tablet atau hapus data browser → data hilang.
- Tablet kasir A dan tablet kasir B tidak saling berbagi data.
- **Karena itu, rutin tekan "Unduh Cadangan" di menu Pengaturan** (misalnya tiap
  akhir pekan) dan simpan filenya di Google Drive.

## Rencana lanjutan (kalau nanti butuh)

1. **Data tersinkron antar perangkat + login sungguhan** — ganti `js/db.js`
   dengan Firebase Firestore atau Supabase. Hanya satu berkas itu yang perlu
   diubah; tampilan tidak tersentuh. Pemeriksaan PIN di `js/auth.js` ikut
   berpindah ke server, sementara layar masuk, daftar pengguna, dan aturan hak
   aksesnya tetap dipakai apa adanya.
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
