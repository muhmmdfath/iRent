# Jam booking dan urutan beranda pelanggan

Jam layanan pada backend dan produksi sudah 08.00–22.00 WIB. Perubahan ini memperjelas pemilih waktu pelanggan, tanpa membatasi kapan pelanggan boleh membuka website atau mengubah durasi paket.

- Form booking dan pilihan jadwal detail perangkat memakai tampilan tanggal/jam 24 jam yang konsisten, tanpa AM/PM dari pengaturan browser.
- Pilihan jam mengikuti kebijakan operasional API. Saat penutupan pukul 22.00, menit setelah 00 tidak ditawarkan. Payload tetap datetime WIB yang sama dan terhubung dengan React Hook Form.
- Timestamp administrasi seperti penerimaan uang dan pengembalian aktual tetap bebas mencatat kejadian di luar jam booking.
- Booking terbaru menjadi bagian pertama beranda, mendahului katalog di DOM dan tampilan. Tiga booking terakhir menggunakan varian ringkas; pada layar sempit dapat digeser mendatar. Daftar riwayat booking tetap memakai layout sebelumnya.
- Deadline pembayaran, tautan bayar/detail, badge status, foto, harga, serta kondisi loading/error/kosong tetap tersedia.

Verifikasi: build/typecheck, lint, tes komponen rentang jam dan timestamp admin, alur pelanggan, browser beranda desktop/mobile termasuk tiga kartu, dan browser formulir yang memastikan 08:00 terkirimi sebagai `T08:00:00+07:00`.

Screenshot: `customer-home-360.png`, `customer-home-1440.png`, `booking-clock-390.png`, dan `booking-clock-1440.png`. Seluruhnya memakai data simulasi.

## Deployment 23 Oktober 2026

Frontend diperbarui pada `https://irentsmg.tech` setelah backup privat `20261023T042603Z`. Layanan API/database tidak dibangun ulang dan aturan produksi tetap 08.00–22.00 WIB. Delapan tes browser diulang pada domain produksi dengan sesi/data pelanggan dan mutasi yang disimulasikan; tidak membuat transaksi produksi. Readiness API/database sehat. Pembaruan memakai snapshot working tree dan belum otomatis dipush ke Git.
