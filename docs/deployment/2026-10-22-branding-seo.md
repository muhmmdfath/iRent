# Pembaruan identitas dan SEO publik — 22 Oktober 2026

Sudah diterapkan pada https://irentsmg.tech dari snapshot working tree. Push Git merupakan langkah terpisah.

- Logo resmi yang diberikan pemilik dipakai pada navigasi, footer, favicon, dan ikon PWA. Logo pada sidebar merah muda memakai alas putih agar tetap terbaca.
- QRIS pemilik diunggah melalui login admin dan endpoint resmi. `payment-options` serta file PNG publik diperiksa setelah update. Gambar QRIS lama dan snapshot transaksi tidak dihapus. Tidak ada password di sumber atau dokumen ini.
- Hero menggunakan foto iPhone cinematic yang disimpan lokal dalam dua ukuran WebP, terpisah dari foto produk dan stok. Atribusi/lisensi dicatat di [branding-seo.md](../frontend/branding-seo.md).
- Instagram resmi ditautkan dari beranda, footer, dan `Organization.sameAs`. Bio Instagram belum diubah melalui aplikasi ini.
- HTML awal beranda, katalog, dan ketentuan memuat metadata, canonical, JSON-LD, serta pengantar yang dapat dibaca tanpa JavaScript. Sitemap dan robots tersedia. Konten detail perangkat masih menggunakan rendering JavaScript.
- Caddy memakai handler khusus `/` untuk menyajikan `index.html`; katalog/ketentuan menggunakan HTML masing-masing. Deep link memakai `app-shell.html` yang tidak membawa canonical beranda. Halaman login/admin/akun memiliki header noindex.

Backup prapembaruan frontend: `20261022T070833Z`, pada storage backup privat VPS. Hanya layanan web dibangun ulang; database dan layanan API tetap berjalan. Konfigurasi Caddy divalidasi sebelum penggantian container.

Verifikasi lulus: build beserta typecheck, lint, format file terkait, dua tes metadata, browser publik 360/390/768/1440 px, navigasi ke katalog dan login, pembersihan canonical/metadata privat, HTML publik sebelum JavaScript, sitemap/robots beserta MIME, aset hilang mengembalikan 404, dan readiness database. Panduan admin juga diperiksa dengan sesi simulasi pada desktop/mobile. Tidak ada transaksi uji produksi yang dibuat.

Langkah berikutnya milik pemilik: tautkan website pada bio Instagram, verifikasi Search Console, lalu kirim sitemap/permintaan indeks. Perubahan teknis tidak menjamin posisi hasil pencarian.
