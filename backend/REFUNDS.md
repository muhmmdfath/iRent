# Pembatalan dan refund manual

Implementasi PRD §9 untuk pembatalan seluruh booking sebelum serah terima dan refund awal/pelunasan. No-show, refund perpanjangan, dan koreksi receipt belum tersedia.

## Kontrak API

Semua POST membutuhkan sesi, origin yang diizinkan, CSRF, dan `Idempotency-Key`. Gunakan JSON kecuali transfer. Hasil action berisi booking dan summary pembayaran terbaru; daftar refund tersedia melalui `GET /api/bookings/:id/payments`. Pelanggan hanya dapat mengakses booking miliknya.

| Route                                   | Fungsi                                                                              |
| --------------------------------------- | ----------------------------------------------------------------------------------- |
| `POST /api/bookings/:id/cancel`         | Pelanggan membatalkan seluruh booking; `{ "reason": "Jadwal perjalanan berubah." }` |
| `POST /api/admin/bookings/:id/cancel`   | Pembatalan operasional toko, refund seluruh uang aktual                             |
| `POST /api/refunds/:id/recipient`       | Pelanggan melengkapi rekening untuk permintaan refund                               |
| `POST /api/admin/refunds/:id/recipient` | Admin mencatat rekening yang telah dipastikan bersama pelanggan                     |
| `POST /api/admin/refunds/:id/approve`   | Setujui nominal hak refund dari server, tanpa mencatat uang keluar                  |
| `POST /api/admin/refunds/:id/reject`    | Tolak permintaan dengan `reason` wajib                                              |
| `POST /api/admin/refunds/:id/transfer`  | Catat transfer manual dan selesaikan refund secara atomik                           |
| `GET /api/refunds/:id/file`             | Download bukti transfer privat oleh pemilik booking/admin                           |

Rekening: `{ "bankName": "BCA", "accountNumber": "1234567890", "accountHolder": "Nama Pelanggan" }`. Nomor rekening disimpan sebagai string, termasuk nol di depan. Rekening wajib lengkap sebelum approval dan tidak dapat berubah setelah keputusan. Permintaan dibuat dari hak refund saat pembatalan, kelebihan, expiry, atau rekonsiliasi; pelanggan melengkapi rekening, bukan menentukan nominal/sumber dana sendiri.

Transfer memakai multipart `file`, `amount` (string rupiah), `transferredAt` (ISO WIB `+07:00`, boleh milidetik), `transactionReference`, dan `note`. Nominal wajib tepat sama dengan approval; phase 1 tidak mendukung transfer sebagian. Waktu harus antara persetujuan dan waktu server. Bukti JPG/PNG/PDF maksimal 2 MB memakai penyimpanan privat dan throttle yang sama dengan bukti pembayaran. Path file tidak dikirim dalam response JSON. Bank/reference dinormalisasi dan dideduplikasi lintas pelanggan serta receipt.

## Perhitungan dan konsistensi

- Snapshot booking menentukan cutoff: lebih dari 48 jam mendapat 50% dana DP yang diterapkan atau 75% pembayaran penuh yang diterapkan. Tepat 48 jam atau kurang mendapat 0%. DP yang kemudian dilunasi mengikuti kategori penuh; booking kecil wajib lunas juga mengikuti kategori penuh.
- Pembulatan half-up dilakukan sekali pada total menggunakan BIGINT; pembagian sumber mengikuti urutan UUID application yang stabil. Snapshot refund menyimpan kategori, persentase, cutoff, total tagihan/dana sebelum adjustment, dan sumber serta batas nominal tiap application. Audit pembatalan menyimpan perhitungan yang sama, termasuk saat refund nol sehingga tidak ada permintaan refund.
- Dana pelunasan sebagian yang masih reserved, kelebihan, dan receipt rekonsiliasi dikembalikan penuh. Dana tersebut tidak dihitung lagi dalam dasar persentase.
- Charge awal/snapshot tetap utuh. Adjustment mengurangi tagihan menjadi biaya pembatalan yang benar-benar ditahan. Contoh tagihan Rp50.000/DP Rp20.000 dibatalkan lebih awal: tagihan sah Rp10.000, refund Rp10.000, tanpa piutang Rp30.000. Application refundable tetap tercatat sampai transfer; setelah transfer, bagian terkait dikurangi dari applied. Refund kelebihan tidak mengurangi applied DP.
- Pembatalan menutup kewajiban dan melepas kalender tanpa mengubah status fisik unit. Barang yang pernah diserahterimakan tidak dapat dibatalkan melalui action ini. Bukti pending pada kewajiban yang ditutup tetap historis, tanpa dianggap telah diperiksa admin. Admin dapat merekonsiliasi uang masuk kemudian, termasuk bukti tersebut, tanpa menghidupkan kembali booking.
- Urutan lock mengikuti pembayaran: actor, pemilik booking, item/unit terurut, booking/kewajiban, lalu receipt/refund terurut. Semua keputusan membaca ulang di dalam transaksi. Approval/transfer memeriksa sumber aktual, dana yang masih diterapkan, batas snapshot, dan refund lain yang telah disetujui/selesai.
- Approval tidak mengurangi kas. Transfer membuat satu `Payment` uang keluar dan status `sudah_dikembalikan` sekaligus, dengan audit/outbox. Idempotensi, unique refund/payment, dan lock mencegah pencatatan ganda. Admin tetap memeriksa transfer bank aktual sebelum mengulangi transfer di luar aplikasi.

Schema/migrasi tidak berubah; menggunakan `RefundRequest`, `RefundSource`, `Payment`, dan constraint yang sudah tersedia. Event baru disimpan dalam outbox; pengirim PWA/WhatsApp masih tahap berikutnya.
