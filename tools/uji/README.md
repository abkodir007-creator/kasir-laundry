# Rangkaian uji

Dijalankan dengan Playwright terhadap salinan aplikasi yang dilayani
server statis biasa. Disimpan di dalam penyimpanan kode, bukan di folder
sementara: rangkaian uji yang hanya ada di mesin kerja ikut hilang begitu
mesinnya diganti, dan yang tersisa cuma ingatan bahwa dulu pernah lolos.

```sh
python3 -m http.server 8099 --bind 127.0.0.1 &   # dari akar penyimpanan ini
node tools/uji/jalankan.js                        # seluruhnya
node tools/uji/jadwal-campur.js                   # satu berkas saja
```

Mode `?lokal=1` dipakai supaya uji tidak menyentuh Firebase sungguhan.
