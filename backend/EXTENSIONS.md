# Perpanjangan per unit

Implementasi PRD §12. Proposal mempunyai status dan scope keuangan sendiri; booking tetap berjalan dan jadwal awal tidak berubah sebelum approval. Semua action membutuhkan sesi, Origin/CSRF dan `Idempotency-Key`; waktu ISO WIB `+07:00`, uang string rupiah, ID unit adalah **BookingItem.id**.

## API

Prefix pelanggan `/api/bookings/:bookingId/extensions`; prefix admin `/api/admin/bookings/:bookingId/extensions`.

| Method/path relatif                    | Fungsi                                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------------------ |
| POST /                                 | Pelanggan membuat proposal, body `items: [{bookingItemId, addedHours}]`                    |
| GET /:id                               | Pemilik/admin membaca proposal, saldo scope perpanjangan, dan overdue konfirmasi; no-store |
| POST /:id/submit                       | Pelanggan menyetujui quotation terbaru dan submit formal                                   |
| POST /:id/proofs                       | Pelanggan upload multipart `file` dan `claimedAmount`; JPG/PNG/PDF privat, maks 2 MB       |
| POST /:id/cancel                       | Pelanggan membatalkan proposal pending, body `reason`                                      |
| POST admin /:id/quote                  | Admin menentukan `extraDeliveryQuote` dan `note`                                           |
| POST admin /:id/payments/verify        | Admin memeriksa bukti dan receipt aktual; approval jika seluruh kewajiban terpenuhi        |
| POST admin /:id/proofs/:proofId/reject | Admin menolak bukti, body `reason`; upload ulang mengikuti deadline asli                   |
| POST admin /:id/reject                 | Admin menolak seluruh proposal pending, body `reason`                                      |
| POST admin /:id/approve                | Approval dengan dana reserved lengkap atau proposal gratis; tidak melewati proof pending   |
| POST admin /:id/payments/reconcile     | Receipt untuk refund dari proposal terminal/bukti ditolak; jadwal tidak diaktifkan         |

Download proof memakai `/api/payment-proofs/:id/file` dengan otorisasi pemilik/admin. Receipt mengikuti [PAYMENTS.md](PAYMENTS.md), dengan `proofId` untuk verify; reconcile menggunakan `obligationId` dan opsional `proofId`. Metode cash/QRIS/transfer, referensi bank global unik, waktu kejadian aktual tidak di masa depan. Screenshot tidak dianggap dana masuk sebelum admin memeriksa transaksi.

Contoh pengajuan:

```json
{
  "items": [{ "bookingItemId": "<UUID unit booking>", "addedHours": 6 }]
}
```

Response action memuat `decision` berupa ID proposal untuk create/submit/upload; verify/approve memuat keputusan bisnis. `booking.extensions` memuat proposal/unit, `booking.obligations` memuat proof metadata privat. GET proposal memuat saldo perpanjangannya. Saldo dari GET pembayaran booking tetap **scope awal**, termasuk denda/kerusakan; jangan memakai saldo awal sebagai total pendapatan seluruh perpanjangan. Selama proposal pending, quotation belum menjadi charge sah, sehingga `summary.bill/remaining` belum mencerminkan nominal yang perlu dibayar. Gunakan `extension.amountDue` atau obligation, dikurangi reserved funds untuk pelengkapan pembayaran; lakukan aritmetika rupiah dengan BIGINT.

## Syarat dan quotation

- Paket tambahan 6/12/24 jam, tarif dari snapshot booking awal; weekday/weekend sama. Tambahan dihitung dari currentEndAt per unit.
- Setiap unit in_use/return_pending, total sewa sejak start efektif maksimal tujuh hari, akhir dalam jam operasional. Kompensasi keterlambatan toko tidak mengurangi sisa durasi sewa.
- Pengajuan website dan submit formal paling lambat dua jam sebelum akhir **setiap unit**; batas tepat dua jam diterima. Pemeriksaan waktu diulang sebelum commit.
- Satu proposal aktif per unit, termasuk draft_quote. Proposal terpisah untuk unit berbeda diperbolehkan. Retry menormalisasi urutan pilihan/UUID dan tidak membuat hold/receipt/charge baru.
- Delivery yang menghasilkan jadwal penjemputan berbeda membutuhkan draft_quote. Draft belum mempunyai hold atau deadline pembayaran. Admin memasukkan ongkir tambahan dan alasan sebelum pembayaran; bahkan quotation nol tetap perlu disetujui.
- Submit draft memakai `{ "agreeExtraDelivery": true, "expectedExtraDeliveryQuote": "10000" }`. Nominal harus sama dengan quotation terbaru. Stok, versi unit, dan batas dua jam diperiksa ulang; quotation tidak menjamin slot.

