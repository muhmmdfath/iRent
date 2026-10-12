# Frontend iRent Semarang

## Cakupan terkini phase 1 — 12 Oktober 2026

Seluruh halaman pelanggan/admin terhubung dengan API bisnis. Bagian tahap di bawah adalah catatan historis; cakupan terbaru:

| Area          | Halaman/perilaku                                                                                                                                                                                           |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Publik        | Beranda foto/harga katalog, katalog/detail, ketentuan, login/registrasi                                                                                                                                    |
| Pelanggan     | Profil, booking/availability/quote, pembayaran/upload privat/pelunasan, riwayat/detail, pembatalan/refund, laporan return, perpanjangan/consent ongkir/bukti/status                                        |
| Booking admin | Antrean/pencarian/filter ID pelanggan, verifikasi/reject/approval, settlement, rekonsiliasi/koreksi receipt, handover/return/koreksi return, loss/ganti rugi, unit replacement, kegagalan delivery/no-show |
| Inventaris    | Model/tarif/foto/unit, aktif/nonaktif, perawatan/persiapan, kalender WIB/buffer, risiko booking berikutnya                                                                                                 |
| Pengelolaan   | Pelanggan/detail NIK diaudit/reset password, akun admin, settings/QRIS, zona ongkir, laporan kas/selesai-lunas/Excel                                                                                       |
| PWA admin     | Manifest/SW, izin push dari klik eksplisit, subscription/logout cleanup, riwayat pengiriman, suara/pengakuan versi tugas lokal, panduan `/admin/guide`                                                     |

Form memakai review, error server/offline, dan UUID idempotensi untuk tindakan yang mendukungnya. Rupiah tetap string/BigInt. Query privat terikat pengguna dan dibersihkan ketika sesi berganti; blob proof terautentikasi tidak disimpan di service worker. Pergantian ID record mereset draft/NIK.

Seed lengkap ada di [docs/demo-data.md](../docs/demo-data.md); screenshot terbaru di [docs/frontend](../docs/frontend/README.md). Audit database/browser nyata mencakup admin 360/390/768/1024/1440 px dan pelanggan 360/1440 px. Push Android/iPhone dan QRIS bank nyata membutuhkan HTTPS, VAPID dan QRIS resmi. Pengiriman perangkat fisik belum diverifikasi; WhatsApp ditunda sesuai PRD.

Fondasi React/TypeScript untuk website pelanggan dan admin PWA. Acuan bisnis: [PRD](../PRD.md). Acuan visual: [DESIGN.md](../DESIGN.md) dan [layar FIX redesign](../STITCH_REDESIGN.md). Ekspor Stitch adalah referensi; komponen implementasi memakai Poppins, spacing, dan hierarki terbaru.

## Menjalankan lokal

Node 22.12+ diperlukan; diverifikasi dengan Node 24.21.0. Jalankan dari `frontend/`:

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

Buka `http://127.0.0.1:5173`. Jalankan [backend](../backend/README.md) pada `127.0.0.1:3000`, dengan `CORS_ORIGINS=http://127.0.0.1:5173`. Vite memproksikan `/api` dan `/media` tanpa mengubah Origin. Gunakan hostname yang sama agar cookie konsisten. `.env` opsional karena API default `/api`; semua `VITE_*` bersifat publik.

## Struktur

- `src/app/`: provider, router, shell responsif, feedback koneksi, halaman umum.
- `src/auth/`: kontrak login/session, guard role, halaman masuk, tujuan setelah login.
- `src/account/pages/`: informasi akun; `src/customer/`: profil, katalog, booking dan pembayaran.
- `src/admin/`: antrean pembayaran, daftar/detail booking, pemeriksaan bukti dan pelunasan.
- `src/components/ui/`: komponen dasar shadcn/ui yang disesuaikan dengan DESIGN.md.
- `src/services/`: Axios dan React Query; `src/stores/`: state navigasi Zustand.
- `src/hooks/`, `src/lib/`: utilitas bersama; `src/styles.css`: token dan layout.
- `public/admin/`: aset PWA yang sudah ada; `tests/`: Vitest/MSW dan Playwright.

## Perintah verifikasi

