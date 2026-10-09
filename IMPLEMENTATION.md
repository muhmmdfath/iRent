# Implementasi iRent

PRD menjadi acuan fungsi; DESIGN.md dan 36 ekspor desktop/mobile terbaru di design/ menjadi acuan visual. Backend/data dikerjakan sebelum UI. Checklist ini adalah satu tempat pelacakan implementasi, bukan pengganti 65 skenario PRD.

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
- [x] Pembatalan booking penuh sebelum serah terima, kebijakan refund snapshot, approval/penolakan dan pencatatan transfer manual privat.
- [x] No-show pickup/delivery, verifikasi kegagalan pelanggan, pengecualian keterlambatan toko dan antrean tindak lanjut admin.
- [x] Pengajuan/perpanjangan per unit, quotation ongkir, hold, pembayaran/approval atomik, expiry, refund dan koreksi denda akibat keterlambatan admin.
- [x] Koreksi receipt masuk: reversal/pengganti immutable, audit, saldo/refund dan pelunasan scope; prosedur disetujui pengguna.
- [x] Serah terima/pelunasan admin, pengembalian per unit, persiapan/perawatan satu jam, dan denda keterlambatan/kerusakan final.
- [x] Kehilangan/kompensasi, penggantian dan tindak lanjut risiko booking mendatang.
- [x] Outbox notifikasi, scheduler deadline, deduplikasi, retry dan recovery lease PostgreSQL.
- [x] Backend Web Push/VAPID dan aset PWA admin; integrasi UI/perangkat nyata mengikuti tahap 3.
- [ ] WhatsApp ditunda dari phase 1; provider/akun/template/penerima diselesaikan saat dilanjutkan.
- [x] Laporan kas harian/bulanan dan Excel dengan precision/correction trail.
- [x] Upload/serving foto item dan QRIS tersanitasi, storage publik terpisah dari bukti privat.
- [x] Daftar pelanggan/admin/refund/perpanjangan, antrean pekerjaan dari state bisnis dan kalender per unit.
- [x] Koreksi pengembalian terverifikasi, debit/credit adjustment, audit dan snapshot pengecualian.
- [x] Aturan backend skenario PRD diuji dengan PostgreSQL/HTTP/otorisasi; matriks dan batas integrasi di backend/ACCEPTANCE.md.

Auth sudah diverifikasi melalui HTTP dan PostgreSQL: registrasi/login/logout, role escalation, CSRF/origin, NIK privat, field profil wajib/opsional, bootstrap admin bersamaan, reset semua sesi termasuk konteks request lama, expiry/nonaktif, serta throttle concurrent/HTTP 429. Detail setup dan batas deployment di [backend/AUTH.md](backend/AUTH.md).

Katalog/settings/pricing sudah diverifikasi: kode aksesori global bersamaan, counter tidak berubah pada quantity invalid, otorisasi admin, cache lintas instance, perlindungan alokasi, snapshot tarif booking, perawatan/persiapan, jadwal WIB, tarif 6/12/24/48/168, ongkir sekali, dan DP flat/wajib lunas. Kontrak di [backend/INVENTORY_PRICING.md](backend/INVENTORY_PRICING.md). Quote tidak menahan stok atau membuktikan ketersediaan kalender. Upload media katalog dan worker notifikasi masih belum tersedia.

Booking/alokasi sudah diverifikasi di PostgreSQL: perebutan unit terakhir, batas satu iPhone lintas item, idempotensi concurrent dan normalisasi payload, rollback pesanan beberapa item, buffer tepat satu jam, deadline inklusif, hold kedaluwarsa tanpa menunggu worker, perlindungan pending verifikasi/perpanjangan, keterlambatan/persiapan, waktu setelah lock, retry lock timeout nyata, counter harian dan otorisasi HTTP. Kontrak serta batas tahap di [backend/BOOKINGS.md](backend/BOOKINGS.md). Pengiriman outbox masih tahap berikutnya.

Verifikasi tahap booking 8 Oktober 2026: build, typecheck, lint, format, 13 tes tanpa database, dan suite PostgreSQL dengan 50 tes lulus. Pengujian lock timeout nyata berhasil retry tanpa duplikasi booking/outbox. Ini belum berarti seluruh 65 skenario aplikasi PRD selesai.

