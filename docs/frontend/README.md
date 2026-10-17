## Beranda admin operasional

Dashboard menampilkan empat indikator di bagian atas, jadwal WIB bertab, satu antrean prioritas, distribusi status dan booking terbaru. Pembayaran tidak diulang dalam panel terpisah. Pengingat suara/pengakuan versi tugas tetap tersedia. Data berasal dari endpoint overview/tasks/bookings yang sudah ada; unit siap fisik tidak diklaim selalu tersedia untuk setiap jadwal.

- [Desktop, layar awal](admin-dashboard-1440-viewport.png)
- [HP, layar awal](admin-dashboard-390-viewport.png)
- [Desktop, halaman penuh](admin-dashboard-desktop.png)
- [HP, halaman penuh](admin-dashboard-mobile.png)

Preview menggunakan database lokal nyata. Build/TypeScript/lint, 81 tes frontend dan 13 tes browser terkait lulus. Lima ukuran layar diperiksa tanpa overflow atau error JavaScript. Hierarki operasional mengacu pada [Booqable](https://help.booqable.com/en/articles/5603615-how-to-use-the-dashboard) dan prioritas pekerjaan pada [Shopify Home](https://help.shopify.com/en/manual/shopify-admin/shopify-home), dengan palet/tipografi yang dipilih pengguna.

## Poppins dan posisi panel footer

Seluruh antarmuka memakai Poppins 400/500/600/700 dari aset lokal. Panel footer diturunkan 40px di desktop, 32px di tablet dan 24px di HP; posisi wordmark tetap rendah. Build lulus dan delapan kombinasi halaman/viewport diperiksa tanpa overflow.

- [Footer desktop](poppins-footer-desktop.png)
- [Footer HP](poppins-footer-mobile.png)

## Koreksi kontrol netral dan footer

Tombol, logo dan sidebar menggunakan hitam-putih/abu, termasuk hover/fokus; pink pastel dipertahankan untuk dekorasi. Logo tidak dibungkus styling tombol. Wordmark footer berada lebih rendah dan terpotong pada tepi bawah.

- [Kontrol desktop](neutral-controls-desktop.png)
- [Footer desktop](footer-lowered-desktop.png)
- [Footer HP](footer-lowered-mobile.png)

## Pink pastel dan motion - 15 Oktober 2026

Putih tetap dominan, teks hitam dan aksen pink pastel. Navbar fixed memakai transparansi/backdrop blur. Beranda menyediakan gerakan perangkat, parallax ringan, scroll reveal dan indikator progres tanpa mengunci scroll; prefers-reduced-motion menonaktifkan animasi. Aksi diberi bentuk tombol, bagian tiga langkah terpusat dan wordmark footer lebih jelas.

| Preview            | Screenshot                               |
| ------------------ | ---------------------------------------- |
| Beranda desktop    | [Hero](pastel-home-desktop.png)          |
| Beranda HP         | [Hero mobile](pastel-home-mobile.png)    |
| Alur sewa terpusat | [Tiga langkah](pastel-steps-desktop.png) |
| Footer pastel      | [Footer](pastel-footer-desktop.png)      |
| Katalog HP         | [Katalog](pastel-catalog-mobile.png)     |

Screenshot diambil dari API/database lokal nyata. Build/lint, 78 tes frontend dan 48 tes browser lulus; lima tes khusus API nyata dilewati pada regresi default. Catatan berikut menggambarkan tahap sebelumnya.

## Sidebar, navbar dan katalog - 15 Oktober 2026

Referensi terbaru berasal dari gambar pengguna. Layout publik/pelanggan/admin memakai sidebar berkelompok, navbar pencarian dan permukaan netral. Dokumen desain lama sudah dihentikan.

| Preview         | Screenshot                                 |
| --------------- | ------------------------------------------ |
| Footer desktop  | [Footer](footer-refresh-desktop.png)       |
| Footer HP       | [Footer mobile](footer-refresh-mobile.png) |
| Katalog desktop | [Desktop](catalog-refresh-desktop.png)     |
| Katalog HP      | [Mobile](catalog-refresh-mobile.png)       |
| Sidebar HP      | [Menu terbuka](sidebar-refresh-mobile.png) |
| Sidebar admin   | [Admin](sidebar-refresh-admin.png)         |

Gambar direkam dari backend dan database demo nyata. Bagian selanjutnya adalah catatan tahap sebelumnya.

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

Diambil melalui tes Playwright pada 9 Oktober 2026. Arah visual mengikuti pilihan pengguna dan UI aplikasi saat ini. Dokumen dan ekspor Stitch sudah dihapus. [Setup dan cakupan implementasi](../../frontend/README.md) menjelaskan halaman yang sudah tersedia. Screenshot bukan bukti bahwa halaman bisnis/PWA perangkat nyata sudah selesai.

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