## Hold, uang, dan keputusan

Submit formal menahan slot tambahan dengan buffer snapshot, membuat obligation scope extension, dan memberi batas bayar/upload 30 menit. Upload tepat waktu mempertahankan hold sampai keputusan admin meskipun batas bayar/konfirmasi terlewati. Jadwal lama tetap berlaku selama pending.

Konfirmasi memakai yang lebih awal antara upload + satu jam dan oldEndAt unit − 30 menit; deadline proposal adalah deadline unit terawal. Scheduler tidak menyetujui proposal otomatis. Reminder 30 menit sebelum deadline dan alert overdue tersimpan sekali per proposal/deadline pada outbox.

Dana kurang tetap reserved, mengizinkan pelengkapan sampai deadline asli. Jika pemeriksaan kurang bayar selesai setelah deadline, proposal expired dan seluruh receipt aktual disiapkan untuk refund. Bukti ditolak bisa diulang sebelum expiry asli; setelah itu hold dilepas. Dana yang belakangan diketahui masuk dicatat melalui reconcile dan direfund penuh. Rekonsiliasi bukti pending yang telah ditutup menandai proof reviewed tanpa mengaktifkan proposal kembali.

Approval memeriksa ulang versi/jadwal/kondisi unit, alokasi pelanggan lain, aturan satu iPhone, serta seluruh unit proposal. Hold sendiri dan rental unit yang sama dikecualikan. Approval terlambat tetap dapat berhasil pada proposal timely selama akhir baru belum lewat dan kalender/keadaan masih sah. Seluruh unit disetujui atau ditolak bersama. Kegagalan validasi setelah receipt tetap mempertahankan uang masuk dan menyiapkan refund 100%; jadwal awal semua unit tetap.

Proposal disetujui membuat charge extension/ongkir tambahan sekali, menerapkan reserved funds, memperbarui currentEndAt/version, menggabungkan perpanjangan ke rental allocation, dan melepas hold. Unit fisik tetap in_use. Kelebihan uang mempunyai refund tersendiri; refund review/transfer memakai [REFUNDS.md](REFUNDS.md).

Pengembalian terverifikasi bersaing melalui lock yang sama dengan approval. Bila return menang, seluruh proposal pending dan hold-nya dibatalkan, termasuk hold unit lainnya; sewa awal unit lain tetap berlaku. Proof pending masih dapat direkonsiliasi untuk refund.

## Keterlambatan pemeriksaan admin

Pengecualian otomatis membutuhkan upload timely dan receipt yang telah diverifikasi/reconciled, dengan dana lengkap benar-benar diterima paling lambat deadline pembayaran. Interval keterlambatan dihitung dari deadline konfirmasi sampai keputusan proposal, dipotong ke periode denda, lalu digabung dengan pengecualian manual agar tidak dikurangi dua kali. Receipt terlambat atau dana kurang tidak otomatis mendapat pengecualian ini.

Jika barang telah kembali sebelum receipt diperiksa, rekonsiliasi menghitung ulang denda memakai bukti aktual. Koreksi berupa credit adjustment dengan audit; catatan pengembalian/charge awal tidak ditimpa. Jika denda sudah dibayar, selisih membuat refund manual dengan sumber dana dan batas nominal tersimpan. Replay tidak menggandakan adjustment atau refund. Pengecualian manual tetap tersedia bagi admin untuk fakta operasional lainnya.

## Worker dan verifikasi

`EXTENSION_WORKER_ENABLED=true` menjalankan expiry dan reminder/overdue setiap menit, kecuali NODE_ENV=test. Set false jika worker dijalankan terpisah. Instance bersamaan membaca ulang status dalam transaksi; error satu proposal tidak menghentikan batch. Proposal menunggu konfirmasi tidak di-expire karena admin terlambat. Event tersimpan dalam outbox; backend Web Push tersedia melalui [NOTIFICATIONS.md](NOTIFICATIONS.md). Provider WhatsApp dan integrasi panel belum selesai.

Jalankan `npm run test:db` dengan PostgreSQL khusus pengujian. Cakupan meliputi kontensi stok/approval/return, snapshot tarif, quotation/consent, batas waktu dan rollback, uang kurang/lebih/refund, kompensasi admin terlambat, reminder terdeduplikasi, serta otorisasi dan proof privat HTTP. Schema/migrasi tidak berubah. Kehilangan/penggantian dan koreksi denda terkait tersedia melalui [LOSS_RISKS.md](LOSS_RISKS.md). Koreksi receipt umum, provider WhatsApp, dashboard/laporan, media dan UI belum tersedia.
