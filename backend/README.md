# Backend iRent

Backend NestJS/Express dan PostgreSQL sesuai [PRD](../PRD.md). API tersedia untuk health, auth/profil, katalog/unit, settings, zona ongkir, perawatan/persiapan, dan quote harga/snapshot. Booking/alokasi, pembayaran, worker, dan UI masih mengikuti [IMPLEMENTATION.md](../IMPLEMENTATION.md). Kontrak/setup: [AUTH.md](AUTH.md) dan [INVENTORY_PRICING.md](INVENTORY_PRICING.md).

## Setup lokal

Gunakan Node.js 24.15–24.x dan PostgreSQL 17. Dari root repository:

```powershell
docker compose up -d db
cd backend
Copy-Item .env.example .env
# Isi kunci auth/enkripsi sesuai AUTH.md sebelum menjalankan API.
npm ci
npm run db:deploy
npm run build
npm run db:seed
npm run dev
```

Jika PostgreSQL sudah tersedia, gunakan database baru dan sesuaikan `DATABASE_URL`; Docker opsional. User/password dalam Compose hanya untuk development lokal. Jangan gunakan konfigurasi itu di produksi. Server gagal start tanpa URL PostgreSQL yang valid. `GET /api/health/live` memeriksa proses; `/api/health/ready` memeriksa koneksi database. Port default 3000; frontend lokal diizinkan melalui `CORS_ORIGINS` eksplisit.

## Perintah

| Perintah                                      | Kegunaan                                                                        |
| --------------------------------------------- | ------------------------------------------------------------------------------- |
| `npm run dev`                                 | API dengan watch                                                                |
| `npm run build` / `npm start`                 | Generate client, compile TypeScript, lalu jalankan hasil build                  |
| `npm run typecheck` / `npm run lint`          | Pemeriksaan tipe dan ESLint                                                     |
| `npm run format` / `npm run format:check`     | Format Prisma/Prettier atau periksa format source                               |
| `npm test`                                    | Tes fondasi tanpa database                                                      |
| `npm run test:db`                             | Tes integrasi pada `TEST_DATABASE_URL` khusus pengujian yang sudah dimigrasikan |
| `npm run db:validate` / `npm run db:generate` | Validasi schema atau generate client                                            |
| `npm run db:migrate -- --name <nama>`         | Buat migrasi saat development                                                   |
| `npm run db:deploy`                           | Terapkan migrasi committed ke database target                                   |
| `npm run db:seed`                             | Tambahkan pengaturan awal tanpa menimpa nilai yang sudah ada; build dahulu      |

`test:db` tidak memakai `DATABASE_URL` sebagai fallback. Gunakan database kosong khusus pengujian, contoh `irent_foundation_test`; fixture constraint memakai rollback, fixture auth dibersihkan setelah tes. Jangan gunakan database produksi. Tidak ada admin/password bawaan pada seed. Build lalu `npm run admin:create` untuk admin pertama sesuai AUTH.md.

## Kontrak data dan batas implementasi

- Rupiah memakai PostgreSQL BIGINT/TypeScript bigint; response API mengirim string desimal, misalnya `"20000"`. Frontend tidak boleh mengubahnya menjadi Number untuk perhitungan saldo.
- Datetime bisnis memakai `timestamp(3)` WIB. `parseWibDateTime` menerima ISO ber-offset `+07:00`; Date internal menyimpan wall time WIB di field UTC. Gunakan codec itu pada batas API dan `wibNow()` untuk waktu server. Jangan memakai `new Date()` langsung untuk menulis waktu bisnis. Default dan trigger `updated_at` database menggunakan `Asia/Jakarta`.
- Migrasi memiliki CHECK, partial unique index, composite FK, dan trigger yang tidak seluruhnya tampil di schema Prisma. Tinjau SQL ketika membuat migrasi baru; jangan memakai `db push` untuk menggantikan migrasi.
- Constraint mencegah sejumlah data invalid, bukti pending ganda, dan referensi lintas booking/unit. Booking/alokasi FCFS, snapshot, idempotensi, serta pembayaran awal/pelunasan/expiry tersedia dengan tes konkurensi PostgreSQL; lihat [BOOKINGS.md](BOOKINGS.md) dan [PAYMENTS.md](PAYMENTS.md). Pembatalan, persetujuan/transfer refund, no-show, dan pembayaran perpanjangan masih tahap berikutnya. Seluruh 65 skenario PRD belum selesai.
- Interceptor mengubah nilai JSON dan mempertahankan streaming file. Auth memakai response terpilih, enkripsi NIK, rate limit PostgreSQL, dan guard server/CSRF. Bukti privat tersimpan di `PROOF_STORAGE_DIR`; directory tidak boleh dipublikasikan sebagai static. `PAYMENT_WORKER_ENABLED=true` mengaktifkan expiry tiap menit, kecuali pada test. Worker pengirim outbox belum tersedia; event bisnis tersimpan saat commit.

Versi dependency dikunci dalam lockfile. Override `deepmerge-ts` dan `mysql2` memperbaiki advisory dependency CLI Prisma; evaluasi ulang ketika upgrade Prisma.

Referensi setup: [NestJS](https://docs.nestjs.com/first-steps), [Prisma client v7](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/introduction), [Prisma config](https://www.prisma.io/docs/orm/v7/reference/prisma-config-reference).
