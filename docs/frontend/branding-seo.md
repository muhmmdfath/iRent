# Branding dan SEO publik

Logo resmi berasal dari aset yang diberikan pemilik; sumber PNG transparan disimpan tanpa perubahan di `frontend/public/brand/irent-logo.png`. Logo digunakan pada komponen Brand, favicon, dan ikon PWA. Ikon PWA hanya diubah ukurannya menjadi 192/512 px. QRIS harus diunggah melalui endpoint admin, bukan diletakkan sebagai fallback frontend atau mengganti snapshot booking lama.

Foto hero: [Filip Baotić / Unsplash](https://unsplash.com/photos/silver-iphone-6-on-black-surface-g2AaE9ONQyQ), tersedia di bawah [Unsplash License](https://unsplash.com/license). Salinan WebP 640/1280 px disimpan lokal; tidak ada ketergantungan pada hotlink. Foto adalah ilustrasi, bukan janji model atau stok. Kelengkapan/harga/ketersediaan tetap berasal dari katalog.

Identitas bisnis dan Instagram resmi `@irent_semarang` berada di `frontend/src/seo/site.ts`. Tautan tampil di beranda dan footer serta pada `sameAs` Organization. Tidak ditambahkan alamat, nomor telepon, rating, atau ulasan yang belum diverifikasi. Penambahan tautan website ke bio Instagram dilakukan pemilik melalui akun Instagram; kode website tidak mengubah profil eksternal.

Build menghasilkan metadata, canonical, Open Graph, Twitter Card, JSON-LD Organization/WebSite, dan konten pengantar HTML untuk `/`, `/catalog`, `/terms`, serta `sitemap.xml` dan `robots.txt`. Ini bukan snapshot inventaris: katalog dan aturan terbaru tetap dimuat dari API. Sitemap berisi tiga halaman publik utama; detail item ditemukan melalui tautan katalog dan memiliki metadata saat dirender JavaScript. Google tetap perlu merender halaman detail. Sitemap item dinamis belum ditambahkan.

Caddy menyajikan `/` melalui handler khusus ke `index.html`, kemudian HTML halaman publik lain melalui `try_files {path} {path}.html /app-shell.html`. Shell deep link tidak membawa canonical beranda. React memperbarui metadata saat navigasi; halaman privat/login dan halaman tidak ditemukan memakai noindex serta menghapus metadata publik. Header X-Robots-Tag juga ditambahkan pada route akun/admin. Robots bukan kontrol akses; otorisasi API tetap berlaku.

Verifikasi:

```powershell
cd frontend
npm run build
npm run lint
npm test -- tests/seo.test.ts --pool=threads --maxWorkers=1
cd ..
node deploy/verify-public-site.cjs http://127.0.0.1:5180
```

Pendaftaran Search Console, verifikasi domain, dan permintaan indeks merupakan langkah terpisah milik pemilik domain. Perbaikan teknis tidak menjamin peringkat pertama.

Dasar teknis: [JavaScript SEO Google](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics), [Organization](https://developers.google.com/search/docs/appearance/structured-data/organization).