Pembayaran/expiry tersedia: multipart JPG/PNG/PDF privat, otorisasi download, deduplikasi proof/receipt, deadline upload/konfirmasi, dana kurang/lebih, aplikasi DP/pelunasan, ledger dan penutupan kewajiban, refund requested untuk dana gagal/berlebih, serta worker expiry tiap menit. Kontrak/configuration dan batas tahap di [backend/PAYMENTS.md](backend/PAYMENTS.md). Approval dan transfer refund tersedia melalui [backend/REFUNDS.md](backend/REFUNDS.md); event notifikasi baru tersimpan, belum dikirim.

Verifikasi tahap pembayaran 8 Oktober 2026: build/typecheck/lint/format, 13 tes tanpa DB dan 73 tes PostgreSQL lulus. Cakupan tambahan mencakup HTTP multipart/download privat, file invalid/oversize, throttle 429, upload terlambat setelah penyimpanan/pencatatan, idempotensi file, reviewer dan worker bersamaan, bank reference lintas pelanggan, dana kurang/lebih/lunas, kegagalan persetujuan yang tetap mencatat uang, rekonsiliasi, serta isolasi kegagalan batch expiry. Schema/migrasi tidak berubah pada tahap ini.

Pembatalan/refund manual tersedia: seluruh booking sebelum serah terima, snapshot cutoff dan kategori dari applied funds, adjustment tanpa piutang fiktif, rekening penerima, review admin, transfer privat dan pencatatan uang keluar atomik. Pembulatan sekali pada total BIGINT, dana pelunasan sebagian/kelebihan dipisahkan, dan bukti pending dapat direkonsiliasi tanpa mengaktifkan booking kembali. Kontrak di [backend/REFUNDS.md](backend/REFUNDS.md). No-show tersedia melalui [backend/NO_SHOW.md](backend/NO_SHOW.md).

Verifikasi tahap pembatalan/refund 8 Oktober 2026: build/typecheck/lint/format, 15 tes tanpa DB dan 90 tes PostgreSQL lulus. Cakupan baru meliputi batas tepat 48 jam, DP menjadi lunas, booking kecil/rounding, partial settlement/kelebihan, pembatalan toko, larangan batal setelah handover, otorisasi/bukti privat HTTP, idempotensi, reviewer/transfer bersamaan, sumber dana yang bersaing, bank reference lintas pelanggan, rekonsiliasi bukti booking batal, dan refund expiry. Schema/migrasi tidak berubah.

No-show tersedia: hanya booking dikonfirmasi sebelum serah terima, deadline snapshot inklusif, penahanan DP aktual, refund sisa tanpa piutang fiktif, delivery wajib bukti admin dan pengecualian keterlambatan toko. Worker setiap menit dengan batch pembatalan/tindak lanjut terpisah, audit/outbox terdeduplikasi, dan isolasi kegagalan per booking. Kontrak/configuration di [backend/NO_SHOW.md](backend/NO_SHOW.md). API serah terima tersedia melalui [backend/OPERATIONS.md](backend/OPERATIONS.md). Backend pengirim PWA kini tersedia; WhatsApp ditunda.

Verifikasi tahap no-show 9 Oktober 2026: build/typecheck/lint/format, 16 tes tanpa DB dan 107 tes PostgreSQL lulus. Tambahan mencakup deadline tepat tiga jam, refund penuh di atas DP, booking kecil, pelunasan sebagian/kelebihan termasuk refund terdahulu, rekonsiliasi settlement pending setelah penutupan, delivery tanpa bukti, keterlambatan toko, role/CSRF/idempotensi, worker bersamaan, benturan dengan transaksi fixture serah terima, kemajuan batch tindak lanjut dan isolasi kegagalan. Schema/migrasi tidak berubah.

Serah terima/pengembalian tersedia: pelunasan admin aktual, pemeriksaan fisik dan kalender sebelum handover, kompensasi keterlambatan delivery, laporan pelanggan tanpa pelepasan stok, verifikasi per unit, denda/kerusakan final, pengembalian sebagian, dan persiapan/perawatan satu jam dengan penyelesaian admin. Pengembalian membatalkan seluruh proposal perpanjangan pending terkait dan menyiapkan refund 100% untuk receipt tambahannya; jadwal awal unit lain tetap berlaku. Kontrak dan batas tahap di [backend/OPERATIONS.md](backend/OPERATIONS.md). Perpanjangan tersedia melalui [backend/EXTENSIONS.md](backend/EXTENSIONS.md). Kehilangan/penggantian dan risiko booking mendatang tersedia melalui [backend/LOSS_RISKS.md](backend/LOSS_RISKS.md). Pengiriman notifikasi tetap tahap berikutnya.

