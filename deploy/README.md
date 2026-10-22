# Deployment iRent

Target: satu VPS Linux, domain HTTPS, Caddy, Node 24, PostgreSQL 17, serta satu instance API/worker. Database dan file produksi baru; jangan unggah `.env`, database demo, atau `backend/storage` ke build context.

## Instalasi awal

1. Jalankan `bootstrap-host.sh` sebagai root pada VPS kosong yang memang ditujukan untuk iRent. Script memasang Docker dari repository resmi dan mengaktifkan firewall untuk SSH/HTTP/HTTPS.
2. Buat secret sekali dengan `node deploy/generate-env.cjs backend/storage/deployment/production DOMAIN`. Salin `app.env` dan `compose.env` ke `/opt/irent/config/`, mode 600. Simpan salinan privat di luar VPS. Jangan regenerasi NIK key untuk database yang sudah berisi NIK.
3. Paketkan sumber dengan `python deploy/package-source.py`, transfer arsip ke VPS, ekstrak ke `/opt/irent/source`. Script menyertakan perubahan working tree pada file aplikasi tracked; pengiriman tidak otomatis berarti sudah commit/push.
4. Dari direktori source, jalankan:

```sh
docker compose --env-file /opt/irent/config/compose.env -f deploy/compose.production.yaml build
docker compose --env-file /opt/irent/config/compose.env -f deploy/compose.production.yaml up -d db
docker compose --env-file /opt/irent/config/compose.env -f deploy/compose.production.yaml run --rm migrate
docker compose --env-file /opt/irent/config/compose.env -f deploy/compose.production.yaml run --rm api node dist/prisma/seed.js
docker compose --env-file /opt/irent/config/compose.env -f deploy/compose.production.yaml up -d api web
```

Seed hanya menambah pengaturan yang belum ada, tanpa item/kredensial/transaksi contoh. Buat admin pertama memakai command `node dist/auth/create-admin.js` di service API dengan `IRENT_ADMIN_NAME`, `IRENT_ADMIN_EMAIL`/`IRENT_ADMIN_PHONE`, dan `IRENT_ADMIN_PASSWORD` dari file environment privat; hapus file bootstrap server setelah digunakan. Jangan tulis password pada argumen shell.

## Akses dan proxy

Domain root menunjuk IPv4 VPS. Caddy mengelola HTTPS dan route SPA; `/api/*` serta `/media/*` diproksikan ke API. File service worker/manifest dilayani sebagai aset asli, bukan fallback HTML. Hanya port 80/443 dipublikasikan; API terikat loopback untuk health check dan PostgreSQL tidak dipublikasikan.

Backend produksi mempercayai tepat satu proxy agar rate limit menggunakan IP pelanggan. Pertahankan API di jaringan privat/loopback dan satu proxy edge; evaluasi ulang konfigurasi jika menambah CDN/proxy.

## Backup dan pemulihan

Salin unit `irent-backup.*` ke `/etc/systemd/system/`, lalu `systemctl enable --now irent-backup.timer`. `backup.sh` membuat dump PostgreSQL, arsip file/media/secret, dan checksum di `/opt/irent/backups/TIMESTAMP` dengan izin privat. Backup harian ini masih berada di VPS yang sama; jadwalkan penyalinan terenkripsi ke penyimpanan lain. Pantau penggunaan disk dan tetapkan retensi setelah kebutuhan bisnis dipilih; script tidak otomatis menghapus backup.

Uji pemulihan pada database terpisah dengan `pg_restore --exit-on-error --no-owner --no-privileges`, lalu hapus database uji. Pemulihan produksi memerlukan penghentian mutasi, database target yang benar, file privat/media, dan NIK keys yang cocok. Jangan mencoba restore pada database produksi aktif.

## Verifikasi sebelum operasional

Periksa `/api/health/ready`, HTTPS, login/logout/cookie/CSRF, validasi password 8 karakter, isolasi akun dan file privat, routing/reload PWA, serta database kosong yang benar. Lanjutkan verifikasi HP nyata untuk push, isi item/harga/zona/QRIS asli, dan ukur kapasitas dengan uji beban yang sesuai. Jangan anggap pemasangan PWA dan worker aktif sebagai bukti push sudah diterima HP.

Layanan produksi menyimpan file di `/opt/irent/data` dan konfigurasi di `/opt/irent/config`; direktori source/build dapat diganti tanpa menghapus data. Sebelum pembaruan, buat backup lalu terapkan migrasi kompatibel. Jangan menjalankan `down -v`, menghapus direktori data, atau mengembalikan versi aplikasi yang tidak kompatibel dengan schema.

Sumber: [Docker Ubuntu](https://docs.docker.com/engine/install/ubuntu/), [Caddy HTTPS](https://caddyserver.com/docs/quick-starts/https).
