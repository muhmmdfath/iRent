# Pembayaran dan bukti privat

Tahap ini mencakup bukti pembayaran awal/pelunasan, receipt aktual, persetujuan booking, rekonsiliasi dana untuk refund, serta expiry booking. Mengikuti PRD §6–8 dan §15. Pembatalan dan approval/transfer refund tersedia melalui [REFUNDS.md](REFUNDS.md). No-show tersedia melalui [NO_SHOW.md](NO_SHOW.md). Pelunasan aktual oleh admin dan serah terima/pengembalian tersedia melalui [OPERATIONS.md](OPERATIONS.md). Perpanjangan/pembayaran tersedia melalui [EXTENSIONS.md](EXTENSIONS.md); backend Web Push tersedia melalui [NOTIFICATIONS.md](NOTIFICATIONS.md); provider WhatsApp dan integrasi panel masih belum selesai.

## API dan akses

Seluruh route memakai sesi iRent; mutasi memerlukan Origin allowlist, CSRF, dan `Idempotency-Key`. Pelanggan hanya mengakses booking/bukti sendiri. GET detail dan download juga dapat diakses admin, selalu `Cache-Control: no-store`.

| Route                                                     | Fungsi                                                                                                              |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `GET /api/bookings/:id/payments`                          | Status, kewajiban/bukti historis, saldo scope awal, dan permintaan refund                                           |
| `POST /api/bookings/:id/obligations/:obligationId/proofs` | Pelanggan: upload multipart `file` dan `claimedAmount` string rupiah                                                |
| `GET /api/payment-proofs/:id/file`                        | Download privat dengan otorisasi pemilik/admin                                                                      |
| `POST /api/bookings/:id/settlement`                       | Pelanggan: body `{}`, membuka kewajiban pelunasan; gunakan ID obligation pada response untuk upload                 |
| `POST /api/admin/bookings/:id/settlement`                 | Admin: receipt pelunasan aktual tanpa proof, termasuk cash; mengikuti [OPERATIONS.md](OPERATIONS.md)                |
| `POST /api/admin/bookings/:id/payments/verify`            | Verifikasi receipt aktual dan, untuk pembayaran awal lengkap, setujui booking dalam transaksi yang sama             |
| `POST /api/admin/bookings/:id/proofs/:proofId/reject`     | Body `{ "reason": "Alasan penolakan yang jelas" }`; menolak bukti tanpa menghapus sejarah                           |
| `POST /api/admin/bookings/:id/payments/reconcile`         | Catat dana awal atau settlement booking terminal/bukti awal ditolak; dana untuk refund tanpa aktivasi ulang         |
| `POST /api/admin/bookings/:id/approve`                    | Body `{}`; persetujuan hanya jika dana sah sudah cukup, atau total nol; tidak menggantikan verifikasi pending proof |

Contoh body verifikasi; nominal merupakan uang yang benar-benar masuk, bukan nominal screenshot:

```json
{
  "proofId": "<UUID proof>",
  "amount": "25000",
  "occurredAt": "2026-10-08T10:10:00+07:00",
  "method": "transfer",
  "receivingAccountReference": "merchant-bca",
  "transactionReference": "BANK-123456",
  "note": "Uang masuk sudah diperiksa pada mutasi rekening."
}
```

Metode `qris`/`transfer` wajib rekening penerima dan referensi transaksi. Nama rekening diseragamkan lowercase; referensi uppercase/trim dan unik lintas booking. `cash` tidak menggunakan field bank. Nominal harus positif; waktu transaksi aktual tidak boleh masa depan. Waktu pencatatan/aktor disimpan terpisah dan catatan wajib, termasuk untuk backdate. Rekonsiliasi memakai field receipt yang sama, ditambah `obligationId` dan `proofId` opsional; jika diberikan, proof harus ditolak pada kewajiban tersebut. Rekonsiliasi mempertahankan status bukti ditolak.

Payload sama/key sama mengembalikan hasil sebelumnya beserta kondisi booking terkini. Payload berbeda dengan key sama menghasilkan 409. Dua reviewer pada proof yang sama hanya mencatat satu receipt/keputusan. Transaksi bank yang sudah tercatat ditolak, walaupun screenshot/nominal berbeda.

## File dan deadline

Bukti JPG/PNG/PDF maksimal 2 MB diperiksa MIME dan penanda format isinya. Nama file acak, ukuran/hash tersimpan, tidak ada route static ke penyimpanan. Download memakai attachment, nosniff, dan CSP sandbox. Browser membuat multipart boundary; jangan menetapkan header JSON pada request upload. Batas upload 20 percobaan per pengguna per jam; pelanggaran menghasilkan 429.