Verifikasi tahap serah terima/pengembalian 9 Oktober 2026: build/typecheck/lint/format, 18 tes tanpa DB dan 122 tes PostgreSQL lulus. Tambahan mencakup pelunasan admin sebagian/lebih dan retry concurrent, kesiapan fisik dan timestamp, handover/no-show nyata bersamaan, kompensasi delivery yang bertabrakan, laporan/review, return sebagian, denda/kerusakan sekali, pengecualian beririsan, waktu petugas, maintenance/persiapan tepat satu jam, kewajiban/proof pelunasan sebelum denda baru, pembatalan seluruh proposal perpanjangan beserta refund aktual, dan HTTP role/CSRF/DTO. Schema/migrasi tidak berubah.

Perpanjangan per unit tersedia: paket snapshot 6/12/24 tanpa perbedaan hari, batas dua jam/tujuh hari, quotation ongkir untuk penjemputan terpisah, hold 30 menit, proof/receipt privat, dana kurang/lebih, approval multi-unit atomik, expiry dan rekonsiliasi/refund manual. Kalender dan sewa awal tetap terlindungi; approval/pengembalian diserialisasi. Keterlambatan admin dengan dana timely terverifikasi mendapat pengecualian denda, termasuk credit/refund jika barang sudah kembali. Reminder/overdue tersimpan terdeduplikasi, pengirim PWA kini tersedia, WhatsApp ditunda. Kontrak dan configuration di [backend/EXTENSIONS.md](backend/EXTENSIONS.md).

Verifikasi tahap perpanjangan 9 Oktober 2026: build/typecheck/lint/format, 18 tes tanpa DB dan 143 tes PostgreSQL lulus. Tambahan mencakup snapshot tarif, idempotensi/konkurensi proposal, kontensi kalender dengan booking baru, batas dua jam/jam operasional/tujuh hari, hold/upload/konfirmasi, quotation/consent, pembayaran kurang/lebih, rollback approval multi-unit setelah receipt, approval/pengembalian bersamaan, approval admin terlambat, koreksi/refund denda yang sudah dibayar, expiry lintas worker dan isolasi kegagalan, pengingat terdeduplikasi, clock sebelum commit dan penyimpanan proof, proposal gratis, serta HTTP role/CSRF/proof privat. Schema/migrasi tidak berubah.

Kehilangan/risiko tersedia: loss record terpisah, kompensasi/denda final sampai lost_at, penutupan per unit tanpa pengembalian palsu, refund perpanjangan pending, serta koreksi denda setelah rekonsiliasi. Booking mendatang tetap aktif dan berisiko; admin mengganti unit dari model sama melalui pemeriksaan kalender/lock atomik atau membatalkan dengan refund penuh. Risiko dihitung langsung dan outbox dipindai worker bertahap. Kontrak/configuration di [backend/LOSS_RISKS.md](backend/LOSS_RISKS.md). Notifikasi, koreksi receipt masuk dan laporan dilengkapi pada penyelesaian backend di bawah.

Verifikasi tahap kehilangan/risiko 9 Oktober 2026: build/typecheck/lint/format, 18 tes tanpa DB dan 158 tes PostgreSQL lulus. Tambahan mencakup kehilangan/return/approval bersamaan, tagihan dan replay sekali, waktu kejadian/rollback, kehilangan sebagian, refund proposal multi-unit, rekonsiliasi/koreksi denda yang sudah dibayar, perlindungan booking mendatang, penggantian unit terakhir bersamaan, riwayat alokasi/harga/buffer, deadline/kesiapan, pemindaian risiko terdeduplikasi, serta HTTP role/CSRF/DTO. Schema/migrasi tidak berubah.

