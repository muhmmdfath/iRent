# Cakupan acceptance backend

Acuan: 65 skenario PRD ?17. Tabel ini memetakan aturan server ke suite pengujian, bukan menyatakan produk sudah siap produksi. Framework: `node:test`; `npm test` untuk aturan tanpa DB dan `npm run test:db` untuk PostgreSQL/HTTP. Persentase coverage belum dijadikan target.

| Skenario PRD                     | Bukti otomatis utama di `test/`                                                                                                                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1?6, 9?14, 43?44, 49, 51         | `database/bookings.test.ts`, `database/payments.test.ts`: FCFS/lock, idempotensi, booking langsung upload, buffer, deadline, expiry, approval dan batas pelanggan                                      |
| 7?8                              | `pricing.test.ts`, `database/inventory.test.ts`, `database/bookings.test.ts`: tarif, durasi, DP, ongkir, snapshot/jam operasional/pembukaan booking                                                    |
| 15?23, 37, 39, 45?46, 59, 61, 63 | `database/extensions.test.ts`: scope, paket per unit, quotation/consent, hold, konkurensi, approval multi-unit, deadline dan admin delay                                                               |
| 24?28, 36, 50, 54?55             | `operations.test.ts`, `database/operations.test.ts`: penerimaan fisik, persiapan/perawatan, denda per unit, exemptions dan kompensasi waktu toko                                                       |
| 29, 57?58                        | `database/loss-risk.test.ts`, `database/extensions.test.ts`, `database/operations.test.ts`: kehilangan, risiko, penggantian, approval versus return/loss                                               |
| 30?33, 38, 47, 60, 62, 65        | `refunds.test.ts`, `database/refunds.test.ts`, `database/payments.test.ts`, `database/no-show.test.ts`: kas/charge/application, kebijakan dan half-up, kurang/lebih bayar, refund manual, rekonsiliasi |
| 31, 56                           | `database/no-show.test.ts`: pickup/delivery dan bukti kesiapan/kegagalan pelanggan                                                                                                                     |
| 34, 64                           | `auth.test.ts`, `database/auth.test.ts` serta HTTP pada suite domain: profil wajib, NIK, ownership, role, CSRF, session revocation                                                                     |
| 35, 48                           | `notifications.test.ts`, `database/notifications.test.ts`: relevansi/deduplikasi, retry, lease recovery, outbox dan kegagalan transport simulasi                                                       |
| 40?42                            | `database/schema.test.ts` dan suite domain: composite FK, uniqueness, double review/return/extension/refund dan cadangan dana                                                                          |
| 52                               | `database/admin-reports-media.test.ts`: koreksi return, debit/credit adjustment, audit, idempotensi, snapshot dan union exemptions; `database/extensions.test.ts`: koreksi denda admin delay           |
| 53                               | Aset dan helper PWA diuji oleh suite notifikasi; pemasangan/redirect/service worker melalui frontend deployed dan perangkat nyata masih merupakan acceptance integrasi                                 |

## Tambahan penyelesaian backend

`reports.test.ts` memeriksa periode WIB dan kalender invalid. `database/admin-reports-media.test.ts` menerapkan seluruh migrasi dari kosong pada schema sementara, kemudian menguji role/privacy daftar, kalender, antrean dari state bisnis, laporan kas/pending refund/selesai-lunas, XLSX BIGINT/formula-as-text, foto/QRIS tersanitasi dan serving privat, koreksi receipt immutable/idempotent, uniqueness referensi bank, refund hanya dari receipt terbaru, saldo scope extension, serta koreksi pengembalian tanpa reset readiness.

Migrasi melindungi nominal/waktu/reference receipt dan riwayat koreksi. Uji berlangsung pada PostgreSQL asli, bukan SQLite/mock. Data/report bisnis disimpan dengan WIB wall time dan rupiah string pada API.

## Acceptance yang membutuhkan lingkungan nyata

Integrasi halaman frontend, PWA Android/iPhone, izin/pengiriman Web Push VAPID melalui HTTPS, suara dashboard, pembacaan QRIS dengan aplikasi pembayaran, aksesibilitas/performa dengan profil beban, deployment/scheduler multi-instance, backup/restore, panduan dan demo admin tetap perlu diverifikasi. Target bisnis kuantitatif/hosting belum dipilih. WhatsApp ditunda dan tidak menghambat acceptance phase 1.

Hasil check terakhir dan jumlah tes dicatat di [IMPLEMENTATION.md](../IMPLEMENTATION.md). Tidak ada klaim seluruh kriteria produksi sudah tercapai.
