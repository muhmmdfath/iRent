# Read API admin

Semua endpoint di bawah membutuhkan sesi admin; memakai pagination `page=1`, `limit=50`, maksimal 100, dan response `{data,total,page,limit}`. Rupiah/string dan WIB mengikuti [API.md](API.md).

- `GET /api/admin/customers?search=...`: pencarian nama/email/telepon, akun, completedAt profil dan jumlah booking. NIK/password tidak dikirim. NIK hanya melalui detail pelanggan yang diaudit.
- `GET /api/admin/accounts?search=...`: daftar akun admin dengan field aman yang sama.
- `GET /api/admin/refunds?status=disetujui&bookingId=<uuid>`: filter opsional; jumlah diminta/disetujui, waktu approval/transfer, alasan, kode booking/nama pelanggan. Rekening penerima dan bukti privat tidak disebar pada daftar. Gunakan detail finansial booking untuk memprosesnya.
- `GET /api/admin/extensions?status=disetujui&bookingId=<uuid>`: snapshot quotation, deadline, unit/end time, kode booking/pelanggan.

## Antrean pekerjaan

`GET /api/admin/tasks?kind=all` membaca state bisnis langsung, bukan tabel delivery notifikasi. Jenis filter: `payment`, `return`, `extension_quote`, `refund`, `preparation`, `handover`. Quotation hilang dari antrean setelah admin memberi harga; refund hilang setelah keputusan terminal. Persiapan tetap muncul sampai admin menyelesaikannya.

Baris: `{id,kind,bookingId,code,dueAt,changedAt,status,overdue,version}`; response menambah `asOf`. `version` adalah hash identitas/state/deadline agar pengakuan suara lama tidak membungkam tugas baru. `overdue` berarti melewati dueAt, bukan perubahan status otomatis. Baca ulang setelah tindakan. Kalender dan pemindaian risiko adalah API terpisah.

## Kalender per unit

`GET /api/admin/calendar?startAt=<ISO WIB>&endAt=<ISO WIB>&itemId=<uuid>`; rentang positif maksimal 31 hari, item opsional. Query string wajib meng-encode tanda `+`. Pagination berlaku pada unit.

Baris memuat item/foto, status fisik/kondisi, preparationUntil, indikator penggunaan terlambat, dan alokasi dengan booking/kode, interval sewa, interval blocking, jenis dan status owner. Hold expired tanpa proof diabaikan; pending konfirmasi tetap melindungi alokasi. Tidak ada alamat/NIK/proof path. Physical readiness dan kalender dipisahkan; availability final tetap diperiksa pada business action di dalam lock. Maksimal 10.000 alokasi per response; persempit rentang bila melebihi batas.
