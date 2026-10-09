# Koreksi receipt masuk

Keputusan pengguna: receipt asli dipertahankan; koreksi menambah pembalik pencatatan dan receipt pengganti, menghitung ulang saldo, serta mempertahankan status/jadwal booking yang sudah berjalan.

`POST /api/admin/bookings/:id/payments/:paymentId/correct`, sesi admin/Origin/CSRF dan Idempotency-Key. Body mengikuti ReceiptDto (`amount`, `occurredAt`, `method`, rekening/referensi untuk transfer/QRIS, `note`) ditambah `reason` wajib 5?1000 karakter. Amount positif dan waktu aktual tidak boleh di masa depan. Response financial detail dan `decision` berupa correction ID.

Dalam transaksi dengan lock actor/customer/item/unit/booking/obligation/payment/refund:

1. Periksa receipt masuk aktif, scope booking dan cadangan refund. Receipt yang sudah diganti ditolak 409; koreksi berikutnya diarahkan ke pengganti terbaru.
2. Tandai metadata `supersededAt`; nominal, waktu, metode, referensi dan catatan receipt lama tetap utuh. Lepaskan penerapan dana lama dengan riwayat tersimpan.
3. Buat receipt pengganti pada kewajiban/scope sama dan `receipt_corrections` yang memuat original/replacement, reversalAmount, reversalEffectiveAt dan alasan. Referensi bank aktif tetap unik.
4. Hitung penerapan dana baru sampai batas kewajiban. Booking/perpanjangan pending tetap membutuhkan approval eksplisit; kurang bayar pada booking aktif muncul sebagai sisa tagihan. Kelebihan menambah pengajuan refund manual.
5. Simpan audit before/after. PostgreSQL menolak perubahan data receipt/koreksi dan koreksi yang masih membiayai aplikasi atau refund. Retry identik mengembalikan satu hasil; koreksi serentak berbeda hanya satu yang sah.

Receipt yang menjadi sumber refund diajukan/disetujui/selesai ditolak 409. Admin dapat menolak pengajuan yang belum ditransfer dengan alasan setelah pemeriksaan, lalu mengoreksi receipt. Refund yang sudah ditransfer dan receipt uang keluar tidak dibalik lewat endpoint ini. Koreksi dapat dibackdate dengan alasan; laporan menggunakan waktu pengganti dan menampilkan jejak pembalik.

Kekurangan sewa awal memakai `/api/admin/bookings/:id/settlement`; kekurangan perpanjangan disetujui memakai endpoint sama dengan `extensionId`. Pelunasan selalu berada dalam scope yang dipilih, tanpa DP baru atau perubahan jadwal.

Migrasi `202610090002_receipt_corrections` menambah entitas, FK scope/uniqueness, guard immutable, validasi reversal deferred dan indeks laporan/antrean. Jalankan migrate deploy dan generate sebelum menjalankan kode baru.
