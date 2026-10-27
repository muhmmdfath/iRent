# Rilis toggle ongkir — 27 Oktober 2026

Website: https://irentsmg.tech. Commit aplikasi: `d97fd93`, dipush ke `origin/main`.

## Hasil

Ongkir dalam aplikasi sudah nonaktif. Pelanggan tetap bisa memilih antar-jemput, mengisi alamat atau tautan lokasi Google Maps, dan membayar sewa melalui aplikasi. Informasi dan pembayaran ongkir diurus lewat chat; biaya tersebut tidak masuk tagihan, laporan, atau refund aplikasi. Admin dapat mengaktifkan kembali switch pada Pengaturan sewa. Booking lama mempertahankan snapshot masing-masing.

## Pelaksanaan

- Backup database, media, bukti dan konfigurasi: `/opt/irent/backups/20261027T093923Z`. Checksum kedua arsip terverifikasi. Source lama disalin ke folder backup yang sama; image API/web sebelumnya diberi tag `before-d97fd93`.
- Source dipaketkan tanpa environment, kredensial dan storage privat. Image API, web dan migrasi dibangun ulang di VPS. Line ending skrip shell dinormalisasi sebelum dijalankan.
- Migrasi `20261027090000_optional_delivery_fee` berhasil. Constraint mengizinkan delivery tanpa zona hanya untuk snapshot mode chat dengan ongkir sistem nol; alamat tetap wajib. Tidak ada penghapusan data pelanggan.
- Konfigurasi Caddy valid. API dan web diperbarui, readiness mengonfirmasi database terhubung, dan `/opt/irent/DEPLOYED_COMMIT` berisi `d97fd93`.
- Switch diubah menjadi false melalui endpoint admin normal dengan sesi/CSRF, menghasilkan revisi settings 2 dan audit. Sesi pengujian diakhiri setelah pemeriksaan.

## Verifikasi

Sebelum rilis: build/typecheck/lint kedua aplikasi, 29 tes unit backend, 49 tes PostgreSQL pada database sementara, 32 tes frontend serta empat tes Chromium desktop/mobile lulus.

Setelah rilis: API dan PostgreSQL healthy; policy publik mengembalikan `delivery_fee_enabled: false`. Halaman admin diperiksa dengan akun terautentikasi tanpa mutasi tambahan. Checkout diperiksa dengan identitas pelanggan simulasi serta katalog/policy live: antar-jemput tersedia, pilihan zona hilang, alamat tetap ada dan informasi ongkir lewat chat tampil. Layout 390/1440 px tidak overflow. Tidak membuat booking atau pembayaran pelanggan produksi.

Screenshot tersimpan privat di `backend/storage/deployment/verification-d97fd93/`. Pembaruan dokumentasi setelah rilis tidak mengubah versi aplikasi yang dibangun.