Notifikasi tersedia: API langganan push admin, sender VAPID, outbox setelah commit, versi proof/deadline, skip task tidak relevan, retry satu/lima menit dengan maksimal tiga percobaan, serta recovery lease lintas worker. Aset PWA ada di frontend/public/admin; panel React dan tes perangkat nyata belum tersedia. Adapter WhatsApp nonaktif sampai keputusan provider/akun/template/penerima diselesaikan, sehingga tes WhatsApp hanya memakai simulasi. Kontrak di [backend/NOTIFICATIONS.md](backend/NOTIFICATIONS.md), integrasi di [frontend/PWA.md](frontend/PWA.md).

Verifikasi tahap notifikasi 9 Oktober 2026: build/typecheck/lint, 23 tes tanpa DB dan 171 tes PostgreSQL lulus. Tambahan mencakup ownership subscription/CSRF, host/key dan VAPID, manifest/ikon/handler push-click, adapter timeout/error privat, dispatch/sender bersamaan, versi proof pada deadline yang sama, skip setelah keputusan, retry/recovery lease, endpoint kedaluwarsa, scope extension, dan isolasi event invalid. Migrasi lease/context diterapkan di PostgreSQL. Pengiriman provider nyata, pemasangan panel dan verifikasi perangkat belum dilakukan.

## Tahap 3 — UI, integrasi, dan deployment

- [x] Kontrak API modul, OpenAPI runtime admin dan ekspor build untuk integrasi; response service rinci mengikuti dokumentasi modul.
- [ ] Frontend mengikuti API dan DESIGN.md; lengkapi halaman phase 1.
- [ ] PWA perangkat nyata, performa, aksesibilitas, demo/panduan dan deployment.

Provider WhatsApp, hosting, target bisnis/performa terukur, dan prosedur koreksi receipt tetap mengikuti keputusan terbuka PRD §19. Jangan mengklaim fondasi/schema sebagai backend bisnis yang sudah lengkap.

Keputusan 9 Oktober 2026: phase 1 hanya PWA. Pengingat booking/perpanjangan H-30/H-15/H-5 dan overdue; tahap lama tidak menumpuk jika worker terlambat. WhatsApp tidak mendapat antrean baru. Helper bunyi dashboard aktif tersedia; wiring panel React, tanda merah overdue, tombol aktivasi/pengakuan dan tes perangkat mengikuti tahap frontend.

Verifikasi perubahan PWA-only: build/typecheck/lint/format lulus; 24 tes tanpa DB dan 172 tes PostgreSQL lulus (196 total). Tes tambahan memeriksa tahap pengingat terbaru, tidak adanya task WhatsApp baru, aktivasi suara, pengakuan lokal, pergantian versi tugas, tab tersembunyi dan disposal. Pengiriman push/perangkat nyata serta integrasi panel belum diuji.

## Penyelesaian backend dan referensi desain terbaru

Backend phase 1 melengkapi laporan/Excel, media publik aman, read-model panel admin, koreksi receipt masuk dan koreksi pengembalian. [backend/API.md](backend/API.md) menghubungkan kontrak per modul; [backend/ACCEPTANCE.md](backend/ACCEPTANCE.md) memetakan aturan PRD ke tes dan acceptance eksternal. Migrasi receipt_corrections dan return_exemptions menambah riwayat reversal immutable, indeks antrean/laporan, serta interval pengecualian untuk koreksi denda.

Folder design/ berisi 36 HTML + 36 PNG terbaru, DESIGN.md, registry screen dan [galeri filter desktop/mobile](design/index.html). Tujuh preview sebelumnya dipindahkan ke archive/legacy-previews. Ekspor tetap referensi; penerapan UI mengikuti hierarchy/spacing terbaru karena beberapa card Stitch masih padat.

Verifikasi akhir backend 9 Oktober 2026: 26 tes tanpa DB dan 185 tes PostgreSQL/HTTP lulus (211 total). Build/typecheck/lint/format dan Prisma validate lulus. Migrasi diterapkan dari kosong dan upgrade pada PostgreSQL 18; diff database/schema tanpa drift; audit dependency nol kerentanan. Tes koreksi/read-model/media juga berjalan dalam schema sementara dari SQL migrasi kosong dan membersihkan seluruh fixture tanpa menonaktifkan guard riwayat. Ekspor OpenAPI dan 36 pasangan HTML/PNG/registry/guide diperiksa. Tidak ada commit/push atau deployment pada tahap ini.
