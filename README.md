# iRent Semarang

Website penyewaan iPhone/aksesori dan PWA admin. Implementasi dimulai dari struktur data dan backend; UI mengikuti kontrak API dan design system.

- [PRD.md](PRD.md): requirement, aturan bisnis, struktur data, dan skenario pengujian.
- [IMPLEMENTATION.md](IMPLEMENTATION.md): progres dan urutan implementasi.
- [backend/README.md](backend/README.md): setup API/PostgreSQL dan perintah development.
- [backend/prisma/schema.prisma](backend/prisma/schema.prisma): model data.
- [DESIGN.md](DESIGN.md): aturan visual, termasuk Poppins.
- [STITCH_DESIGN_REVIEW.md](STITCH_DESIGN_REVIEW.md): evaluasi layar desain.

Backend tersedia untuk auth/profil, katalog/unit, settings, zona ongkir, perawatan/persiapan, quote harga/snapshot, booking/alokasi atomik, bukti pembayaran privat, verifikasi/approval, pelunasan, ledger, rekonsiliasi untuk refund, expiry, pembatalan penuh, dan refund manual. Kontrak [auth](backend/AUTH.md), [katalog/pricing](backend/INVENTORY_PRICING.md), [booking](backend/BOOKINGS.md), [pembayaran](backend/PAYMENTS.md), dan [pembatalan/refund](backend/REFUNDS.md) menjelaskan integrasi. No-show, perpanjangan, worker notifikasi, dan frontend mengikuti checklist implementasi.
