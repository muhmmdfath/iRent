# Booking dan alokasi

Implementasi mengikuti PRD §5–8: pelanggan membuat booking tanpa izin admin, kemudian membayar dalam deadline. Upload bukti dan verifikasi admin tersedia pada [PAYMENTS.md](PAYMENTS.md). Booking dibuat dengan status `menunggu_pembayaran`; upload belum berarti paid/lunas.

## API

Semua route membutuhkan sesi iRent. POST memakai JSON, Origin yang diizinkan, dan `X-CSRF-Token`.

| Route                                     | Akses dan fungsi                                                                       |
| ----------------------------------------- | -------------------------------------------------------------------------------------- |
| `POST /api/bookings/availability`         | Pelanggan; body quote dari INVENTORY_PRICING.md, memeriksa kalender tanpa menahan unit |
| `POST /api/bookings`                      | Pelanggan dengan profil lengkap; membuat booking dan hold atomik                       |
| `GET /api/bookings?page=1&limit=50`       | Riwayat booking milik pelanggan                                                        |
| `GET /api/bookings/:id`                   | Pemilik atau admin; item, kewajiban bayar, dan riwayat status                          |
| `GET /api/admin/bookings?page=1&limit=50` | Admin; urutan alokasi, tanpa antrean otomatis                                          |

Contoh body; ganti UUID dan pilih waktu WIB yang valid saat request diproses:

```json
{
  "startAt": "2026-10-10T10:00:00+07:00",
  "durationHours": 6,
  "items": [{ "itemId": "<UUID item>", "quantity": 1 }],
  "deliveryType": "pickup",
  "payOption": "dp",
  "termsVersion": "irent-phase1-v1",
  "agreeTerms": true,
  "prepareIdentity": true,
  "understandPayment": true,
  "agreeOperatingHours": true
}
```

Delivery membutuhkan `deliveryZoneId` aktif dan `deliveryAddress`. Ongkir dikenakan sekali. Harga, unit fisik, status, dan deadline ditetapkan server. Total tidak melebihi DP wajib dibayar penuh. Response rupiah berupa string desimal dan datetime ber-offset `+07:00`.

Header `Idempotency-Key` wajib, 1–128 karakter `[A-Za-z0-9._:-]`, misalnya UUID. Pertahankan key saat retry satu tindakan. Payload sama mengembalikan booking yang sama dengan kondisi terkininya, termasuk sesudah deadline. Payload berbeda dengan key sama menghasilkan 409. Urutan item/field dan kapitalisasi UUID dinormalisasi untuk hash. Transaksi gagal tidak meninggalkan key, alokasi, atau tagihan sebagian.

## Kalender dan transaksi

Urutan lock: pengguna → shared settings → item berurutan UUID → unit berurutan UUID → zona delivery → counter harian. Action alokasi berikutnya wajib mengikuti urutan ini; kunci yang tidak diperlukan boleh dilewati. Katalog/perawatan mengunci item sebelum unit. Quote mengunci settings, item secara shared, lalu zona. `ReadCommitted` memastikan pemeriksaan setelah menunggu membaca hasil commit terbaru. Lock timeout lima detik; deadlock/lock timeout dicoba ulang maksimal tiga percobaan.

FCFS memenangkan permintaan valid yang memperoleh alokasi dan berhasil commit; tidak menjamin urutan kedatangan HTTP. Unit dipilih menurut kode lalu UUID. Lock pelanggan melindungi batas satu iPhone pada seluruh interval penggunaan, termasuk perpanjangan dan keterlambatan.

Sewa baru dibandingkan dengan blok alokasi lama; jarak tepat satu jam diperbolehkan. Hold bayar habis tidak memblokir setelah `now > expiresAt`, tanpa menunggu worker. Pending verifikasi tetap melindungi unit. Unit terlambat atau pengembalian belum diverifikasi tetap tertahan. Persiapan memblokir pengambilan sebelum `preparationUntil`, tanpa mengubah fisik menjadi ready.

Lead dua hingga tiga jam inklusif mendapat deadline 30 menit; lebih dari tiga jam mendapat dua jam. Waktu dan ketersediaan diperiksa setelah lock, termasuk counter. Kode `IRNYYMMDD` memakai counter harian WIB, minimal tiga digit dan dapat bertambah panjang. Daftar memakai waktu pembuatan dan urutan counter ketika timestamp sama.

Satu transaksi menyimpan snapshot harga/zona/persetujuan, booking_item dan alokasi per unit, charge rental, charge delivery sekali, kewajiban DP/full, log, audit, idempotency, dan outbox `booking.created`. Kebijakan terdapat pada `rulesSnapshot.rules.values`. Pesan tidak dikirim di dalam transaksi.

## Batas tahap ini

Availability memeriksa stok kalender; tidak menjamin request berikutnya berhasil atau pelanggan memenuhi semua persyaratan booking. Permintaan kalah tidak menjadi antrean otomatis.

Worker expiry, adjustment tagihan, penutupan kewajiban, upload privat dan approval tersedia melalui modul payments. Hold kedaluwarsa tetap diabaikan saat alokasi sebelum worker sempat memperbarui status. Pembatalan dan refund manual tersedia melalui [REFUNDS.md](REFUNDS.md). No-show tersedia melalui [NO_SHOW.md](NO_SHOW.md). Serah terima/pengembalian, denda final dan persiapan tersedia melalui [OPERATIONS.md](OPERATIONS.md). Extension actions tersedia melalui [EXTENSIONS.md](EXTENSIONS.md); worker Web Push tersedia melalui [NOTIFICATIONS.md](NOTIFICATIONS.md). Provider WhatsApp dan UI belum tersedia.
