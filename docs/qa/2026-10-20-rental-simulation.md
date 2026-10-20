# Simulasi sewa iRent - 20 Oktober 2026

Alur utama lulus melalui browser dengan NestJS dan PostgreSQL nyata, pada database QA dari enam migrasi kosong. Aplikasi utama di 5180/3030 dan database `irent` tidak digunakan untuk transaksi simulasi. Semua identitas, bukti dan penerimaan/pengembalian uang merupakan fixture SIMULASI; tidak ada transfer bank sungguhan.

## Hasil akhir

| Pengujian                  | Hasil                | Lingkungan                                   |
| -------------------------- | -------------------- | -------------------------------------------- |
| Aturan unit backend        | 26 lulus             | Fungsi domain dan adapter simulasi           |
| Backend PostgreSQL/HTTP    | 188 lulus            | Database acceptance terpisah                 |
| UI Vitest/MSW              | 81 lulus             | HTTP disimulasikan                           |
| Regresi Chromium           | 92 lulus, 5 dilewati | API simulasi; viewport 360/390/768/1024/1440 |
| Siklus sewa nyata          | 1 lulus              | UI + API + PostgreSQL, jam QA                |
| Pengamanan transaksi nyata | 1 lulus              | API + PostgreSQL, jam QA                     |

Lima tes browser lama membutuhkan konfigurasi khusus dan tidak dijalankan dalam regresi default. Dua tes nyata tambahan dijalankan terpisah; hasilnya tidak menyatakan lima tes yang dilewati ikut lulus. Typecheck, lint dan format perubahan pengujian diperiksa.

## Siklus nyata yang berhasil

1. Pelanggan daftar dan mengisi nama, alamat, HP dan NIK dummy.
2. Booking iPhone paket enam jam, ambil 10.00 WIB, total Rp60.000 dan DP Rp20.000.
3. Upload bukti langsung setelah booking; status menunggu konfirmasi, uang diterima masih Rp0.
4. Admin memverifikasi uang aktual Rp20.000; booking dikonfirmasi dan sisa Rp40.000.
5. Admin mencatat pelunasan; status pembayaran lunas, uang diterima Rp60.000.
6. Admin mencatat serah-terima pada jadwal; booking berjalan dan unit digunakan.
7. Pelanggan melaporkan pengembalian pada 16.00; unit tetap menunggu pemeriksaan.
8. Admin memverifikasi pengembalian tanpa kerusakan; booking selesai, denda Rp0.
9. API menolak selesai persiapan sebelum satu jam. Pada 17.00 admin menyelesaikan persiapan melalui UI inventaris; API mengonfirmasi unit ready.

[Booking pelanggan selesai](2026-10-20-customer-completed.png) dan [inventaris admin setelah persiapan](2026-10-20-admin-completed.png) berasal dari aplikasi nyata dengan data fixture.

## Skenario lain yang diperiksa

| Kelompok               | Bukti dan perilaku                                                                                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rebutan stok           | Dua pelanggan bersamaan: satu berhasil, satu konflik. Replay kunci sama mengembalikan booking yang sama. Tes PostgreSQL juga mencakup lock, buffer satu jam dan timeout/retry.                                |
| Pembayaran             | Pending proof bukan kas; verifikasi Rp10.000 menyisakan DP Rp10.000 dengan deadline asli. Bukti ditolak lalu diganti; dua verifikasi bersamaan mencatat uang hanya sekali.                                    |
| Privasi                | Pelanggan lain tidak dapat membaca saldo/bukti atau menandai inbox pemilik. Membaca semua notifikasi pemilik membuat unread nol.                                                                              |
| Refund manual          | Pembatalan lebih dari dua hari setelah pembayaran penuh Rp60.000 menghasilkan refund Rp45.000. Approval tidak mencatat kas keluar; transfer manual dengan bukti baru mengubah status uang sudah dikembalikan. |
| Tenggat dan expiry     | Batas booking mendesak, upload tepat batas, admin terlambat, expiry dan refund uang aktual diuji di suite PostgreSQL.                                                                                         |
| Perpanjangan           | Benturan dengan booking baru, paket per unit, quotation/consent, kurang/lebih bayar, admin terlambat serta race approval versus return/loss diuji di PostgreSQL.                                              |
| Return dan kerusakan   | Pengembalian sebagian, denda per unit, penerimaan petugas, pengecualian, perawatan dan koreksi return diuji di PostgreSQL.                                                                                    |
| No-show dan kehilangan | Pickup/delivery, bukti kegagalan, kendala toko, penggantian unit dan risiko booking berikutnya diuji di PostgreSQL.                                                                                           |
| Ketahanan              | Idempotensi, double review/refund/return, CSRF/role, bukti privat, BIGINT rupiah, laporan/Excel, outbox retry dan lease diuji dalam suite terkait.                                                            |

## Temuan dan perapihan tes

Tes lama menganggap hanya ada satu status/alert, belum membersihkan toast antar tes, tidak mensimulasikan pembacaan profil/inbox baru, dan mengharapkan judul beranda lama. Itu menimbulkan kegagalan fixture atau pengalihan login saat sesi palsu menyentuh backend nyata. Fixture UI/browser sekarang menangani query shell yang sama, skenario dapat menimpa responsnya, dan pengujian API nyata tetap memakai Playwright tanpa fallback. Dukungan Notification dimodelkan eksplisit dalam tes push; timeout query UI dibatasi lima detik untuk kompilasi/render pada mesin bersama.

Tidak ada aturan booking, perhitungan uang, otorisasi atau stok yang diubah untuk membuat pengujian lulus. Tidak ditemukan kegagalan aturan bisnis dalam skenario di atas. Ini bukan bukti bahwa semua kemungkinan atau kapasitas produksi sudah diuji.

## Mengulang simulasi nyata

Bangun backend terbaru dari `backend/` dengan `npm run build`. Dari root jalankan `node scripts/start-rental-qa.cjs`. Helper membuat database acak berawalan `irent_qa_browser_`, akun admin fixture, satu unit, storage privat dan jam khusus proses QA. Worker/pengiriman push dimatikan hanya di proses QA; tidak ada endpoint debug pada aplikasi utama.

Pada terminal kedua dari root:

```powershell
$taskQa = Get-ChildItem backend/storage -Directory -Filter 'rental-qa-*' |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
$env:IRENT_QA_CONTROL = Join-Path $taskQa.FullName 'control.json'
Push-Location frontend
npx playwright test --config playwright.qa.config.ts
Pop-Location
```

Untuk mengulang seluruh rangkaian, mulai helper baru agar fixture dan rate limit kembali berasal dari database kosong; rate limit tidak dinonaktifkan.

Setelah selesai, Ctrl+C terminal helper, kemudian jalankan `node scripts/cleanup-rental-qa.cjs` pada terminal kedua dengan environment yang sama. Cleanup memvalidasi nama/path database QA, tidak menghapus database utama, dan aman diulang. File kontrol/kredensial, trace dan runtime disimpan pada path yang diabaikan Git. Jangan publikasikan file kontrol atau trace autentikasi.

## Batas pengujian

Web Push ke perangkat fisik, mode senyap/Focus, pembacaan QRIS dan transfer bank nyata, backup/restore serta beban produksi belum diverifikasi. Bunyi/notifikasi diuji melalui adapter dan browser simulasi. Pengujian waktu menggunakan clock hanya di proses QA; tidak menunggu enam jam sewa atau satu jam persiapan secara nyata.
