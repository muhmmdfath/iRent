# Kehilangan, penggantian unit, dan risiko booking

Kontrak mengikuti PRD bagian 10–11. Semua action admin menggunakan sesi iRent, Origin/CSRF dan `Idempotency-Key`. UUID menunjuk booking serta booking item; uang dikirim sebagai string rupiah dan timestamp bisnis menggunakan `+07:00`.

## Verifikasi kehilangan

`POST /api/admin/bookings/:id/items/:itemId/loss/verify`

```json
{
  "lostAt": "2026-10-10T17:01:00+07:00",
  "lossNote": "Unit hilang telah diperiksa admin.",
  "compensationAmount": "100000"
}
```

Hanya unit in_use/return_pending pada booking berjalan. `lostAt` berada antara handover dan waktu server. Kompensasi manual boleh nol; nominal dan total tagihan dibatasi BIGINT. Opsional `exemptions` memakai format [OPERATIONS.md](OPERATIONS.md), termasuk pengecualian otomatis pemeriksaan perpanjangan dengan dana timely terverifikasi. Denda berhenti pada lostAt, memakai snapshot toleransi/tarif dan gabungan interval pengecualian.

Satu transaksi mencatat loss record, charge kompensasi/denda sekali, audit/outbox, lost_closed, dan unit lost/nonaktif. Alokasi unit yang ditutup dilepas; laporan pengembalian pending ditolak dengan riwayat tetap tersimpan. Tidak dibuat pengembalian verified atau status ready. Proposal perpanjangan pending terkait ditutup seluruhnya beserta hold; receipt tambahan aktual memperoleh permintaan refund 100%. Unit lain tetap berjalan. Booking selesai ketika semua unit returned/lost_closed, walaupun tagihan belum lunas; settlement admin tetap tersedia.

Rekonsiliasi bukti perpanjangan setelah kehilangan dapat mengoreksi denda melalui credit adjustment dan refund kelebihan yang sudah dibayar. Loss record, charge awal, serta nominal kompensasi tetap dipertahankan. Approval dan transfer refund mengikuti [REFUNDS.md](REFUNDS.md).

## Penggantian sebelum handover

`POST /api/admin/bookings/:id/items/:itemId/unit/replace`

Body: `{ "itemUnitId": "UUID-unit-pengganti", "reason": "Unit lama bermasalah, ganti model sama." }`.

Booking harus aktif sebelum handover, unit masih allocated, dan hold pembayaran belum lewat deadline. Pengganti harus berasal dari item/model yang sama. Server mengunci pelanggan, item, unit lama dan baru dalam urutan konsisten; pemeriksaan kondisi, pemakaian, persiapan dan seluruh kalender terjadi dalam transaksi. Permintaan yang bersaing tidak memperoleh unit yang sama pada jadwal bentrok.

Alokasi lama menjadi released dan tetap tersimpan. Alokasi baru mempertahankan jadwal, buffer snapshot dan deadline hold; kode unit snapshot diperbarui, perubahan diaudit. Harga, ledger, status booking dan kondisi fisik unit lama tidak berubah. Unit yang sedang digunakan pada jadwal lain dapat dipilih untuk jadwal masa depan bila aturan ketersediaan terpenuhi; saat pengambilan, pemeriksaan fisik ready tetap wajib.

## Risiko dan tindak lanjut admin

`GET /api/admin/bookings/at-risk?page=1&limit=20` mengembalikan `{data,total,page,limit}` dengan header no-store. Detail pembayaran juga menyertakan `risks`, hanya untuk booking yang boleh diakses pengguna tersebut.

Risiko dihitung dari kondisi terkini: unit nonaktif/hilang/perawatan, sewa sebelumnya terlambat, persiapan melewati jadwal, atau unit belum ready saat pengambilan. Setiap entri memuat bookingId, bookingItemId, itemUnitId, startAt, reasons, dan atRisk. Risiko bukan status pembatalan; alokasi pelanggan berikutnya tetap terlindungi. Admin mengganti unit, atau menggunakan pembatalan toko dengan refund penuh yang sudah tersedia. Pengubahan jadwal umum belum tersedia.

Verifikasi return/loss memeriksa risiko dalam transaksi. `RISK_WORKER_ENABLED=true` memindai paling banyak 100 unit setiap menit, kecuali NODE_ENV=test; cursor berputar agar halaman berikutnya tetap diproses. Risiko dashboard langsung dihitung tanpa menunggu worker. Event `booking.unit_at_risk` dideduplikasi berdasarkan booking item, versi, penyebab, kondisi unit dan pemakaian terkait. Keadaan berubah dapat menghasilkan alert baru; kegagalan satu unit tidak menghentikan batch.

Event tersimpan dalam outbox dan backend Web Push tersedia melalui [NOTIFICATIONS.md](NOTIFICATIONS.md); provider WhatsApp dan integrasi panel belum selesai. Worker tidak membatalkan booking atau menjadikan unit ready. Schema/migrasi tidak berubah. Tes PostgreSQL mencakup kehilangan/pengembalian/approval bersamaan, refund/koreksi denda, pengembalian sebagian, risiko, penggantian dan kontensi unit terakhir, serta HTTP role/CSRF/DTO.
