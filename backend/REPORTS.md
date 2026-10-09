# Laporan kas dan Excel

Admin: `GET /api/admin/reports?kind=day&period=2026-10-09&page=1&limit=50` atau `kind=month&period=2026-10`. Rentang WIB setengah terbuka dari tengah malam sampai hari/bulan berikutnya; tanggal mustahil ditolak. `GET /api/admin/reports/excel` dengan filter sama mengunduh XLSX.

Response:

- `cash`: incoming, outgoing, net, dari receipt aktual aktif menurut **occurredAt**. Bukti pending, klaim pelanggan, atau refund baru disetujui tidak memengaruhi kas.
- `pendingRefundsNow`: refund disetujui yang belum ditransfer saat request, seluruh periode; bukan ukuran historis periode yang dipilih.
- `bookingCounts`: status terkini booking yang dibuat pada periode (`createdAt`).
- `popularItems`: sepuluh item menurut jumlah unit booking dikonfirmasi/berjalan/selesai dengan initialStartAt pada periode; nama snapshot.
- `successfulTransactions`: booking selesai dalam periode menurut status log dan sekarang lunas untuk seluruh scope, sesudah adjustment/refund selesai. Kehilangan yang ditutup ditandai `lossClosed`. Selesai tetapi belum lunas tidak masuk.
- `journal`: mutasi berhalaman beserta kode booking/admin, waktu aktual dan waktu pencatatan, catatan, supersededAt dan referensi koreksi. NIK/proof path/rekening privat tidak dikirim.

Read memakai snapshot Repeatable Read. Koreksi receipt mengubah kas periode sesuai waktu aktual pengganti, sementara receipt lama, pembalik dan alasan tetap dapat ditelusuri pada jurnal. Koreksi yang dibackdate dapat mengubah laporan lama; audit menyimpan before/after dan alasan.

Excel memiliki sheet Ringkasan, Mutasi, Status booking, Item populer, Selesai dan lunas. Rupiah ditulis sebagai teks desimal untuk menjaga presisi di atas batas Number/Excel. Catatan seperti `=HYPERLINK(...)` tetap teks, bukan formula. Sheet mutasi mencantumkan pembalik pencatatan dan dampak kas efektif per receipt. Ekspor maksimal 10.000 mutasi/transaksi selesai; gunakan periode harian bila melebihi batas (413).

Generator menggunakan [ExcelJS](https://github.com/exceljs/exceljs). Receipt salah yang diganti mempunyai dampak kas efektif nol; pembalik pencatatan bukan transfer refund fisik.