| Perintah                          | Fungsi                                                           |
| --------------------------------- | ---------------------------------------------------------------- |
| `npm run build`                   | Typecheck aplikasi/config lalu bundle produksi.                  |
| `npm run typecheck`               | Periksa TypeScript tanpa menghasilkan file.                      |
| `npm run lint`                    | ESLint TypeScript dan aturan React hooks.                        |
| `npm run format:check`            | Periksa format Prettier; `npm run format` memperbaikinya.        |
| `npm test`                        | Tes perilaku sesi, pelanggan dan admin dengan MSW.               |
| `npx playwright install chromium` | Instal browser tes sekali.                                       |
| `npm run test:e2e`                | Tes browser dengan API simulasi dan lima ukuran layar.           |
| `npm run preview`                 | Sajikan bundle; proxy API development tidak tersedia di preview. |

Tes API nyata hanya dijalankan dengan backend lokal pada **database pengujian yang boleh dibuang**, karena membuat akun, profil, booking dan proof fixture. Seed setidaknya satu item aktif dengan unit ready agar alur booking bisa berjalan. Setelah backend siap, gunakan `$env:IRENT_REAL_API='1'; npm run test:e2e; Remove-Item Env:IRENT_REAL_API`. Tidak perlu kredensial pengguna. Untuk backend pada port berbeda, tetapkan `$env:IRENT_API_PROXY_TARGET='http://127.0.0.1:3001'` sebelum Vite dimulai; variabel ini hanya dibaca konfigurasi server development. Screenshot/trace ada di `test-results/` dan diabaikan Git. Tes perangkat nyata/PWA belum termasuk suite ini.

## Aturan integrasi

React Query memiliki sesi dan data server; Zustand hanya state UI. Cookie sesi HttpOnly dikelola backend. CSRF disimpan dalam cache memori, dipulihkan melalui `GET /auth/session`, dan dipasang pada mutasi. Jangan menyimpan sesi, password, NIK atau bukti pembayaran ke localStorage, sessionStorage, maupun cache service worker.

Gunakan Axios `api` dengan path relatif. Berikan AbortSignal query, sertakan ID pengguna pada query key data privat, dan invalidasi query terkait setelah aksi berhasil. Logout/pergantian sesi membatalkan query lama dan membuang cache privat. Sesi diperiksa kembali saat window mendapat fokus; perubahan akun/role dari tab lain membuang data akun sebelumnya; 401 protected mengakhiri sesi lokal, sedangkan gangguan server menyediakan retry. Guard frontend membantu navigasi; backend tetap memutuskan otorisasi.

Mutasi tidak diulang otomatis. Aksi bisnis memakai `businessActionHeaders()`; pertahankan kunci saat mengulang payload yang sama, gunakan kunci baru untuk payload berbeda. Rupiah API berupa string desimal dan harus memakai BigInt saat dihitung. Waktu ditampilkan dalam WIB tanpa pergeseran offset ganda. Upload multipart tidak menetapkan Content-Type secara manual.

## Riwayat cakupan implementasi - langkah 1 sampai 6

Route publik: `/`, `/login`, `/register`, `/catalog`, `/catalog/:id`, `/terms`. Route pelanggan: `/app/`, `/app/account`, `/app/profile`, `/app/new?itemId=...`, `/app/bookings`, `/app/bookings/:id`, `/app/bookings/:id/payment`. Route admin: `/admin/`, `/admin/account`, `/admin/bookings`, `/admin/bookings/:id`, `/admin/inventory`, `/admin/inventory/new`, `/admin/inventory/:id`.

Registrasi/profil, foto item, tarif 6/12/24 jam tanpa beda hari, aksesori per unit, jadwal WIB, ongkir satu kali, quote/availability, consent dan booking tersedia. Upload bukti langsung sesudah booking, countdown tenggat, kurang bayar, alasan penolakan, unduh bukti privat dan pelunasan memakai API. Pending proof tetap menunggu verifikasi admin; nominal bukan kas masuk sebelum diverifikasi. QRIS kosong ditampilkan sebagai instruksi menghubungi admin, tanpa rekening atau kode pembayaran buatan.

Dashboard pelanggan menampilkan booking terbaru dan kewajiban pembayaran dengan tenggat terdekat. Admin memiliki antrean pembayaran, pencarian kode/nama pelanggan, filter status, sortir dan pagination. Detail menampilkan kontak pelanggan tanpa NIK, unit/jadwal, alamat delivery, saldo dan riwayat status. Bukti pembayaran awal dapat dilihat/diunduh secara privat, diverifikasi dengan nominal uang aktual atau ditolak dengan alasan. Pelunasan dicatat untuk booking yang sudah dikonfirmasi; form memerlukan pemeriksaan ulang sebelum pencatatan dan mempertahankan kunci idempotensi saat retry payload sama. Kurang bayar mengikuti saldo/status dari backend.

