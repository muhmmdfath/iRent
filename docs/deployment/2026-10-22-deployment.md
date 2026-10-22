# Deployment pertama iRent — 22 Oktober 2026

Website: https://irentsmg.tech. Admin: https://irentsmg.tech/admin/.

## Hasil

- Satu VPS Hostinger KVM 2, Ubuntu 26.04.1 LTS, RAM sekitar 8 GB dan disk sekitar 100 GB.
- DNS A dan AAAA mengarah ke IPv4/IPv6 VPS. Caddy memperoleh sertifikat Let's Encrypt; website HTTPS merespons 200 dan readiness API mengonfirmasi koneksi database.
- Frontend dan backend berhasil dibangun dari lockfile. PostgreSQL 17 memakai direktori persisten; seluruh migrasi diterapkan dari database kosong. Seed hanya menambahkan settings, tanpa pelanggan/item/transaksi simulasi.
- Admin pertama dibuat sesuai identitas yang diberikan pengguna. Kredensial acak, kunci SSH dan secret produksi berada di direktori lokal privat yang diabaikan Git; file bootstrap admin di VPS sudah dihapus.
- API berjalan sebagai pengguna non-root dalam container. Database tidak dipublikasikan, API terikat loopback, dan hanya SSH/HTTP/HTTPS dibuka di firewall. Semua layanan memakai restart policy dan log rotation.
- Backend mempercayai satu proxy Caddy untuk IP pelanggan/rate limit. Jangan membuka API langsung ke internet atau menambahkan proxy lain tanpa meninjau pengaturan tersebut.
- Worker tenggat dan notifikasi diaktifkan dengan VAPID. Pengiriman push ke HP nyata masih harus diverifikasi.
- Validasi password baru minimum delapan karakter sudah ikut terdeploy; batas atas tetap 128.

## Verifikasi

- 27 tes backend tanpa database lulus dalam image migrasi, dengan aset frontend yang dibutuhkan tes dipasang read-only.
- 25 tes frontend lulus: customer, session, PWA dan management. Ini menyelesaikan pemeriksaan frontend perubahan password yang sebelumnya terhambat timeout worker pada Windows lokal.
- Pemeriksaan browser live memvalidasi sertifikat HTTPS, beranda, readiness database, dua manifest dan service worker, respons 404 aset yang tidak ada, penolakan API privat tanpa login, origin yang salah, serta registrasi dengan password tujuh karakter.
- Login admin melalui UI, cookie `__Host-*` Secure/HttpOnly/SameSite=Lax, reload route admin, logout dan pencabutan akses API lulus. Beranda/login pada 390 px tidak overflow; tidak ditemukan uncaught browser error selama pemeriksaan.
- Tidak membuat booking atau pelanggan simulasi di produksi. Database saat pemeriksaan restore memiliki satu admin, nol booking dan nol item.

## Backup dan batas operasional

Timer harian aktif sekitar 02:15 WIB. Dump database, media, bukti privat dan kunci konfigurasi disimpan di `/opt/irent/backups`. Backup pertama tanggal 22 Oktober berhasil diverifikasi checksum dan dipulihkan ke database sementara; database uji kemudian dihapus.

Satu salinan backup pertama telah diunduh ke laptop melalui SSH, di storage privat yang diabaikan Git. **Penyalinan backup keluar VPS secara berkala belum dikonfigurasi**. Tetapkan penyimpanan eksternal dan retensi; pantau ruang disk karena backup tidak dihapus otomatis.

Sebelum menerima transaksi pelanggan: isi item/unit/harga, zona dan QRIS asli; verifikasi pemasangan dan Web Push di HP admin, serta cek kapasitas dengan beban yang sesuai. Pengujian booking operasional yang lebih luas sebelumnya berlangsung pada database QA terpisah; bukan bukti semua skenario sudah dijalankan pada domain produksi.

## Lokasi pemeliharaan

Pembaruan berikutnya pada tanggal yang sama menambahkan ganti password sendiri untuk admin/pelanggan di halaman Akun saya. Build dan lint lulus; 27 tes unit backend, tiga tes PostgreSQL/HTTP pada database sementara, dan 29 tes frontend lulus. Modal dicek melalui browser live pada desktop/mobile, termasuk ikon mata, Escape dan pengosongan draft. Semua sesi/push dicabut hanya ketika pengguna berhasil mengganti password; pengujian UI produksi tidak mengganti password admin. API/OpenAPI dan dokumen auth sudah diperbarui; tidak diperlukan migrasi schema.

Konfigurasi deployment dan petunjuk update/restore: [deploy/README.md](../../deploy/README.md). Skrip pemeriksaan browser: [verify-site.cjs](../../deploy/verify-site.cjs). Screenshot dan hasil detail tersimpan lokal dalam `backend/storage/deployment/verification/` dan tidak masuk Git.

Deployment pertama menggunakan snapshot sumber working tree, termasuk perubahan password saat itu. Pembaruan di repositori tidak otomatis membangun ulang atau men-deploy layanan produksi; ikuti prosedur update di `deploy/README.md`.
