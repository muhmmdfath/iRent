# No-show pickup dan delivery

Implementasi PRD §9: worker membatalkan **booking dikonfirmasi yang belum pernah serah terima**, setelah `now > noShowDueAt`. Batas tepat tiga jam masih dapat dilayani. Booking menunggu pembayaran/konfirmasi admin dan sewa berjalan tidak termasuk kandidat. Durasi memakai snapshot booking, bukan perubahan settings saat job berjalan.

## Pickup dan delivery

Pickup mengikuti `noShowDueAt` yang disimpan saat booking. Delivery memerlukan bukti operasional yang dicatat admin terlebih dahulu:

```http
POST /api/admin/bookings/:id/delivery/customer-failure
Content-Type: application/json
Idempotency-Key: delivery-failure-001
```

```json
{
  "readyAt": "2026-10-09T12:00:00+07:00",
  "customerFailureAt": "2026-10-09T13:00:00+07:00",
  "reason": "Petugas siap tetapi pelanggan tidak dapat ditemui."
}
```

Sesi admin, origin yang diizinkan, dan CSRF wajib. Petugas siap tidak boleh sebelum persetujuan booking atau setelah kegagalan pelanggan; kegagalan tidak boleh sebelum jadwal mulai atau di masa depan. Catatan adalah verifikasi admin atas kejadian sebenarnya, bukan bukti otomatis pelanggan bersalah.

Keterlambatan toko = `max(0, readyAt − initialStartAt)`. Durasi disimpan sebagai detik dibulatkan ke atas agar tidak memperpendek waktu pelanggan. Deadline delivery menjadi jadwal awal + durasi no-show snapshot + keterlambatan toko. Contoh jadwal 10.00, petugas baru siap 12.00: no-show baru berlaku setelah 15.00. Jadwal sewa awal tidak diubah oleh pencatatan ini; kompensasi start/end pada serah terima tersedia melalui [OPERATIONS.md](OPERATIONS.md).

Catatan menyimpan waktu/alasan, audit, dan outbox secara atomik. Retry dengan key/payload sama mengembalikan hasil tanpa perubahan. Bukti yang sudah diverifikasi tidak dapat ditimpa dengan key baru; koreksi bukti delivery belum tersedia pada tahap ini.

Delivery melewati batas tanpa catatan lengkap **tetap dikonfirmasi**, alokasi tetap terlindungi, dan DP tidak hangus. Worker mencatat `delivery.no_show_review` sekali per booking/deadline. `GET /api/admin/bookings/delivery-follow-up` menyediakan daftar aktif hingga 100 booking tertua untuk tindak lanjut admin. Alert review delivery tersimpan di outbox dan antrean follow-up; event khusus delivery.no_show_review belum dipetakan ke channel. Backend Web Push untuk pemicu PRD ?15 tersedia melalui [NOTIFICATIONS.md](NOTIFICATIONS.md).

## Dana, lock, dan worker

No-show menahan maksimal DP snapshot dari dana yang sudah diterapkan. Dana terverifikasi di atas DP dikembalikan: bagian applied memakai sumber application, sedangkan pelunasan sebagian/kelebihan yang belum diterapkan dikembalikan penuh tanpa duplikasi. Booking kecil wajib lunas dengan total ≤ DP hanya menahan total aktual. Refund sebelumnya dan cadangan refund lain tetap dilindungi oleh pemeriksaan sumber pada approval/transfer.

Jika bukti pelunasan masih pending saat no-show, dana tersebut belum dianggap diterima. Admin dapat merekonsiliasi kewajiban settlement pada booking yang sudah ditutup melalui API pembayaran. Receipt aktual menjadi refund penuh tanpa penerapan baru, perubahan biaya pembatalan, atau pengaktifan alokasi. Rekonsiliasi settlement tidak berlaku untuk booking aktif.

Tagihan disesuaikan menjadi nominal yang benar-benar ditahan; tidak membuat piutang sisa sewa yang batal. Snapshot perhitungan, status log, audit tanpa aktor untuk worker, refund request, dan pelepasan alokasi tersimpan dalam transaksi yang sama. Kesiapan fisik unit tidak diubah. Refund tetap disetujui dan ditransfer admin melalui [REFUNDS.md](REFUNDS.md).

`NO_SHOW_WORKER_ENABLED=true` mengaktifkan siklus setiap 60 detik, kecuali `NODE_ENV=test`. Tiap siklus memindai hingga 100 kandidat pembatalan dan 100 tindak lanjut delivery secara terpisah. Delivery yang sudah ditandai tidak memenuhi batch tindak lanjut berikutnya. Satu kegagalan booking tidak menghentikan batch; record yang gagal dapat dicoba ulang. Shutdown menunggu siklus aktif selesai.

Job membaca ulang status di bawah lock pemilik booking, item/unit terurut, booking/kewajiban, lalu receipt/refund. Worker lintas instance, pencatatan delivery, pembatalan manual, dan transaksi serah terima menggunakan protokol lock yang sama. Uji benturan mencakup transaksi fixture dan API bisnis serah terima melalui [OPERATIONS.md](OPERATIONS.md). Schema/migrasi tidak berubah.
