# Katalog, settings, dan pricing

Semua path menggunakan prefix /api. Mutasi admin dan quote memakai cookie/CSRF sesuai [AUTH.md](AUTH.md). Nominal rupiah pada request/response memakai string desimal; quantity dan durasi memakai integer.

## Endpoint

| Method/path                                | Akses dan fungsi                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------- |
| GET /items, /items/:id                     | Publik: katalog aktif; list menerima page/limit                           |
| GET /delivery-zones                        | Publik: zona aktif, ongkir antar-jemput sekaligus                         |
| GET /admin/items                           | Admin: katalog aktif/nonaktif dan ringkasan unit                          |
| POST /admin/items                          | Admin: category, name, includes[], price6h/12h/24h, photoPath opsional    |
| PATCH /admin/items/:id                     | Admin: metadata, harga, isActive; kategori tetap                          |
| GET /admin/items/:id/units                 | Admin: unit fisik, page/limit                                             |
| POST /admin/items/:id/units                | Admin: quantity untuk aksesori, codes[] untuk iPhone                      |
| PATCH /admin/units/:id/active              | Admin: isActive; hanya unit bebas/layak/ready tanpa alokasi aktif         |
| POST /admin/units/:id/maintenance          | Admin: reason; perawatan unit bebas                                       |
| POST /admin/units/:id/maintenance/complete | Admin: selesai perawatan, masuk persiapan                                 |
| POST /admin/units/:id/preparation/complete | Admin: ready setelah deadline, kondisi layak dan tanpa sewa belum kembali |
| GET/POST /admin/delivery-zones             | Admin: daftar atau buat zona dengan name/fee/isActive                     |
| PUT /admin/delivery-zones/:id              | Admin: perbarui name/fee/isActive                                         |
| GET/PATCH /admin/settings                  | Admin: baca atau ubah dengan body {values:{key:value}}                    |
| POST /pricing/quote                        | Customer: rincian harga/snapshot dan validasi jadwal                      |

Page mulai 1, limit default 50/maksimal 100. Includes merupakan array teks. Gambar menerima path publik /media/items/filename.png atau /media/qris/filename.png (juga jpg/jpeg/webp); upload dan penyajian file media belum diimplementasikan.

## Stok dan riwayat

Stok berasal dari item_units. activeUnitCount menghitung unit aktif/layak; readyPhysicalCount menghitung yang fisiknya ready. Response menyatakan availabilityChecked=false. Angka ini belum mengecek bentrok pada tanggal tertentu. Item in_use yang layak tetap dapat menjadi kandidat kalender mendatang pada mesin availability berikutnya.

Kode aksesori otomatis memakai counter global ACC000001 dan dapat bertambah panjang; kode ACC numerik dicadangkan untuk aksesori. Kode iPhone dinormalisasi uppercase dan unique. Pembuatan batch atomik, termasuk counter dan audit. Tidak ada hard delete unit/transaksi: penurunan stok menonaktifkan unit bebas. Alokasi active tetap memblokir penonaktifan meskipun hold waktunya lewat sampai lifecycle expiry melepaskannya.

Perawatan membutuhkan unit ready tanpa alokasi aktif. Selesai perawatan menjadi preparing selama buffer_minutes (default satu jam), lalu action selesai persiapan memeriksa ulang deadline/kondisi. Tidak ada CRUD bebas untuk physicalStatus, itemId, atau kode unit. Serah terima, return, kehilangan, worker, dan alokasi kalender dikerjakan dalam tahap berikutnya.

## Quote dan snapshot

Contoh body:

```json
{
  "startAt": "2026-10-20T10:00:00+07:00",
  "durationHours": 6,
  "items": [{ "itemId": "<UUID>", "quantity": 1 }],
  "deliveryType": "pickup",
  "payOption": "dp"
}
```

Ganti UUID dan jadwal dengan data valid saat menjalankan. Delivery membutuhkan deliveryZoneId aktif; pickup tidak menerima zona. Address dan persetujuan diperiksa saat booking. Item duplikat harus digabung ke quantity. Maksimal satu iPhone; aksesori saja boleh. Quote belum memeriksa profil lengkap, batas iPhone lintas booking, atau stok pada jadwal.

Harga 6/12 jam memakai tarif paket; kelipatan 24 jam memakai jumlah hari × tarif 24 jam hingga 168 jam. Tidak ada perbedaan weekday/weekend. Ongkir ditambahkan sekali. DP flat dari settings; total <= DP dipaksa full sesuai total. Semua operasi uang memakai bigint dan menolak total di luar rentang PostgreSQL BIGINT.

Jadwal menggunakan WIB eksplisit, minimal lead time, jam ambil/kembali, dan pembukaan bulan berdasarkan booking_open_day. Snapshot versi 1 berisi revisi settings, seluruh tarif 6/12/24 tiap item, quantity, dan zona/harga ongkir. Harga katalog/settings baru tidak mengubah transaksi tersimpan. Quote adalah preview; createBooking harus menghitung ulang di transaksi alokasi, menyimpan snapshot, serta mengunci pelanggan/unit. Response quote tidak menahan stok atau menjamin ketersediaan.

## Transaksi dan konfigurasi

Settings memvalidasi tipe, uang, jam buka/tutup, tanggal 1–28, persentase, durasi maksimal, dan hubungan deadline. Semua perubahan harus melalui SettingsService; shared/exclusive advisory lock menjaga pembacaan satu versi. Counter settings.revision membatalkan cache lintas instance; nilai hasil update tidak dimasukkan cache sebelum commit. Seed memakai default yang sama dan mempertahankan nilai admin.

Mutasi memeriksa auth di bawah user lock. Urutan inventory: user → settings jika diperlukan → item → unit → alokasi. Quote: shared settings → item berurutan → zona. Jalur booking berikutnya wajib mengikuti protokol kompatibel dan memeriksa keadaan setelah memperoleh lock; jangan menulis stok melalui CRUD lain. Perubahan settings diaudit per key dengan nilai sebelum/sesudah, revisi, dan ID setting yang benar.

Tes mencakup perhitungan uang/jadwal, dua admin membuat aksesori bersamaan, otorisasi, snapshot lama, cache lintas instance, penonaktifan unit teralokasi, serta perawatan/persiapan. File tes database dijalankan serial pada database khusus; skenario konkurensi dijalankan secara eksplisit di dalam tes.
