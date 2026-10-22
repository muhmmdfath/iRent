# Panduan admin — 22 Oktober 2026

## Audit dan arah desain

Halaman sebelumnya menampilkan delapan paragraf sebagai kartu dua kolom. Judul mengikuti skala halaman umum, jarak tiap blok besar, tidak ada navigasi topik, dan footer pemasaran mendominasi bagian bawah. Aturan tautan global juga membuat semua tautan terlihat seperti tombol abu-abu.

Arah baru mengikuti pola dokumentasi bantuan: daftar topik, satu artikel aktif, langkah bernomor, satu catatan penting dan tautan menuju pekerjaan terkait. Font tetap Poppins. Judul halaman 24 px desktop/22 px mobile, judul artikel 20/18 px, teks langkah sekitar 12 px. Navigasi dikelompokkan; mobile memakai dropdown. Pemilihan topik tersimpan pada query `topik`, mendukung reload dan riwayat browser. Footer dipadatkan khusus halaman panduan.

## Referensi

- [Shopify Help — Managing payments for orders](https://help.shopify.com/en/manual/fulfillment/managing-orders/payments): pemisahan topik pembayaran dan tautan ke panduan terkait. Dipakai sebagai referensi organisasi konten, bukan aturan pembayaran iRent.
- [Stripe Docs — Web Dashboard](https://docs.stripe.com/dashboard/basics): hierarki topik pendek, navigasi berdasarkan tugas, dan rujukan ke pengaturan terkait. Dipakai sebagai referensi dokumentasi operasional.

Seluruh aturan bisnis tetap mengikuti PRD iRent. Delapan topik sebelumnya dipertahankan dan dipecah menjadi langkah singkat; ditambah panduan password sesuai fitur terbaru. Tidak mengubah tarif, pembayaran, alokasi stok, refund atau perpanjangan.

## Verifikasi

`tests/e2e/admin-guide.spec.ts` mencakup 360/390/768/1024/1440 px, navigasi topik, reload, histori, keyboard, tautan tindakan, ukuran judul, warna tombol serta aturan pengembalian/refund. Helper `deploy/verify-admin-guide.cjs` menangkap sebelum/sesudah dan memeriksa tampilan dengan sesi admin simulasi; tidak membaca data produksi.

Build/typecheck/lint/format dan enam tes browser lulus. Tampilan bundle pada domain produksi juga diperiksa dengan sesi admin simulasi pada 1440/390 px; tidak membaca atau mengubah data produksi. Readiness API/database tetap sehat setelah pembaruan frontend.

Preview: [desktop](admin-guide-1440.png) dan [mobile](admin-guide-390.png). Screenshot refund dan sebelum perapihan tersimpan dalam storage pengembangan yang diabaikan Git. Hasil verifikasi akhir dicatat pada IMPLEMENTATION.md.
