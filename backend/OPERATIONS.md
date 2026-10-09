# Serah terima dan pengembalian

Implementasi PRD §10 untuk serah terima booking, pengembalian per unit, denda final, dan persiapan/perawatan. Semua action memakai transaksi PostgreSQL, otorisasi server, CSRF/origin, dan `Idempotency-Key`. Uang berupa string rupiah; waktu ISO WIB ber-offset `+07:00`.

## Endpoint

Semua path diawali `/api`. `itemId` adalah **BookingItem.id**, bukan Item.id atau ItemUnit.id.

| Method/path                                                 | Akses dan fungsi                                                             |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------- |
| POST /admin/bookings/:id/settlement                         | Admin mencatat pelunasan aktual cash/transfer/QRIS                           |
| POST /admin/bookings/:id/handover                           | Admin menyerahkan seluruh unit booking                                       |
| POST /bookings/:id/items/:itemId/return-report              | Pemilik melaporkan unit sudah dikembalikan; body `{}`                        |
| POST /admin/bookings/:id/items/:itemId/return-report/reject | Admin menolak laporan; body `{ "reason": "Barang belum diterima di toko." }` |
| POST /admin/bookings/:id/items/:itemId/return/verify        | Admin memverifikasi penerimaan dan kondisi satu unit                         |
| POST /admin/units/:id/maintenance/complete                  | Admin menyelesaikan perawatan, mulai persiapan satu jam                      |
| POST /admin/units/:id/preparation/complete                  | Admin menjadikan unit ready setelah batas persiapan                          |

Detail booking memuat `items[].returnRecord`. Detail pembayaran memuat ledger, catatan pengembalian, dan daftar refund. Replay key/payload sama tidak mencatat ulang uang atau denda; hasil menampilkan keadaan terbaru. Payload berbeda dengan key sama ditolak.

## Pelunasan dan serah terima

Receipt mengikuti kontrak [PAYMENTS.md](PAYMENTS.md): `amount`, `occurredAt`, `method`, `note`, serta rekening/referensi wajib untuk transfer/QRIS. Cash tidak memakai referensi bank. Admin harus memeriksa penerimaan aktual. Dana sebagian tetap reserved; kelebihan membuat permintaan refund. Bukti pelunasan pending harus diputuskan sebelum memasukkan cash melalui action ini. Kewajiban pelunasan menghitung ulang saldo, termasuk denda baru setelah upload bukti; kewajiban pembayaran awal tetap memakai snapshot.

Contoh handover:

```json
{
  "pickedUpAt": "2026-10-09T10:00:00+07:00",
  "conditionNote": "Seluruh barang lengkap, fungsi dan kondisi sudah diperiksa."
}
```

Booking harus dikonfirmasi, seluruh unit allocated, sewa dan ongkir lunas dari **applied funds**, unit aktif/layak/ready, dan tidak sedang digunakan booking lain. Waktu tidak boleh sebelum persetujuan/jadwal/persiapan, di masa depan, atau di luar jam operasional. Serah terima mengubah booking menjadi berjalan, unit menjadi in_use, serta mencatat waktu, admin, kondisi, dan version secara atomik.

Pengantaran terlambat oleh toko wajib `shopDelayReason`. Start/end efektif bergeser sebesar keterlambatan terverifikasi; initial start/end, tarif, dan tagihan tetap. Kalender, buffer snapshot, aturan satu iPhone, serta jam operasional diperiksa ulang. Benturan menolak seluruh handover tanpa menghapus uang yang sebelumnya diterima; admin dapat memakai pembatalan oleh toko dan refund 100%. Penggantian unit tersedia melalui LOSS_RISKS.md. Pickup terlambat oleh pelanggan tidak menggeser jadwal.

## Pengembalian dan denda

Laporan pelanggan hanya mengubah unit booking menjadi return_pending. Unit fisik tetap in_use dan alokasi tetap aktif. Admin dapat menolak/resubmit laporan atau memverifikasi langsung setelah menerima barang, termasuk tanpa laporan pelanggan.

```json
{
  "receivedAtStore": "2026-10-09T18:00:00+07:00",
  "condition": "layak",
  "conditionNote": "Barang lengkap dan fungsi telah diperiksa.",
  "damageAmount": "0"
}
```

