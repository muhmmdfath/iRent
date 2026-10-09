# Notifikasi admin dan Web Push

Implementasi mengikuti PRD bagian 15. Outbox disimpan bersama transaksi bisnis; pengiriman terjadi setelah commit. Sender Web Push tersedia. WhatsApp ditunda dari phase 1 berdasarkan keputusan 9 Oktober 2026; adapter tetap nonaktif dan tidak ada antrean WhatsApp baru.

## Konfigurasi dan deployment

Jalankan `npm run db:deploy` untuk migrasi `202610090001_notification_leases`, kemudian build API. Migrasi menambah context snapshot, token lease dan waktu kedaluwarsa lease pada delivery; riwayat lama dipertahankan. Tidak memakai `db push`.

Isi environment backend:

```dotenv
NOTIFICATION_WORKER_ENABLED=true
VAPID_PUBLIC_KEY=<public-key>
VAPID_PRIVATE_KEY=<private-key>
VAPID_SUBJECT=mailto:admin@example.com
```

Buat pasangan VAPID sekali, misalnya `npx --no-install web-push generate-vapid-keys`, dan simpan private key di secret environment. Kunci harus berpasangan dan subject valid; startup menolak konfigurasi parsial. Public key boleh diberikan kepada browser. Default worker false; konfigurasi kosong tidak melakukan request provider atau menghabiskan percobaan. NODE_ENV=test selalu menonaktifkan timer. Hanya aktifkan worker setelah penerima dan akun deployment sesuai.

Worker setiap menit memproses paling banyak 100 outbox, menjadwalkan paling banyak 100 booking dan 100 extension per halaman dengan cursor berputar, lalu mengambil paling banyak 100 delivery pada kanal yang siap. Pengiriman berjalan maksimal empat request bersamaan, timeout push 15 detik dan lease 60 detik. Instance bersamaan menggunakan row lock/SKIP LOCKED serta token lease. Gagal satu sumber tidak membatalkan transaksi booking atau menghentikan sumber lainnya. Kegagalan outbox dicatat dan dibatasi tiga percobaan.

## API admin

Semua endpoint di `/api/admin/notifications` membutuhkan sesi admin. Mutasi memakai Origin, JSON dan CSRF seperti API lainnya.

| Method/path             | Fungsi                                                                                    |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| GET `/configuration`    | `{enabled,publicKey}`; enabled berarti VAPID dikonfigurasi, bukan konfirmasi worker aktif |
| POST `/subscriptions`   | `{endpoint,keys:{p256dh,auth}}`; daftarkan perangkat admin saat ini                       |
| DELETE `/subscriptions` | `{endpoint}`; hapus milik akun sendiri                                                    |
| GET `?page=1&limit=20`  | Riwayat delivery admin sendiri, status, attempts, retryAt dan error yang disanitasi       |

Endpoint dan kunci subscription bersifat privat. Subscription unique per endpoint; akun lain tidak boleh mengambil kepemilikan. Key P-256/auth divalidasi dan endpoint dibatasi ke layanan push browser yang diizinkan untuk mencegah request ke jaringan privat. Daftar host berada di `push.rules.ts`; dukungan browser baru memerlukan verifikasi host. Respons provider 404/410 menghapus subscription lama tanpa menghapus pembaruan key yang lebih baru.

## Pemicu, deadline, dan retry

Push: booking baru, bukti awal/perpanjangan, quotation penjemputan, laporan return dan risiko unit. Booking dan extension mendapat pengingat pada 30, 15 dan 5 menit sebelum batas konfirmasi. Setiap tahap dideduplikasi tersendiri. Tahap lama dilewati ketika tahap berikutnya sudah mulai, termasuk saat retry: H-30 berlaku sampai H-15, H-15 sampai H-5, H-5 sampai deadline. Worker terlambat tidak mengirim semua tahap sekaligus. Pengambilan tinggal 20 menit dan konfirmasi terlambat juga memakai push. Alert overdue diproses sekali selama sumber masih relevan. Kalender tetap tertahan ketika admin terlambat.

Delivery menyimpan deadline, ID bukti terbaru dan source ID. Deduplikasi mencakup sumber, versi bukti/deadline, admin, kanal, dan perangkat push. Upload ulang tetap menjadi versi baru meski deadline capped pada jam yang sama. Status booking/proposal, bukti pending, laporan return, risiko dan akses admin dibaca ulang sebelum setiap pengiriman. Keputusan admin, pergantian unit, proof lama dan akun nonaktif membuat task tidak relevan dilewati.

Retry maksimal tiga percobaan, dengan jeda satu lalu lima menit. Error permanen tidak diulang. Lease kedaluwarsa dapat dipulihkan tanpa mengulang transaksi bisnis. `sent` berarti provider menerima request, bukan bukti notifikasi terlihat atau dibaca. Push TTL 60 detik membatasi umur pesan di provider. Crash setelah provider menerima tetapi sebelum hasil tersimpan dapat menghasilkan pengiriman ulang; tag notifikasi stabil mengurangi notifikasi visual ganda. Jangan mengklaim exactly-once pada provider eksternal. Adapter WhatsApp terpilih nanti harus memakai idempotensi provider bila tersedia.

Tidak membuat task WhatsApp baru selama penundaan. Riwayat/task lama dipertahankan; adapter bawaan ready=false sehingga tidak dikirim atau menghabiskan attempts. Aktivasi kembali harus meninjau relevansi antrean dan keputusan provider terlebih dahulu.

## PWA dan verifikasi

Aset ada di [frontend/public/admin](../frontend/public/admin/): manifest, ikon PNG 192/512, service worker dan helper aktivasi. Panduan integrasi di [frontend/PWA.md](../frontend/PWA.md). Frontend/panel admin belum dibangun; aset ini belum menjadi aplikasi yang terpasang. HTTPS, redirect `/admin` ke `/admin/`, route berotorisasi, tombol izin, dan tes Android/iPhone nyata tetap wajib saat integrasi frontend.

`npm test` memeriksa host/key/VAPID, adapter error/timeout, manifest/ikon, push/click dan larangan cache offline. `npm run test:db` memeriksa langganan/CSRF, ownership, dispatch/sender bersamaan, deadline dan versi proof, skip setelah keputusan, retry, recovery lease, endpoint kedaluwarsa, scope extension, dan isolasi event invalid. Tidak ada request provider nyata dalam tes.

Referensi: [web-push resmi](https://github.com/web-push-libs/web-push), [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API), dan [Apple Web Push](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers).

Kontrol suara dashboard aktif tersedia sebagai helper `frontend/public/admin/alert-sound.js`, belum terpasang dalam panel React. Bunyi tiap 10 detik setelah klik aktivasi, berhenti saat tab tersembunyi, dinonaktifkan, tugas tidak relevan, logout/unmount, atau "Saya tangani". Acknowledgement lokal hanya membisukan versi tugas pada tab tersebut dan tidak mengubah booking/pembayaran; reload/tab lain dapat berbunyi kembali. Tidak ada jaminan alarm ketika aplikasi ditutup/layar terkunci.