`PROOF_STORAGE_DIR` menentukan direktori privat, default `backend/storage/proofs` ketika API dijalankan dari backend. Untuk deployment, gunakan path absolut persisten dengan akses filesystem terbatas; seluruh instance API harus mengakses file yang sama. Path/filename privat tidak disertakan dalam response detail. Rollback atau replay menghapus file baru yang tidak terpakai. Jika hasil commit belum dapat dipastikan, file dipertahankan agar bukti yang sudah tercatat tidak hilang; cleanup orphan setelah crash belum diotomatisasi.

Upload diterima sampai deadline inklusif, setelah file tersimpan dan pencatatan berhasil. Waktu diperiksa ulang setelah lock dan sebelum commit; mulai upload lebih awal tidak menjamin diterima. Satu proof pending per obligation. Upload awal mengubah status menjadi `menunggu_konfirmasi`, tetap tanpa saldo terverifikasi, serta menghitung deadline konfirmasi dari snapshot: upload + satu jam untuk mendesak atau 24 jam biasa, dibatasi pickup − satu jam. Pending verifikasi tidak diexpire otomatis.

## Saldo dan keputusan

Receipt dicatat sebagai uang masuk aktual. Application memisahkan dana reserved dan applied. Kurang bayar tetap reserved; bukti berikutnya harus masuk dalam deadline awal, tanpa countdown baru. Ketika lengkap, seluruh bagian wajib diterapkan. Contoh DP Rp20.000 dibayar Rp25.000: applied Rp20.000, uang masuk Rp25.000, permintaan refund Rp5.000; tidak otomatis lunas.

DP yang disetujui menghasilkan `dikonfirmasi`. Pelunasan memakai obligation terpisah; receipt pelunasan sebagian tidak mengubah label menjadi lunas. Response summary menampilkan tagihan sah, received/refunded/netCash, applied/reserved/unapplied, sisa tagihan, refund requested/approved, dan label pembayaran. Refund requested/approved belum mengurangi kas; uang keluar baru dicatat saat transfer refund diselesaikan melalui [REFUNDS.md](REFUNDS.md).

Jika uang masuk tetapi unit/alokasi gagal memenuhi persetujuan, receipt dan hasil verifikasi tetap commit; booking ditolak, charge dikreditkan, alokasi dilepas, dan dana menjadi permintaan refund penuh. Ini bukan rollback uang yang sudah diterima. Kelebihan dan dana kewajiban gagal tetap dipisahkan dari potongan pembatalan.

## Worker expiry dan transaksi

`PAYMENT_WORKER_ENABLED=true` menjalankan batch maksimal 100 booking tiap menit dalam proses API; timer dinonaktifkan pada `NODE_ENV=test`. Worker memakai service yang sama dan aman dijalankan bersamaan antar instance. Tiap booking diproses dalam transaksi tersendiri; kegagalan satu booking tidak menghentikan yang lain. Siklus berikutnya mencoba ulang yang gagal.

Expiry hanya ketika `now > expiresAt`, status masih menunggu bayar, dan tidak ada pending proof. Ia menutup kewajiban, melepas application/kalender, membuat adjustment charge sehingga tidak ada piutang sewa yang batal, menyimpan log/audit/outbox, serta mengajukan refund dana yang sudah diterima. Tidak mengubah kesiapan fisik menjadi ready. Tidak melakukan transfer bank.

Urutan lock: aktor → pelanggan pemilik → item UUID → unit UUID → booking → obligations → referensi bank jika diperlukan. Settings/zona/counter dilewati karena tindakan memakai snapshot dan tidak mengubahnya. Sesuai protokol booking/katalog, stock validation memakai `ReadCommitted` dan retry deadlock/lock timeout terbatas. Semua event tersimpan di outbox saat commit; worker Web Push tersedia melalui NOTIFICATIONS.md; WhatsApp ditunda.

Rekonsiliasi menerima kewajiban awal, serta kewajiban settlement hanya pada booking terminal. Bukti pending pada kewajiban yang sudah ditutup dapat diperiksa admin sebagai bagian rekonsiliasi; receipt tersebut tetap tidak diterapkan dan menjadi permintaan refund penuh.

Koreksi receipt masuk tersedia melalui [RECEIPT_CORRECTIONS.md](RECEIPT_CORRECTIONS.md). Pelunasan pada perpanjangan yang telah disetujui menerima `extensionId` pada endpoint settlement yang sama; nominal/aplikasi/refund tetap berada pada scope extension. Riwayat koreksi tersaji pada financial detail dan laporan.
