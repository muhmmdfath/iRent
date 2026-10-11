# Data simulasi lokal

## Seed lengkap frontend (11 Oktober 2026)

Build backend dan terapkan migrasi/pengaturan dahulu. Jalankan dari root dengan Node 24:

```powershell
node scripts/seed-accounts.cjs
# Backend/frontend berjalan untuk katalog dan foto melalui API.
powershell -ExecutionPolicy Bypass -File scripts/seed-demo.ps1
# Hentikan API utama sementara (Ctrl+C), supaya worker tidak memproses
# booking historis di tengah penyusunan skenario.
node scripts/seed-scenarios.cjs
# Nyalakan kembali API dari backend: npm run start
```

`seed-accounts` membuat admin pertama pada database baru, pelanggan utama, serta Nadia, Raka, Dina dan Laila dengan profil/sesi masing-masing. Admin lokal yang sudah ada memakai `backend/.env.simulation` atau environment `IRENT_DEMO_ADMIN_EMAIL`/`IRENT_DEMO_ADMIN_PASSWORD`. Password acak hanya ditulis ke file lokal yang diabaikan Git; password/data lama tidak direset.

`seed-scenarios` memakai service bisnis NestJS, transaksi, otorisasi, snapshot, ledger dan penyimpanan bukti sebenarnya. Clock simulasi dan worker nonaktif hanya berlaku pada proses seed. Tujuh model dummy ditambah hingga minimal delapan unit per model (56 unit): siap, disewa, persiapan, perawatan dan hilang.

Skenario: belum bayar, bukti pending, siap serah-terima, sedang disewa, perpanjangan disetujui/bukti pending, quotation ongkir untuk penjemputan terpisah, laporan pengembalian, sewa terlambat, selesai/lunas, booking berisiko, unit hilang/ganti rugi, refund diajukan/disetujui/sudah ditransfer. Bukti gambar ditandai **SIMULASI**, bukan transaksi bank nyata. QRIS asli tetap diisi admin dan tidak diganti seed.

`backend/storage/demo/scenarios.json` menyimpan kode/ID, UUID idempotensi, payload dan tahap selesai. Mengulang pada hari/batch yang sama tidak menggandakan tindakan. Deadline berjalan normal setelah API menyala, termasuk upload perpanjangan 30 menit. Untuk batch baru sambil mempertahankan histori:

```powershell
$env:IRENT_DEMO_RUN = 'simulasi-kedua'
node scripts/seed-scenarios.cjs
Remove-Item Env:IRENT_DEMO_RUN
```

Pertahankan nama batch untuk mengulang batch yang sama. Booking lama tetap mengikuti keputusan/worker; tidak dihapus atau diaktifkan kembali. Jadwal contoh mengikuti pengaturan awal PRD dan tetap divalidasi ketika pengaturan toko berbeda. Bagian berikut menjelaskan katalog dan tiga booking baseline sebelumnya; seed lengkap menambahkan unit/skenario di atas.

Jalankan dari root setelah backend/frontend menyala:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/seed-demo.ps1
```

Script membaca akun admin/pelanggan dari `backend/.env.simulation`, yang diabaikan Git. Semua mutasi memakai API lokal, sesi, CSRF dan tindakan bisnis aktual. Manifest dan aset disimpan di `backend/storage/demo/`, juga diabaikan Git. Pertahankan manifest saat menjalankan ulang agar contoh booking tidak dibuat ulang. Script mempertahankan item/zona/profil yang sudah ada dan tidak mereset database.

## Katalog dan tarif dummy

| Item                  | Unit |     6 jam |    12 jam |    24 jam |
| --------------------- | ---: | --------: | --------: | --------: |
| iPhone 13             |    3 |  Rp75.000 | Rp100.000 | Rp150.000 |
| iPhone 14             |    3 |  Rp90.000 | Rp125.000 | Rp180.000 |
| iPhone 15             |    3 | Rp110.000 | Rp150.000 | Rp220.000 |
| iPhone 15 Pro         |    2 | Rp150.000 | Rp200.000 | Rp300.000 |
| AirPods Pro           |    3 |  Rp15.000 |  Rp25.000 |  Rp40.000 |
| Tripod & Phone Holder |    4 |  Rp10.000 |  Rp15.000 |  Rp25.000 |
| Powerbank 20.000 mAh  |    4 |  Rp10.000 |  Rp15.000 |  Rp20.000 |

Total 22 unit dibuat dalam kondisi layak/ready. Ketersediaan kalender tetap mengikuti alokasi booking. Tarif ini untuk simulasi, bukan harga toko.

Foto ilustratif produk berasal dari Apple Newsroom: [iPhone 13](https://www.apple.com/newsroom/2021/09/apple-introduces-iphone-13-and-iphone-13-mini/), [iPhone 14](https://www.apple.com/newsroom/2022/09/apple-introduces-iphone-14-and-iphone-14-plus/), [iPhone 15](https://www.apple.com/newsroom/2023/09/apple-debuts-iphone-15-and-iphone-15-plus/), [iPhone 15 Pro](https://www.apple.com/newsroom/2023/09/apple-unveils-iphone-15-pro-and-iphone-15-pro-max/), dan [AirPods Pro](https://www.apple.com/newsroom/2019/10/apple-reveals-new-airpods-pro-available-october-30/). Tripod/powerbank memakai ilustrasi vektor demo. Gambar disalin lokal, disanitasi oleh endpoint upload, dan disajikan sebagai WebP dari storage backend; frontend tidak bergantung pada CDN untuk menampilkannya.

## Pelanggan, zona dan booking

Profil pelanggan simulasi dilengkapi dengan nama/alamat/HP/NIK dummy melalui API profil; NIK tetap terenkripsi. Profil yang sudah lengkap tidak diubah.

Zona antar-jemput: Semarang Tengah Rp20.000, Semarang Selatan Rp25.000, Banyumanik Rp35.000, dan Tembalang Rp35.000.

Tiga booking dibuat untuk pelanggan simulasi. Masing-masing menggunakan satu iPhone dan satu tripod, paket enam jam dengan pengambilan pukul 10.00 WIB pada hari +1/+2/+3 dari saat seed pertama:

| Contoh             | Status awal         | Pembayaran                                                                           |
| ------------------ | ------------------- | ------------------------------------------------------------------------------------ |
| iPhone 13 + tripod | Menunggu pembayaran | DP Rp20.000 belum dibayar                                                            |
| iPhone 14 + tripod | Menunggu konfirmasi | Bukti dummy diunggah; belum menjadi uang terverifikasi                               |
| iPhone 15 + tripod | Dikonfirmasi        | DP Rp20.000 dicatat/verifikasi sebagai dana simulasi; sisa sewa masih harus dilunasi |

Booking/tenggat tetap mengikuti aturan server. Booking tanpa bukti akan kedaluwarsa setelah batas pembayaran; menjalankan ulang seed tidak memperpanjang deadline atau mengaktifkan kembali booking lama.

Bukti contoh ada di `backend/storage/demo/bukti-pembayaran-demo.png`, dengan label simulasi. Screenshot katalog ada di `backend/storage/demo/catalog-desktop.png`. QRIS toko tidak diisi; tidak ada QR pembayaran nyata dalam data dummy.

Verifikasi lokal: tujuh gambar berhasil dimuat di browser; tiga booking terlihat pada riwayat pelanggan; DP terverifikasi tetap memiliki sisa tagihan. Menjalankan seed dua kali mempertahankan item/unit/zona/booking tanpa duplikasi.
