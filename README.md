# iRent Semarang

Website penyewaan iPhone/aksesori dan PWA admin. Implementasi dimulai dari struktur data dan backend; UI mengikuti kontrak API dan design system.

## Menjalankan lokal di Windows

Gunakan PostgreSQL lokal yang aktif di port `5432`. Siapkan database `irent` dan akun database khusus aplikasi, lalu isi `DATABASE_URL` di `backend/.env` (contoh konfigurasi ada di `backend/.env.example`). Jika file environment belum ada, jalankan `node scripts/setup-env.cjs` terlebih dahulu. Dari root repository:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup.ps1
```

Setup memasang Node 24 khusus proyek di `%LOCALAPPDATA%/iRent/runtime`, dependency dari lockfile, pemeriksaan koneksi PostgreSQL lokal, migrasi, pengaturan awal, dan build kedua aplikasi. Environment yang sudah ada dipertahankan; environment baru menggunakan kunci acak tanpa mencetak rahasia.

Jalankan dua terminal dari root repository:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/dev.ps1 backend
powershell -ExecutionPolicy Bypass -File scripts/dev.ps1 frontend
```

Port aplikasi lokal: frontend **5180**, backend **3030**. Port ini dipilih untuk memisahkan iRent dari project lain; proxy Vite, CORS, Playwright dan seed demo mengikuti pasangan yang sama. Jika port terpakai saat akan menjalankan, hentikan proses iRent lama atau sesuaikan port/proxy/CORS bersama; jangan menghentikan project lain.

Buka `http://127.0.0.1:5180`; readiness API tersedia di `http://127.0.0.1:3030/api/health/ready`. PostgreSQL lokal memakai port `5432` melalui service Windows `postgresql-x64-17`; Docker tidak diperlukan. Periksa koneksi dengan `node scripts/check-database.cjs`. Seed hanya mengisi pengaturan; katalog dan QRIS perlu diisi dengan data toko. Pembuatan admin pertama mengikuti [AUTH.md](backend/AUTH.md).

Data simulasi lokal tersedia melalui `powershell -ExecutionPolicy Bypass -File scripts/seed-demo.ps1` setelah kedua server berjalan dan kredensial akun simulasi tersedia di `backend/.env.simulation`. Detail item, booking, gambar dan batas simulasi ada di [docs/demo-data.md](docs/demo-data.md). Seed demo terpisah dari seed pengaturan dan tidak dijalankan otomatis saat setup.

- [PRD.md](PRD.md): requirement, aturan bisnis, struktur data, dan skenario pengujian.
- [IMPLEMENTATION.md](IMPLEMENTATION.md): progres dan urutan implementasi.
- [backend/README.md](backend/README.md): setup API/PostgreSQL dan perintah development.
- [frontend/README.md](frontend/README.md): setup React/Vite, route dan verifikasi fondasi frontend.
- [backend/prisma/schema.prisma](backend/prisma/schema.prisma): model data.

Arah visual mulai 15 Oktober 2026 mengikuti referensi sidebar dan katalog yang diberikan pengguna: workspace putih dominan dengan teks hitam/pink pastel, sidebar berkelompok, navbar pencarian fixed transparan dan kartu produk dengan foto dominan. Beranda memiliki motion dan efek scroll yang menghormati prefers-reduced-motion. DESIGN.md dan STITCH_REDESIGN.md sudah dihapus; seluruh dokumen dan ekspor Stitch telah dihapus dari repositori.

Backend tersedia untuk auth/profil, katalog/unit, settings, zona ongkir, perawatan/persiapan, quote harga/snapshot, booking/alokasi atomik, bukti pembayaran privat, verifikasi/approval, pelunasan, ledger, rekonsiliasi untuk refund, expiry, pembatalan penuh, refund manual, dan no-show pickup/delivery. Kontrak [auth](backend/AUTH.md), [katalog/pricing](backend/INVENTORY_PRICING.md), [booking](backend/BOOKINGS.md), [pembayaran](backend/PAYMENTS.md), [pembatalan/refund](backend/REFUNDS.md), dan [no-show](backend/NO_SHOW.md) menjelaskan integrasi. Serah terima/pengembalian per unit, denda final, pelunasan admin, serta persiapan satu jam tersedia melalui [operasional](backend/OPERATIONS.md). Perpanjangan per unit tersedia melalui [perpanjangan](backend/EXTENSIONS.md). Kehilangan/kompensasi, penggantian unit dan risiko booking mendatang tersedia melalui [kehilangan/risiko](backend/LOSS_RISKS.md). Backend Web Push dan antrean notifikasi tersedia melalui [notifikasi](backend/NOTIFICATIONS.md); aset PWA dan panduan integrasi ada di [frontend/PWA.md](frontend/PWA.md). Panel frontend push/suara sudah tersedia. WhatsApp ditunda dari phase 1; Web Push perangkat nyata dan deployment mengikuti checklist implementasi.

Backend phase 1 juga menyediakan [laporan/Excel](backend/REPORTS.md), [foto item/QRIS](backend/MEDIA.md), [antrean dan kalender admin](backend/ADMIN_READS.md), serta [koreksi receipt](backend/RECEIPT_CORRECTIONS.md). Mulai integrasi melalui [kontrak API](backend/API.md), dengan cakupan verifikasi di [ACCEPTANCE.md](backend/ACCEPTANCE.md).

Frontend phase 1 sudah tersedia untuk seluruh alur pelanggan dan admin: katalog/foto, booking/pembayaran, perpanjangan, return, loss/risiko, refund, inventaris, kalender, pelanggan/admin, settings/QRIS/zona, laporan Excel, serta kontrol push/suara. Setup dan cakupan ada di [frontend/README.md](frontend/README.md), panduan operasional di `/admin/guide`, dan data simulasi lengkap di [docs/demo-data.md](docs/demo-data.md). Web Push perangkat nyata tetap membutuhkan HTTPS dan VAPID.

Status terbaru ada di [IMPLEMENTATION.md](IMPLEMENTATION.md) dan cakupan UI di [frontend/README.md](frontend/README.md). Bagian tahap lama menyimpan riwayat pengujian. Deskripsi perencanaan di AGENTS.md belum mencerminkan scaffolding yang sudah tersedia; struktur dan perintah aktual mengikuti README aplikasi. AGENTS.md dipertahankan sesuai instruksi untuk tidak mengubahnya.
