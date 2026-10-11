# Preview implementasi frontend

## Penyelesaian frontend — 11 Oktober 2026

Frontend pelanggan/admin phase 1 terintegrasi dengan API. Screenshot baru memakai database PostgreSQL dan seed lokal sebenarnya, dengan foto item dan transaksi simulasi. Audit memeriksa admin 360/390/768/1024/1440 px dan pelanggan 360/1440 px, termasuk error API/JavaScript, status loading dan overflow horizontal.

| Halaman        | Desktop                              | Mobile                             |
| -------------- | ------------------------------------ | ---------------------------------- |
| Beranda publik | [Desktop](public-home-desktop.png)   | [Mobile](public-home-mobile.png)   |
| Kalender       | [Desktop](calendar-desktop.png)      | [Mobile](calendar-mobile.png)      |
| Perpanjangan   | [Desktop](extensions-desktop.png)    | [Mobile](extensions-mobile.png)    |
| Laporan kas    | [Desktop](reports-desktop.png)       | [Mobile](reports-mobile.png)       |
| Pengaturan     | [Desktop](settings-desktop.png)      | [Mobile](settings-mobile.png)      |
| PWA            | [Desktop](notifications-desktop.png) | [Mobile](notifications-mobile.png) |

Bagian berikut adalah riwayat tahap terdahulu. Integrasi UI PWA sudah tersedia; pemasangan dan pengiriman push pada perangkat Android/iPhone fisik tetap memerlukan HTTPS/VAPID dan pemeriksaan lingkungan nyata.

Screenshot dari aplikasi React/Vite langkah 1, bukan ekspor Stitch. Login memakai backend iRent; screenshot formulir ini tidak berisi kredensial atau data transaksi.

- [Login desktop 1440 px](login-desktop.png)
- [Login mobile 390 px](login-mobile.png)

Diambil melalui tes Playwright pada 9 Oktober 2026. Acuan visual tetap [DESIGN.md](../../DESIGN.md) dan [Stitch Redesign](../../STITCH_REDESIGN.md). [Setup dan cakupan implementasi](../../frontend/README.md) menjelaskan halaman yang sudah tersedia. Screenshot bukan bukti bahwa halaman bisnis/PWA perangkat nyata sudah selesai.

## Alur pelanggan

Screenshot berikut berasal dari implementasi langkah 2 dengan API simulasi dan identitas fixture; bukan transaksi pelanggan. Foto item fixture belum tersedia, sehingga placeholder jujur ditampilkan. Pada inventaris nyata, UI membaca photoPath publik dari backend.

| Halaman    | Desktop 1440 px                | Mobile 390 px                |
| ---------- | ------------------------------ | ---------------------------- |
| Katalog    | [Desktop](catalog-desktop.png) | [Mobile](catalog-mobile.png) |
| Booking    | [Desktop](booking-desktop.png) | [Mobile](booking-mobile.png) |
| Pembayaran | [Desktop](payment-desktop.png) | [Mobile](payment-mobile.png) |

Alur registrasi/profil/booking/upload juga diuji terpisah dengan Nest/PostgreSQL nyata dalam database sementara. Screenshot tidak menyatakan bahwa panel admin atau PWA perangkat nyata sudah selesai.

## Booking dan pembayaran admin

Screenshot implementasi langkah 3 memakai identitas dan transaksi fixture melalui API simulasi, diambil 11 Oktober 2026. Alur pembayaran juga diuji terpisah pada Nest/PostgreSQL nyata dalam database pengujian.

| Halaman                | Desktop 1440 px                       | Mobile 390 px                       |
| ---------------------- | ------------------------------------- | ----------------------------------- |
| Daftar booking         | [Desktop](admin-bookings-desktop.png) | [Mobile](admin-bookings-mobile.png) |
| Pemeriksaan pembayaran | [Desktop](admin-payment-desktop.png)  | [Mobile](admin-payment-mobile.png)  |

Panel ini mencakup booking dan pembayaran awal/pelunasan. Serah-terima, pengembalian, perpanjangan dan PWA perangkat nyata belum termasuk tahap ini.

## Serah-terima dan pengembalian admin

Langkah 4 menambah tindakan operasional pada detail booking. Screenshot pemeriksaan pengembalian berikut memakai dua unit fixture dengan API simulasi; pengembalian hanya diterapkan pada unit yang dipilih. Pemeriksaan browser mencakup 360/390/768/1024/1440 px.

| Halaman                  | Desktop 1440 px                     | Mobile 390 px                     |
| ------------------------ | ----------------------------------- | --------------------------------- |
| Pemeriksaan pengembalian | [Desktop](admin-return-desktop.png) | [Mobile](admin-return-mobile.png) |

Persiapan/perawatan fisik tetap terpisah dari penyelesaian sewa dan tagihan. Tombol penyelesaian persiapan/perawatan mengikuti tahap inventaris berikutnya.

## Inventaris dan kesiapan unit admin

Langkah 5 menambah daftar/detail model, tarif, foto dan unit, serta penyelesaian perawatan/persiapan fisik. Screenshot memakai model/unit fixture dengan API simulasi; foto yang belum tersedia ditampilkan sebagai placeholder. Alur buat/edit model, upload foto, tambah unit, perawatan dan status katalog juga diuji pada API/PostgreSQL nyata dalam database terpisah.

| Halaman                        | Desktop 1440 px                        | Mobile 390 px                        |
| ------------------------------ | -------------------------------------- | ------------------------------------ |
| Inventaris                     | [Desktop](admin-inventory-desktop.png) | [Mobile](admin-inventory-mobile.png) |
| Unit dan pemeriksaan perawatan | [Desktop](admin-units-desktop.png)     | [Mobile](admin-units-mobile.png)     |

Kesiapan fisik tidak menjamin ketersediaan seluruh jadwal. Selesai perawatan memulai persiapan satu jam; admin tetap menyelesaikan pemeriksaan persiapan secara eksplisit.

## Pembatalan dan refund

Langkah 6 menambah pembatalan pelanggan/kendala toko, rekening penerima, antrean refund dan keputusan admin, serta pencatatan transfer manual dengan bukti privat. Screenshot memakai API simulasi: DP Rp20.000 dibatalkan lebih awal, refund Rp10.000 dan biaya tertahan Rp10.000. Persetujuan belum mengurangi kas. Transfer bank sungguhan dilakukan di luar aplikasi.

| Halaman                | Desktop 1440 px                     | Mobile 390 px                     |
| ---------------------- | ----------------------------------- | --------------------------------- |
| Review transfer refund | [Desktop](admin-refund-desktop.png) | [Mobile](admin-refund-mobile.png) |
