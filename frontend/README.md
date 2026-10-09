# Frontend iRent Semarang

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
| `npm test`                        | Tes integrasi sesi/akses dengan MSW dan tujuan login.            |
| `npx playwright install chromium` | Instal browser tes sekali.                                       |
| `npm run test:e2e`                | Tes browser dengan API simulasi dan lima ukuran layar.           |
| `npm run preview`                 | Sajikan bundle; proxy API development tidak tersedia di preview. |

Tes API nyata hanya dijalankan dengan backend lokal pada **database pengujian yang boleh dibuang**, karena membuat akun, profil, booking dan proof fixture. Seed setidaknya satu item aktif dengan unit ready agar alur booking bisa berjalan. Setelah backend siap, gunakan `$env:IRENT_REAL_API='1'; npm run test:e2e; Remove-Item Env:IRENT_REAL_API`. Tidak perlu kredensial pengguna. Untuk backend pada port berbeda, tetapkan `$env:IRENT_API_PROXY_TARGET='http://127.0.0.1:3001'` sebelum Vite dimulai; variabel ini hanya dibaca konfigurasi server development. Screenshot/trace ada di `test-results/` dan diabaikan Git. Tes perangkat nyata/PWA belum termasuk suite ini.

## Aturan integrasi

React Query memiliki sesi dan data server; Zustand hanya state UI. Cookie sesi HttpOnly dikelola backend. CSRF disimpan dalam cache memori, dipulihkan melalui `GET /auth/session`, dan dipasang pada mutasi. Jangan menyimpan sesi, password, NIK atau bukti pembayaran ke localStorage, sessionStorage, maupun cache service worker.

Gunakan Axios `api` dengan path relatif. Berikan AbortSignal query, sertakan ID pengguna pada query key data privat, dan invalidasi query terkait setelah aksi berhasil. Logout/pergantian sesi membatalkan query lama dan membuang cache privat. Sesi diperiksa kembali saat window mendapat fokus; perubahan akun/role dari tab lain membuang data akun sebelumnya; 401 protected mengakhiri sesi lokal, sedangkan gangguan server menyediakan retry. Guard frontend membantu navigasi; backend tetap memutuskan otorisasi.

Mutasi tidak diulang otomatis. Aksi bisnis memakai `businessActionHeaders()`; pertahankan kunci saat mengulang payload yang sama, gunakan kunci baru untuk payload berbeda. Rupiah API berupa string desimal dan harus memakai BigInt saat dihitung. Waktu ditampilkan dalam WIB tanpa pergeseran offset ganda. Upload multipart tidak menetapkan Content-Type secara manual.

## Cakupan implementasi

Route publik: `/`, `/login`, `/register`, `/catalog`, `/catalog/:id`, `/terms`. Route pelanggan: `/app/`, `/app/account`, `/app/profile`, `/app/new?itemId=...`, `/app/bookings`, `/app/bookings/:id`, `/app/bookings/:id/payment`. Admin memiliki fondasi `/admin/` dan `/admin/account`.

Registrasi/profil, foto item, tarif 6/12/24 jam tanpa beda hari, aksesori per unit, jadwal WIB, ongkir satu kali, quote/availability, consent dan booking tersedia. Upload bukti langsung sesudah booking, countdown tenggat, kurang bayar, alasan penolakan, unduh bukti privat dan pelunasan memakai API. Pending proof tetap menunggu verifikasi admin; nominal bukan kas masuk sebelum diverifikasi. QRIS kosong ditampilkan sebagai instruksi menghubungi admin, tanpa rekening atau kode pembayaran buatan.

Dashboard menampilkan booking terbaru dan kewajiban pembayaran dengan tenggat terdekat. Aksi pembatalan/refund/perpanjangan/lapor pengembalian pelanggan, panel operasional admin, serta aktivasi push/suara belum diimplementasikan. Lihat [PWA.md](PWA.md).

Hosting produksi harus menyajikan `/api` dan `/media` dari backend, lalu fallback route SPA ke `index.html`; prioritaskan aset `/admin/sw.js`, manifest dan ikon agar tidak menjadi HTML. Gunakan HTTPS dan cookie produksi; pastikan Origin yang tepat terdaftar. Jangan memasukkan private VAPID key atau kredensial database ke frontend.

Konfigurasi mengikuti [Vite](https://vite.dev/guide/), [Tailwind dengan Vite](https://tailwindcss.com/docs/installation/using-vite), dan [instalasi manual shadcn/ui](https://ui.shadcn.com/docs/installation/manual). Versi paket dikunci melalui package.json/package-lock.json.

Verifikasi langkah 1: 19 tes Vitest/MSW dan 9 tes Chromium lulus, termasuk alur login/reload/logout menggunakan backend Nest/PostgreSQL nyata pada database sementara. Build, lint, format dan audit (0 vulnerabilities) lulus. [Preview implementasi login](../docs/frontend/README.md) tersedia untuk desktop/mobile.

Verifikasi langkah 2: 26 tes Vitest/MSW dan 15 tes Chromium lulus, termasuk registrasi melalui UI, profil, booking dan upload multipart pada Nest/PostgreSQL nyata. Browser memeriksa katalog/booking/pembayaran pada 360, 390, 768, 1024 dan 1440 px. Proof upload dan booking retry mempertahankan kunci idempotensi; tes memeriksa saldo kurang bayar dan pemuatan katalog saat sesi ditemukan. Backend: 26 tes tanpa DB dan 186 skenario PostgreSQL/HTTP lulus. Tidak ada migrasi baru pada integrasi ini.
