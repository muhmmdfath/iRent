# Integrasi PWA admin

Direktori ini baru memuat aset PWA dan helper, belum aplikasi React/Vite. Saat frontend dibangun, Vite menyajikan `public/admin/*` pada `/admin/*`.

1. Layout admin memakai `<link rel="manifest" href="/admin/manifest.webmanifest">` dan `<meta name="theme-color" content="#F28CB1">`.
2. Konfigurasi hosting mengarahkan `/admin` ke `/admin/`. Sajikan manifest, ikon dan `/admin/sw.js` secara publik tanpa redirect login. Service worker harus JavaScript, bukan fallback HTML. Prioritaskan file aset sebelum fallback route SPA.
3. Route admin serta detail booking/perpanjangan tetap membutuhkan sesi/role. Link notifikasi menuju `/admin/bookings/:id` atau `/admin/bookings/:id/extensions/:extensionId`; setelah login, router dapat melanjutkan ke tujuan yang berotorisasi.
4. Ambil konfigurasi public key dari `GET /api/admin/notifications/configuration`. Hubungkan helper ke tombol admin yang nyata, bukan saat page load:

```js
import { enableAdminPush, disableAdminPush } from "/admin/push-client.js";

// Panggil langsung dalam handler klik "Aktifkan notifikasi".
await enableAdminPush({ apiBase: "", csrfToken, publicKey });

// Panggil pada tombol "Nonaktifkan notifikasi"; sebelum berpindah akun,
// nonaktifkan subscription akun lama selagi sesinya masih aktif.
await disableAdminPush({ apiBase: "", csrfToken });
```

`apiBase` kosong memakai API pada origin yang sama. Development lintas port memakai origin API eksplisit sesuai CORS; konfigurasi `VITE_*` tetap publik. CSRF berasal dari sesi iRent. Jangan memasukkan private VAPID key, NIK, rekening atau bukti pembayaran ke aset/PWA payload.

Service worker hanya menangani push dan click, tanpa fetch handler/cache offline untuk data operasional. Izin diminta melalui tindakan admin. Notifikasi memakai tag stabil, dan link dibatasi ke origin/scope admin.

Uji lewat HTTPS pada Android dan iPhone nyata: install, izinkan notifikasi, terima push saat aplikasi ditutup, klik ketika sesi aktif/berakhir, nonaktifkan subscription, serta izin ditolak. iPhone membutuhkan aplikasi di layar utama dan iOS yang mendukung Web Push; dukungan dimulai iOS 16.4 menurut [dokumentasi Apple](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers). Ini belum diverifikasi pada perangkat nyata.

## Pengingat mendesak dan suara

Phase 1 hanya PWA; WhatsApp ditunda. Backend menjadwalkan push H-30, H-15, H-5 dan overdue untuk booking/perpanjangan, tanpa mengirim tahap lama bersamaan. Setiap tahap memakai tag tersendiri; retry memakai tag yang sama.

Integrasikan `createAdminAlertSound` dari `/admin/alert-sound.js` pada layout admin. Tombol "Aktifkan suara" memanggil `enable()` langsung dari klik. Setelah query tugas terkini yang berotorisasi, berikan `update([{key}])` hanya untuk tugas mendesak yang belum diputuskan. Key mencakup sumber + ID bukti + deadline. Jangan memakai riwayat delivery sebagai daftar tugas. Saat refresh gagal, logout atau sumber tidak relevan, kosongkan tugas; panggil `dispose()` ketika unmount. "Saya tangani" memanggil `acknowledge(key)`, hanya membisukan lokal tanpa approval pembayaran. Query ulang tugas secara berkala agar keputusan dari perangkat lain menghentikan bunyi. Layout menampilkan tugas overdue dengan merah dan teks terlambat; jangan mengandalkan warna saja.

Helper berbunyi tiap 10 detik hanya ketika tab terlihat. Pengakuan bersifat lokal per tab; reload/tab lain dapat mengingatkan kembali. Panel React, tampilan terlambat dan wiring query/tombol masih menunggu tahap frontend. PWA tidak menjamin bunyi/getar atau alarm layar terkunci, tidak memaksa melewati senyap/Focus, dan push dapat terlambat. Uji kontrol suara, stop/pengakuan/versi proof baru, background, serta pengaturan perangkat saat integrasi.