- `condition`: `layak` atau `maintenance`. Kerusakan positif wajib `damageNote` dan dicatat terpisah dari denda keterlambatan.
- Untuk delivery, opsional `receivedByCourierAt` adalah waktu petugas menerima barang. Harus setelah handover dan tidak lebih akhir dari penerimaan toko. Denda berhenti pada waktu petugas; perjalanan ke toko tidak menambah denda. Pickup memakai penerimaan toko.
- Toleransi dan tarif memakai snapshot booking: default 60 menit dan Rp10.000/unit/jam. Setelah toleransi, setiap jam yang mulai terpakai dibulatkan ke atas. Waktu verifikasi admin tidak memperpanjang denda.
- Opsional `exemptions` berisi `{type: "admin"|"courier", from, to, reason}` untuk keterlambatan pihak toko. Interval dipotong ke periode denda dan digabung agar overlap tidak dipotong dua kali. Courier hanya untuk delivery. Interval asli, alasan, snapshot, dan hasil final tersimpan pada audit.
- Verifikasi menutup pemakaian dan melepas alokasi **unit tersebut**. Unit lain tetap berjalan. Booking selesai ketika semua unit returned/lost_closed; sisa denda masih dapat dibayar setelah booking selesai.
- Proposal perpanjangan pending yang melibatkan unit tersebut dibatalkan **seluruh proposalnya**, termasuk hold unit lainnya. Jadwal awal unit lain tidak berubah. Aplikasi dana tambahan dilepas dan receipt aktual mendapat permintaan refund 100%, dengan extensionId yang tetap terpisah dari saldo awal. Rekening, approval, dan transfer tetap manual melalui [REFUNDS.md](REFUNDS.md). Bukti yang belum diverifikasi tidak dianggap uang masuk.

## Persiapan dan batas tahap

Unit layak menjadi preparing selama **satu jam sejak verifikasi admin**, kemudian admin menyelesaikan persiapan. Tidak ada pelepasan fisik otomatis. Unit maintenance menjadi awaiting_check; setelah perawatan selesai, mulai persiapan satu jam yang baru. Batas ini tidak mengikuti perubahan buffer kalender. Kesiapan fisik tidak bergantung pada pelunasan denda pelanggan sebelumnya; ketersediaan kalender tetap diperiksa terpisah.

Kehilangan/kompensasi, penggantian unit dan tindak lanjut risiko tersedia melalui [LOSS_RISKS.md](LOSS_RISKS.md). Koreksi receipt masuk tersedia melalui RECEIPT_CORRECTIONS.md; WhatsApp ditunda dan UI mengikuti tahap frontend. Pengembalian tidak membatalkan booking pelanggan berikutnya secara otomatis. Perpanjangan lengkap dan koreksi denda akibat pemeriksaan terlambat tersedia melalui [EXTENSIONS.md](EXTENSIONS.md). Event bisnis tersimpan pada outbox; backend Web Push tersedia melalui [NOTIFICATIONS.md](NOTIFICATIONS.md).

## Verifikasi

`npm test` menguji batas denda, BIGINT, dan gabungan pengecualian. `npm run test:db` memakai PostgreSQL khusus pengujian untuk pembayaran sebagian/lebih, handover/no-show bersamaan, benturan kompensasi jadwal, laporan/review, pengembalian sebagian, reviewer bersamaan, maintenance/persiapan, pelunasan setelah denda baru, pembatalan proposal perpanjangan dan refund manual, serta HTTP role/CSRF/DTO.

## Koreksi pengembalian terverifikasi

`POST /api/admin/bookings/:id/items/:itemId/return/correct`, admin/Origin/CSRF dan Idempotency-Key. Body: receivedAtStore, receivedByCourierAt opsional, conditionNote, damageAmount, damageNote bila nonzero, exemptions opsional, reason wajib. Koreksi memakai waktu WIB valid, urutan fisik dan aturan snapshot yang sama.

Receipt/charge lama tetap tersimpan. Selisih late/damage menambah debit/credit adjustment yang terhubung ke charge asal; replay tidak menambah adjustment. Audit menyimpan before/after. Return tetap verified dengan verifiedAt/actor awal; status booking, alokasi, kesiapan fisik dan preparationUntil tetap mengikuti tindakan operasional yang sudah dilakukan. Koreksi catatan kondisi/biaya tidak melakukan verifikasi fisik ulang.

Exemptions yang tidak dikirim mempertahankan snapshot manual; array kosong menghapus pengecualian manual secara eksplisit. Pengecualian pemeriksaan perpanjangan dihitung ulang, dan interval overlap memakai union agar tidak dihitung dua kali. Migrasi return_exemptions menyimpan interval dan mempertahankan interval lama dari audit.

Refund awal yang masih diajukan/disetujui perlu diperiksa dahulu (409); jangan mengubah hak dana yang sedang dicadangkan. Penurunan tagihan yang sudah dibayar membuat pengajuan refund manual atas kelebihan applied, tanpa langsung mengurangi kas. Tagihan yang meningkat menjadi saldo belum lunas. Perubahan kondisi fisik saat ini tetap dilakukan melalui tindakan perawatan/persiapan.
