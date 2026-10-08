# Implementasi iRent

PRD menjadi acuan fungsi; DESIGN.md dan enam layar Stitch terbaru menjadi acuan visual. Backend/data dikerjakan sebelum UI. Checklist ini adalah satu tempat pelacakan implementasi, bukan pengganti 65 skenario PRD.

## Tahap 1 — fondasi backend dan struktur data

- [x] NestJS/Express, TypeScript strict, konfigurasi environment, validasi request, health API.
- [x] Schema Prisma seluruh entitas PRD dan migrasi PostgreSQL awal.
- [x] Constraint, indeks, timestamp WIB, dan rupiah tanpa kehilangan presisi.
- [x] Pengujian fondasi, validasi schema, build, lint, dan pemeriksaan migrasi.
- [x] Dokumentasi setup dan batas fitur yang tersedia.

Verifikasi 8 Oktober 2026: build/typecheck/lint/format dan tes fondasi lulus; migrasi diterapkan dari database kosong PostgreSQL 17.11, Prisma diff tanpa drift, seed berulang mempertahankan perubahan settings, serta tes constraint/riwayat/WIB/BIGINT dan health API lulus. Audit npm menunjukkan nol kerentanan. Ini belum mencakup tes konkurensi booking atau seluruh skenario PRD.

## Tahap 2 — fitur backend

- [x] Autentikasi iRent, profil/NIK terenkripsi, akses pelanggan/admin dan pembuatan admin pertama.
- [x] Settings, katalog/unit, zona ongkir, pricing dan snapshot.
- [x] Booking/alokasi atomik, lock pelanggan/unit, FCFS dan idempotensi.
- [x] Upload bukti privat, receipt awal/pelunasan, verifikasi/approval, rekonsiliasi untuk refund dan expiry booking.
- [ ] Pembatalan/refund manual/no-show, pembayaran perpanjangan dan alur koreksi receipt yang masih terbuka.
- [ ] Serah terima, perpanjangan per unit, pengembalian, persiapan/perawatan, denda/kehilangan.
- [ ] Outbox, scheduler, Web Push, adapter WhatsApp, laporan/Excel.
- [ ] Seluruh skenario PRD termasuk konkurensi PostgreSQL dan otorisasi.

Auth sudah diverifikasi melalui HTTP dan PostgreSQL: registrasi/login/logout, role escalation, CSRF/origin, NIK privat, field profil wajib/opsional, bootstrap admin bersamaan, reset semua sesi termasuk konteks request lama, expiry/nonaktif, serta throttle concurrent/HTTP 429. Detail setup dan batas deployment di [backend/AUTH.md](backend/AUTH.md).

Katalog/settings/pricing sudah diverifikasi: kode aksesori global bersamaan, counter tidak berubah pada quantity invalid, otorisasi admin, cache lintas instance, perlindungan alokasi, snapshot tarif booking, perawatan/persiapan, jadwal WIB, tarif 6/12/24/48/168, ongkir sekali, dan DP flat/wajib lunas. Kontrak di [backend/INVENTORY_PRICING.md](backend/INVENTORY_PRICING.md). Quote tidak menahan stok atau membuktikan ketersediaan kalender. Upload media katalog dan worker notifikasi masih belum tersedia.

Booking/alokasi sudah diverifikasi di PostgreSQL: perebutan unit terakhir, batas satu iPhone lintas item, idempotensi concurrent dan normalisasi payload, rollback pesanan beberapa item, buffer tepat satu jam, deadline inklusif, hold kedaluwarsa tanpa menunggu worker, perlindungan pending verifikasi/perpanjangan, keterlambatan/persiapan, waktu setelah lock, retry lock timeout nyata, counter harian dan otorisasi HTTP. Kontrak serta batas tahap di [backend/BOOKINGS.md](backend/BOOKINGS.md). Pengiriman outbox masih tahap berikutnya.

Verifikasi tahap booking 8 Oktober 2026: build, typecheck, lint, format, 13 tes tanpa database, dan suite PostgreSQL dengan 50 tes lulus. Pengujian lock timeout nyata berhasil retry tanpa duplikasi booking/outbox. Ini belum berarti seluruh 65 skenario aplikasi PRD selesai.

Pembayaran/expiry tersedia: multipart JPG/PNG/PDF privat, otorisasi download, deduplikasi proof/receipt, deadline upload/konfirmasi, dana kurang/lebih, aplikasi DP/pelunasan, ledger dan penutupan kewajiban, refund requested untuk dana gagal/berlebih, serta worker expiry tiap menit. Kontrak/configuration dan batas tahap di [backend/PAYMENTS.md](backend/PAYMENTS.md). Refund belum bisa disetujui atau ditandai ditransfer; event notifikasi baru tersimpan, belum dikirim.

Verifikasi tahap pembayaran 8 Oktober 2026: build/typecheck/lint/format, 13 tes tanpa DB dan 73 tes PostgreSQL lulus. Cakupan tambahan mencakup HTTP multipart/download privat, file invalid/oversize, throttle 429, upload terlambat setelah penyimpanan/pencatatan, idempotensi file, reviewer dan worker bersamaan, bank reference lintas pelanggan, dana kurang/lebih/lunas, kegagalan persetujuan yang tetap mencatat uang, rekonsiliasi, serta isolasi kegagalan batch expiry. Schema/migrasi tidak berubah pada tahap ini.

## Tahap 3 — UI, integrasi, dan deployment

- [ ] Kontrak API/OpenAPI stabil untuk fitur yang diimplementasikan.
- [ ] Frontend mengikuti API dan DESIGN.md; lengkapi halaman phase 1.
- [ ] PWA perangkat nyata, performa, aksesibilitas, demo/panduan dan deployment.

Provider WhatsApp, hosting, target bisnis/performa terukur, dan prosedur koreksi receipt tetap mengikuti keputusan terbuka PRD §19. Jangan mengklaim fondasi/schema sebagai backend bisnis yang sudah lengkap.