Serah-terima dan pengembalian admin tersedia di detail booking. Serah-terima seluruh unit memerlukan dana sewa/ongkir yang sudah diterapkan, waktu aktual WIB dan catatan kondisi; delivery terlambat memerlukan alasan toko. Backend tetap memeriksa kesiapan, jadwal dan kalender. Pengembalian diverifikasi per unit, termasuk tanpa laporan pelanggan, dengan penerimaan toko/petugas, kondisi layak/perawatan, biaya dan catatan kerusakan, serta beberapa interval pengecualian denda. Laporan dapat ditolak dengan alasan tanpa menutup sewa. Form menggunakan pemeriksaan ulang, acknowledgement fisik dan retry idempotent; waktu aktual mempertahankan detik. Setelah verifikasi, status unit, saldo dan denda final diperbarui dari API.

Inventaris admin menyediakan pencarian/filter/pagination, detail model aktif/nonaktif, pembuatan/edit nama/tarif/isi paket, status katalog, serta upload/lepas foto publik. Kategori model tetap; tarif baru tidak mengubah snapshot booking. Unit iPhone memakai kode unik, aksesori memakai jumlah dan kode otomatis. Status aktif unit, perawatan dan persiapan dipisahkan dari status katalog. Penonaktifan/mulai perawatan diblokir untuk unit teralokasi atau belum kembali. Penyelesaian perawatan memulai persiapan satu jam; tombol selesai persiapan terbuka setelah deadline dan tetap mengikuti pemeriksaan backend. Tidak ada hard delete unit/transaksi.

Mutasi inventaris tidak diulang otomatis. Pembuatan model/unit pada backend belum mendukung idempotensi; konfirmasi ulang pada pemeriksaan yang sama diblokir bila respons pembuatan ambigu (network/5xx). Periksa inventaris terlebih dahulu sebelum membuat ulang. Foto memakai multipart tanpa Content-Type manual, dengan preview blob sementara dan sanitasi backend.

Perpanjangan dan laporan pengembalian pelanggan, pengaturan/zona/laporan admin, verifikasi perpanjangan, serta aktivasi push/suara tersedia. Lihat [PWA.md](PWA.md).

Pembatalan pelanggan dan kendala toko tersedia di detail booking. Panel refund menyediakan rekening penerima, persetujuan/penolakan admin, pencatatan transfer manual beserta bukti privat dan unduhan bukti oleh pemilik/admin. Antrean admin tersedia di `/admin/refunds`. Nominal berasal dari backend; UI tidak mengeksekusi transfer bank. Form melakukan review sebelum tindakan, mempertahankan kunci idempotensi pada retry payload yang sama, serta menyegarkan booking/saldo/antrean/ketersediaan setelah berhasil. Tidak ada perubahan schema atau migrasi pada langkah ini.

Hosting produksi harus menyajikan `/api` dan `/media` dari backend, lalu fallback route SPA ke `index.html`; prioritaskan aset `/admin/sw.js`, manifest dan ikon agar tidak menjadi HTML. Gunakan HTTPS dan cookie produksi; pastikan Origin yang tepat terdaftar. Jangan memasukkan private VAPID key atau kredensial database ke frontend.

