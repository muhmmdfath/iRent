# Integrasi PWA admin

Panel React sudah terpasang: `/admin/notifications` mengatur izin/langganan push dan riwayat pengiriman; beranda `/admin/` menampilkan tugas, aktivasi suara serta pengakuan lokal. Layout memasang manifest hanya saat sesi admin aktif. Implementasi memakai `src/admin/notifications/` dan aset `public/admin/*`.

Kontrol UI dan helper telah diuji otomatis. Pengiriman push ke perangkat fisik, pemasangan PWA, perilaku saat aplikasi ditutup/layar terkunci dan deployment HTTPS belum diverifikasi. Konfigurasi VAPID/worker diperlukan untuk pengiriman sebenarnya; tersedianya tombol tidak berarti perangkat sudah menerima notifikasi.

## Kontrak integrasi yang sudah diterapkan

1. Layout admin memakai `<link rel="manifest" href="/admin/manifest.webmanifest">` dan `<meta name="theme-color" content="#292B31">`.
2. Konfigurasi hosting mengarahkan `/admin` ke `/admin/`. Sajikan manifest, ikon dan `/admin/sw.js` secara publik tanpa redirect login. Service worker harus JavaScript, bukan fallback HTML. Prioritaskan file aset sebelum fallback route SPA.
3. Route admin serta detail booking/perpanjangan tetap membutuhkan sesi/role. Link notifikasi menuju `/admin/bookings/:id` atau `/admin/bookings/:id/extensions/:extensionId`; setelah login, router dapat melanjutkan ke tujuan yang berotorisasi.
4. Ambil konfigurasi public key dari `GET /api/admin/notifications/configuration`. Panel memanggil helper dari tombol aktivasi admin, bukan saat page load:

```js
import { enableAdminPush, disableAdminPush } from '/admin/push-client.js';

// Panggil langsung dalam handler klik "Aktifkan notifikasi".
await enableAdminPush({ apiBase: '', csrfToken, publicKey });

// Panggil pada tombol "Nonaktifkan notifikasi"; sebelum berpindah akun,
// nonaktifkan subscription akun lama selagi sesinya masih aktif.
await disableAdminPush({ apiBase: '', csrfToken });
```

`apiBase` kosong memakai API pada origin yang sama. Development lintas port memakai origin API eksplisit sesuai CORS; konfigurasi `VITE_*` tetap publik. CSRF berasal dari sesi iRent. Jangan memasukkan private VAPID key, NIK, rekening atau bukti pembayaran ke aset/PWA payload.

Service worker hanya menangani push dan click, tanpa fetch handler/cache offline untuk data operasional. Izin diminta melalui tindakan admin. Notifikasi memakai tag stabil, dan link dibatasi ke origin/scope admin.

Uji lewat HTTPS pada Android dan iPhone nyata: install, izinkan notifikasi, terima push saat aplikasi ditutup, klik ketika sesi aktif/berakhir, nonaktifkan subscription, serta izin ditolak. iPhone membutuhkan aplikasi di layar utama dan iOS yang mendukung Web Push; dukungan dimulai iOS 16.4 menurut [dokumentasi Apple](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers). Ini belum diverifikasi pada perangkat nyata.

## Pengingat mendesak dan suara

Phase 1 hanya PWA; WhatsApp ditunda. Backend menjadwalkan push H-30, H-15, H-5 dan overdue untuk booking/perpanjangan, tanpa mengirim tahap lama bersamaan. Setiap tahap memakai tag tersendiri; retry memakai tag yang sama.

`TasksPanel` di beranda admin memuat `createAdminAlertSound` dari `/admin/alert-sound.js`. Tombol "Aktifkan suara" memanggil `enable()` langsung dari klik. Setelah query tugas terkini yang berotorisasi, berikan `update([{key}])` hanya untuk tugas mendesak yang belum diputuskan. Key mencakup sumber + ID bukti + deadline. Jangan memakai riwayat delivery sebagai daftar tugas. Saat refresh gagal, logout atau sumber tidak relevan, kosongkan tugas; panggil `dispose()` ketika unmount. "Saya tangani" memanggil `acknowledge(key)`, hanya membisukan lokal tanpa approval pembayaran. Query ulang tugas secara berkala agar keputusan dari perangkat lain menghentikan bunyi. Layout menampilkan tugas overdue dengan merah dan teks terlambat; jangan mengandalkan warna saja.

Helper berbunyi tiap 10 detik hanya ketika tab terlihat. Pengakuan bersifat lokal per tab; reload/tab lain dapat mengingatkan kembali. Panel React tersedia: `/admin/notifications` untuk izin/langganan dan riwayat pengiriman, serta beranda `/admin` untuk seluruh tugas, kontrol suara dan pengakuan versi lokal. Logout admin menghapus subscription perangkat ini sebelum mencabut sesi. PWA tidak menjamin bunyi/getar atau alarm layar terkunci, tidak memaksa melewati senyap/Focus, dan push dapat terlambat. Uji kontrol suara, stop/pengakuan/versi proof baru, background, serta pengaturan perangkat saat integrasi.

## Acceptance perangkat dan hosting yang belum selesai

- [ ] Sajikan aplikasi melalui HTTPS dengan Origin, cookie dan aset service worker yang benar.
- [ ] Aktifkan konfigurasi VAPID/worker, pasang PWA dan izinkan notifikasi pada perangkat admin.
- [ ] Uji reminder booking/perpanjangan dan overdue dengan pengiriman nyata, klik notifikasi serta pemulihan sesi.
- [ ] Uji aktifkan suara, pengakuan versi tugas, pergantian halaman/tab dan logout.
- [ ] Uji aplikasi ditutup, layar terkunci serta mode senyap/Focus; catat perilaku perangkat tanpa menjanjikan alarm.

Checklist ini mencatat pemeriksaan eksternal; tes otomatis dengan mock PushManager/audio tidak menyelesaikannya.
