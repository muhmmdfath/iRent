# Preview implementasi frontend

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