Konfigurasi mengikuti [Vite](https://vite.dev/guide/), [Tailwind dengan Vite](https://tailwindcss.com/docs/installation/using-vite), dan [instalasi manual shadcn/ui](https://ui.shadcn.com/docs/installation/manual). Versi paket dikunci melalui package.json/package-lock.json.

Verifikasi langkah 1: 19 tes Vitest/MSW dan 9 tes Chromium lulus, termasuk alur login/reload/logout menggunakan backend Nest/PostgreSQL nyata pada database sementara. Build, lint, format dan audit (0 vulnerabilities) lulus. [Preview implementasi login](../docs/frontend/README.md) tersedia untuk desktop/mobile.

Verifikasi langkah 2: 26 tes Vitest/MSW dan 15 tes Chromium lulus, termasuk registrasi melalui UI, profil, booking dan upload multipart pada Nest/PostgreSQL nyata. Browser memeriksa katalog/booking/pembayaran pada 360, 390, 768, 1024 dan 1440 px. Proof upload dan booking retry mempertahankan kunci idempotensi; tes memeriksa saldo kurang bayar dan pemuatan katalog saat sesi ditemukan. Backend: 26 tes tanpa DB dan 186 skenario PostgreSQL/HTTP lulus. Tidak ada migrasi baru pada integrasi ini.

Verifikasi langkah 3: 35 tes Vitest/MSW, 18 tes Chromium dengan API simulasi, dan satu alur admin pada Nest/PostgreSQL nyata lulus. Alur nyata memeriksa DP kurang bayar, pelengkapan DP, konfirmasi, pelunasan, preview bukti privat, penolakan bukti dan penolakan akses admin bagi pelanggan. Backend: 26 tes tanpa DB serta suite booking PostgreSQL (17 skenario) lulus; build/typecheck/lint lulus. Tidak ada migrasi baru. Screenshot admin tersedia di [docs/frontend](../docs/frontend/README.md).

Tes `tests/e2e/admin-real.spec.ts` memerlukan `IRENT_REAL_API=1`, `IRENT_ADMIN_TEST_EMAIL` dan `IRENT_ADMIN_TEST_PASSWORD` untuk admin pada database pengujian. Tes membuat transaksi fixture; jangan arahkan ke database produksi atau demo utama. Kredensial hanya diberikan melalui environment pengujian.

Catatan checkout Windows: pemeriksaan format seluruh repo masih melaporkan file lama dengan line ending CRLF, sementara konfigurasi Prettier meminta LF. Pemeriksaan format file yang diubah pada langkah 3 lulus; file lama tidak diformat massal pada tahap ini.

Verifikasi langkah 4: seluruh 43 tes Vitest/MSW frontend, sepuluh tes browser booking/pembayaran/pengembalian admin, dan 15 tes suite operasional PostgreSQL lulus. Tes UI mencakup applied funds sebelum handover, konfirmasi tindakan, kurang bayar, pengembalian sebagian, tagihan baru, retry dengan key sama, penolakan laporan, kondisi/perawatan, catatan kerusakan, urutan penerimaan petugas dan alasan delivery terlambat. Backend bisnis tidak berubah. Tes browser memakai API simulasi; suite PostgreSQL memeriksa endpoint/aturan nyata secara terpisah.

Verifikasi langkah 5: 54 tes Vitest/MSW, tujuh tes browser inventaris dengan API simulasi, satu alur inventaris UI pada API/PostgreSQL nyata, serta delapan tes suite PostgreSQL inventaris lulus. Viewport 360/390/768/1024/1440 px, pencarian/filter, presisi BIGINT, perubahan model, batch unit, respons pembuatan ambigu, batas persiapan, browser back dan multipart diperiksa. Build/typecheck/lint dan format file yang berubah lulus; OpenAPI diperbarui tanpa migrasi. Tes nyata `tests/e2e/inventory-real.spec.ts` memakai environment admin/database pengujian yang sama seperti tes admin nyata, membuat fixture model/unit/foto, dan tidak menunggu satu jam secara nyata; batas dan penyelesaian persiapan diuji terpisah pada MSW/PostgreSQL.

Regresi seluruh suite Chromium: 30 tes API simulasi lulus; empat tes API nyata dilewati pada konfigurasi default. Alur inventaris API nyata di atas dijalankan terpisah dengan environment pengujian. Backend demo utama sudah memakai API terbaru dan tetap memiliki tujuh model dummy.

Verifikasi penyelesaian 12 Oktober 2026: build/typecheck/lint lulus; 76 tes Vitest/MSW (`npm test -- --maxWorkers=2`), 36 tes browser API simulasi dan audit demo API nyata terpisah (88 kunjungan halaman) lulus. Lima tes browser khusus API nyata dilewati pada regresi default. Backend: 26 tes unit dan 188 tes PostgreSQL/HTTP pada database kosong lulus. Batasi worker pada mesin dengan RAM terbatas. Screenshot dan seed tersedia pada tautan di atas.

Refactor 12 Oktober 2026: daftar perpanjangan bersama ada di `src/extensions/components/extension-list.tsx`; halaman/form di `src/extensions/pages.tsx` hanya dimuat dinamis oleh router. Build bebas warning import dinamis tidak efektif; 76 tes UI dan 12 tes browser pada bundle produksi lulus. Navigasi/reload detail perpanjangan diuji pada 390/1440 px.
