# iRent Semarang

Website penyewaan iPhone/aksesori dan PWA admin. Implementasi dimulai dari struktur data dan backend; UI mengikuti kontrak API dan design system.

- [PRD.md](PRD.md): requirement, aturan bisnis, struktur data, dan skenario pengujian.
- [IMPLEMENTATION.md](IMPLEMENTATION.md): progres dan urutan implementasi.
- [backend/README.md](backend/README.md): setup API/PostgreSQL dan perintah development.
- [backend/prisma/schema.prisma](backend/prisma/schema.prisma): model data.
- [DESIGN.md](DESIGN.md): aturan visual, termasuk Poppins.
- [STITCH_REDESIGN.md](STITCH_REDESIGN.md): peta 36 layar FIX dari workspace redesign aktif.
- [design/index.html](design/index.html): galeri desain desktop/mobile terbaru.

Acuan desain aktif adalah workspace **Pastel Workspace Redesign**, dengan aturan visual di `DESIGN.md` dan peta layar di `STITCH_REDESIGN.md`. Preview dalam `design/archive/` hanya arsip dan tidak digunakan untuk implementasi.

Backend tersedia untuk auth/profil, katalog/unit, settings, zona ongkir, perawatan/persiapan, quote harga/snapshot, booking/alokasi atomik, bukti pembayaran privat, verifikasi/approval, pelunasan, ledger, rekonsiliasi untuk refund, expiry, pembatalan penuh, refund manual, dan no-show pickup/delivery. Kontrak [auth](backend/AUTH.md), [katalog/pricing](backend/INVENTORY_PRICING.md), [booking](backend/BOOKINGS.md), [pembayaran](backend/PAYMENTS.md), [pembatalan/refund](backend/REFUNDS.md), dan [no-show](backend/NO_SHOW.md) menjelaskan integrasi. Serah terima/pengembalian per unit, denda final, pelunasan admin, serta persiapan satu jam tersedia melalui [operasional](backend/OPERATIONS.md). Perpanjangan per unit tersedia melalui [perpanjangan](backend/EXTENSIONS.md). Kehilangan/kompensasi, penggantian unit dan risiko booking mendatang tersedia melalui [kehilangan/risiko](backend/LOSS_RISKS.md). Backend Web Push dan antrean notifikasi tersedia melalui [notifikasi](backend/NOTIFICATIONS.md); aset PWA dan panduan integrasi ada di [frontend/PWA.md](frontend/PWA.md). WhatsApp ditunda dari phase 1; panel frontend dan tes perangkat nyata mengikuti checklist implementasi.

Backend phase 1 juga menyediakan [laporan/Excel](backend/REPORTS.md), [foto item/QRIS](backend/MEDIA.md), [antrean dan kalender admin](backend/ADMIN_READS.md), serta [koreksi receipt](backend/RECEIPT_CORRECTIONS.md). Mulai integrasi melalui [kontrak API](backend/API.md), dengan cakupan verifikasi di [ACCEPTANCE.md](backend/ACCEPTANCE.md). Referensi visual terbaru ada pada [galeri design](design/index.html): 36 halaman desktop/mobile, panduan terbaru, dan arsip desain sebelumnya.
