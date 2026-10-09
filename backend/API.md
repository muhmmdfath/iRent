# Kontrak API iRent

Prefix JSON API `/api`. Cookie sesi HttpOnly dikirim dengan `credentials: include`; baca token CSRF dari login/session. Mutasi memakai `Origin` terdaftar dan `X-CSRF-Token`. Aksi booking/pembayaran/refund/operasional/perpanjangan/koreksi memerlukan `Idempotency-Key`: ulangi kunci yang sama hanya untuk payload sama. Payload berbeda dengan kunci sama ditolak 409.

Rupiah berupa **string desimal**; gunakan BigInt untuk perhitungan, bukan Number. Waktu bisnis berupa ISO `+07:00`, contoh `2026-10-10T10:00:00+07:00`. Nilai tanpa offset, tanggal mustahil, dan offset lain ditolak 400. Jangan menggeser WIB dua kali. Error memakai format exception NestJS; autentikasi 401, role/CSRF 403, validasi 400, konflik 409, upload besar 413, rate limit 429.

## Dokumentasi dan endpoint

`GET /api/admin/api-docs` memberikan OpenAPI JSON melalui sesi admin; spesifikasi memuat route, DTO, role, cookie, multipart dan header. [openapi.json](openapi.json) adalah ekspor build; perbarui dengan `npm run api:export` memakai environment valid. Response domain yang berupa object hasil service dijelaskan dalam dokumen modul, sehingga skema response OpenAPI yang kosong tidak boleh diasumsikan sebagai response tanpa data.

| Area                              | Kontrak                                                        |
| --------------------------------- | -------------------------------------------------------------- |
| Login/profil                      | [AUTH.md](AUTH.md)                                             |
| Item, stok, zona, pricing         | [INVENTORY_PRICING.md](INVENTORY_PRICING.md)                   |
| Booking dan availability          | [BOOKINGS.md](BOOKINGS.md)                                     |
| Bukti, approval, ledger/pelunasan | [PAYMENTS.md](PAYMENTS.md)                                     |
| Refund/pembatalan/no-show         | [REFUNDS.md](REFUNDS.md), [NO_SHOW.md](NO_SHOW.md)             |
| Handover, return, denda, risiko   | [OPERATIONS.md](OPERATIONS.md), [LOSS_RISKS.md](LOSS_RISKS.md) |
| Perpanjangan                      | [EXTENSIONS.md](EXTENSIONS.md)                                 |
| Push/outbox                       | [NOTIFICATIONS.md](NOTIFICATIONS.md)                           |
| Dashboard/daftar/kalender         | [ADMIN_READS.md](ADMIN_READS.md)                               |
| Laporan/Excel                     | [REPORTS.md](REPORTS.md)                                       |
| Foto item/QRIS                    | [MEDIA.md](MEDIA.md)                                           |
| Koreksi receipt                   | [RECEIPT_CORRECTIONS.md](RECEIPT_CORRECTIONS.md)               |

## Integrasi UI

Status server tetap `menunggu_pembayaran ? menunggu_konfirmasi ? dikonfirmasi ? berjalan ? selesai`. Booking langsung tersedia untuk upload tanpa menunggu admin; UI dapat memakai label Dipesan, Menunggu verifikasi, dan Booked. Pembayaran mempunyai status terpisah dari booking. Pending proof tidak berarti kas diterima atau lunas.

Halaman detail memakai booking detail ditambah financial detail pada kontrak pembayaran; saldo scope perpanjangan terpisah. Invalidasi detail, daftar booking, availability, tasks, calendar, refund dan laporan setelah mutasi terkait. Daftar baru memakai `{data,total,page,limit}`; daftar booking lama tetap array sesuai BOOKING contract. Gunakan versi tugas untuk helper suara; notifikasi delivery adalah riwayat pengiriman, bukan daftar pekerjaan.

Jangan simpan response privat di cache service worker. URL bukti diperoleh melalui endpoint terlindungi sesuai ownership; `/media/` hanya menyajikan foto publik hasil sanitasi. Tidak ada endpoint CRUD untuk menghapus receipt atau mengganti jadwal melewati business action.

## Read model pelanggan

`GET /api/rental-policy` publik memberikan `{termsVersion, values}` dengan allowlist aturan pelanggan (jam buka/tutup, lead time, tenggat bayar/konfirmasi, durasi, DP, refund, denda dan perpanjangan). Pengaturan internal dan referensi rekening tidak diekspos.

`GET /api/bookings` tetap array dan menerima `page`, `limit`, `sort=oldest|newest|deadline` (default oldest), serta filter `status` opsional. Filter/order ini berlaku untuk daftar pelanggan dengan ownership server. Item dalam daftar/detail memuat `item.photoPath` publik.

Financial detail menambahkan `creditedAmount` dan `remainingAmount` pada setiap obligation. Kredit menghitung aplikasi reserved/applied net refund selesai; bukti pending tidak dihitung. Gunakan saldo obligation untuk nominal transfer berikutnya, bukan `amountDueNow` booking yang merupakan snapshot awal. Summary tetap memisahkan applied/reserved dan sisa seluruh tagihan.
