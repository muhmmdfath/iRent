# iRent Semarang

Website penyewaan iPhone/aksesori dan PWA admin. Implementasi dimulai dari struktur data dan backend; UI mengikuti kontrak API dan design system.

## Menjalankan lokal di Windows

Nyalakan Docker Desktop, lalu dari root repository jalankan:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup.ps1
```

Setup memasang Node 24 khusus proyek di `%LOCALAPPDATA%/iRent/runtime`, dependency dari lockfile, PostgreSQL, migrasi, pengaturan awal, dan build kedua aplikasi. Environment yang sudah ada dipertahankan; environment baru menggunakan kunci acak tanpa mencetak rahasia.

Jalankan dua terminal dari root repository:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/dev.ps1 backend
powershell -ExecutionPolicy Bypass -File scripts/dev.ps1 frontend
```

Buka `http://127.0.0.1:5173`; readiness API tersedia di `http://127.0.0.1:3000/api/health/ready`. PostgreSQL lokal memakai port `55432` agar terpisah dari instalasi PostgreSQL lain. Database dapat dihentikan dengan `docker compose stop postgres` tanpa menghapus data. Seed hanya mengisi pengaturan; katalog dan QRIS perlu diisi dengan data toko. Pembuatan admin pertama mengikuti [AUTH.md](backend/AUTH.md).

Data simulasi lokal tersedia melalui `powershell -ExecutionPolicy Bypass -File scripts/seed-demo.ps1` setelah kedua server berjalan dan kredensial akun simulasi tersedia di `backend/.env.simulation`. Detail item, booking, gambar dan batas simulasi ada di [docs/demo-data.md](docs/demo-data.md). Seed demo terpisah dari seed pengaturan dan tidak dijalankan otomatis saat setup.

- [PRD.md](PRD.md): requirement, aturan bisnis, struktur data, dan skenario pengujian.
- [IMPLEMENTATION.md](IMPLEMENTATION.md): progres dan urutan implementasi.
- [backend/README.md](backend/README.md): setup API/PostgreSQL dan perintah development.
- [frontend/README.md](frontend/README.md): setup React/Vite, route dan verifikasi fondasi frontend.
- [backend/prisma/schema.prisma](backend/prisma/schema.prisma): model data.
- [DESIGN.md](DESIGN.md): aturan visual, termasuk Poppins.
- [STITCH_REDESIGN.md](STITCH_REDESIGN.md): peta 36 layar FIX dari workspace redesign aktif.
- [design/index.html](design/index.html): galeri desain desktop/mobile terbaru.

Acuan desain aktif adalah workspace **Pastel Workspace Redesign**, dengan aturan visual di `DESIGN.md` dan peta layar di `STITCH_REDESIGN.md`. Preview dalam `design/archive/` hanya arsip dan tidak digunakan untuk implementasi.

Backend tersedia untuk auth/profil, katalog/unit, settings, zona ongkir, perawatan/persiapan, quote harga/snapshot, booking/alokasi atomik, bukti pembayaran privat, verifikasi/approval, pelunasan, ledger, rekonsiliasi untuk refund, expiry, pembatalan penuh, refund manual, dan no-show pickup/delivery. Kontrak [auth](backend/AUTH.md), [katalog/pricing](backend/INVENTORY_PRICING.md), [booking](backend/BOOKINGS.md), [pembayaran](backend/PAYMENTS.md), [pembatalan/refund](backend/REFUNDS.md), dan [no-show](backend/NO_SHOW.md) menjelaskan integrasi. Serah terima/pengembalian per unit, denda final, pelunasan admin, serta persiapan satu jam tersedia melalui [operasional](backend/OPERATIONS.md). Perpanjangan per unit tersedia melalui [perpanjangan](backend/EXTENSIONS.md). Kehilangan/kompensasi, penggantian unit dan risiko booking mendatang tersedia melalui [kehilangan/risiko](backend/LOSS_RISKS.md). Backend Web Push dan antrean notifikasi tersedia melalui [notifikasi](backend/NOTIFICATIONS.md); aset PWA dan panduan integrasi ada di [frontend/PWA.md](frontend/PWA.md). WhatsApp ditunda dari phase 1; panel frontend dan tes perangkat nyata mengikuti checklist implementasi.

Backend phase 1 juga menyediakan [laporan/Excel](backend/REPORTS.md), [foto item/QRIS](backend/MEDIA.md), [antrean dan kalender admin](backend/ADMIN_READS.md), serta [koreksi receipt](backend/RECEIPT_CORRECTIONS.md). Mulai integrasi melalui [kontrak API](backend/API.md), dengan cakupan verifikasi di [ACCEPTANCE.md](backend/ACCEPTANCE.md). Referensi visual terbaru ada pada [galeri design](design/index.html): 36 halaman desktop/mobile, panduan terbaru, dan arsip desain sebelumnya.

Frontend pelanggan sudah tersedia untuk registrasi/profil, katalog dengan foto, booking dan upload bukti langsung, status/riwayat pembayaran serta pelunasan. Setup/cakupan ada di [frontend/README.md](frontend/README.md). Aksi lanjutan pelanggan, panel operasional admin dan aktivasi PWA masih mengikuti [progres implementasi](IMPLEMENTATION.md).
